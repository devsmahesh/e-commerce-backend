import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { RedisService } from '../../config/redis/redis.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private redisService: RedisService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    // Generate slug from name
    const slug = this.generateSlug(createProductDto.name);

    // Check if slug exists
    const existingProduct = await this.productModel.findOne({ slug });
    if (existingProduct) {
      throw new ConflictException('Product with this name already exists');
    }

    const product = await this.productModel.create({
      ...createProductDto,
      slug,
    });

    // Invalidate cache
    await this.invalidateProductCache();

    return product;
  }

  async findAll(filterDto: FilterProductsDto) {
    try {
      const {
        page = 1,
        limit = 10,
        search: rawSearch,
        categoryId,
        tags,
        minPrice,
        maxPrice,
        minRating,
        inStock,
        isFeatured,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = filterDto;

      // Normalize empty search string to undefined
      const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim() : undefined;

    // Build cache key
    const cacheKey = `products:${JSON.stringify(filterDto)}`;

    // Try to get from cache (only if Redis is available)
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // If Redis fails, continue without cache
      console.warn('Redis cache error:', error.message);
    }

    // Build query
    const query: any = { isActive: true };

    // Only use text search if search is provided and not empty
    if (search && search.trim().length > 0) {
      query.$text = { $search: search.trim() };
    }

    if (categoryId) {
      query.categoryId = categoryId;
    }

    if (tags && tags.length > 0) {
      query.tags = { $in: tags };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.price = {};
      if (minPrice !== undefined) {
        query.price.$gte = minPrice;
      }
      if (maxPrice !== undefined) {
        query.price.$lte = maxPrice;
      }
    }

    if (minRating !== undefined) {
      query.averageRating = { $gte: minRating };
    }

    if (inStock === true) {
      query.stock = { $gt: 0 };
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured;
    }

    // Build sort - validate sortBy field
    const validSortFields = ['price', 'rating', 'createdAt', 'salesCount', 'averageRating', 'name'];
    const actualSortBy = validSortFields.includes(sortBy || '') ? (sortBy || 'createdAt') : 'createdAt';
    
    // Map 'rating' to 'averageRating' for consistency
    const sortField = actualSortBy === 'rating' ? 'averageRating' : actualSortBy;
    
    const sort: any = {};
    // Only use textScore if we're actually doing a text search
    if (search && search.trim().length > 0) {
      sort.score = { $meta: 'textScore' };
    }
    // Always ensure we have at least one sort field
    sort[sortField] = (sortOrder === 'asc' ? 1 : -1);
    
    // If sort object is empty (shouldn't happen), default to createdAt
    if (Object.keys(sort).length === 0) {
      sort.createdAt = -1;
    }

    // Execute query
    const skip = Math.max(0, (Number(page) - 1) * Number(limit));
    const numericLimit = Number(limit);
    let items, total;
    try {
      this.logger.debug(`Executing products query: ${JSON.stringify(query)}, sort: ${JSON.stringify(sort)}`);
      
      // First, get products without populate to avoid ObjectId casting errors
      const productsQuery = this.productModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(numericLimit);
      
      // Execute query without populate first to avoid ObjectId casting errors
      items = await productsQuery.exec();
      
      // Filter and clean invalid categoryId values before populating
      const cleanedItems = items.map((product: any) => {
        const productObj: any = product.toObject ? product.toObject() : product;
        // Check if categoryId is valid ObjectId
        if (productObj.categoryId) {
          const categoryIdStr = String(productObj.categoryId);
          // If categoryId is "undefined", null, or invalid ObjectId, set to null
          if (categoryIdStr === 'undefined' || 
              categoryIdStr === 'null' || 
              !mongoose.Types.ObjectId.isValid(categoryIdStr)) {
            productObj.categoryId = null;
          }
        }
        return productObj;
      });
      
      // Populate only valid categoryIds
      await this.productModel.populate(cleanedItems, {
        path: 'categoryId',
        select: 'name slug',
        options: { strictPopulate: false },
      });
      
      items = cleanedItems;
      total = await this.productModel.countDocuments(query).exec();
    } catch (error) {
      this.logger.error(`Products query error: ${error.message}`, error.stack);
      // If text search fails (e.g., no text index), fall back to regex search
      if (search && search.trim().length > 0 && (error.message?.includes('text index') || error.message?.includes('$text'))) {
        // Fallback to regex search if text index doesn't exist
        delete query.$text;
        const searchRegex = new RegExp(search.trim(), 'i');
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
        ];
        delete sort.score;
        
        // Fallback query without populate to avoid errors
        items = await this.productModel
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(numericLimit)
          .exec();
        
        // Clean and populate
        const cleanedItems = items.map((product: any) => {
          const productObj = product.toObject ? product.toObject() : product;
          if (productObj.categoryId) {
            const categoryIdStr = String(productObj.categoryId);
            if (categoryIdStr === 'undefined' || 
                categoryIdStr === 'null' || 
                !mongoose.Types.ObjectId.isValid(categoryIdStr)) {
              productObj.categoryId = null;
            }
          }
          return productObj;
        });
        
        await this.productModel.populate(cleanedItems, {
          path: 'categoryId',
          select: 'name slug',
          options: { strictPopulate: false },
        });
        
        items = cleanedItems;
        total = await this.productModel.countDocuments(query).exec();
      } else {
        throw error;
      }
    }

    const result = {
      items: items || [],
      meta: {
        total: total || 0,
        page: Number(page),
        limit: numericLimit,
        totalPages: Math.ceil((total || 0) / numericLimit),
      },
    };

    // Cache for 5 minutes (only if Redis is available)
    try {
      await this.redisService.set(cacheKey, result, 300);
    } catch (error) {
      // If Redis fails, continue without caching
      this.logger.warn('Redis cache error:', error.message);
    }

    return result;
    } catch (error) {
      this.logger.error(`Error in findAll: ${error.message}`, error.stack);
      // Re-throw with more context
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to fetch products: ${errorMessage}`);
    }
  }

  async findOne(id: string) {
    const cacheKey = `product:${id}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn('Redis cache error:', error.message);
    }

    // Get product without populate first to avoid ObjectId casting errors
    const product = await this.productModel.findById(id).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Clean invalid categoryId before populating
    const productObj: any = product.toObject ? product.toObject() : product;
    if (productObj.categoryId) {
      const categoryIdStr = String(productObj.categoryId);
      if (categoryIdStr === 'undefined' || 
          categoryIdStr === 'null' || 
          !mongoose.Types.ObjectId.isValid(categoryIdStr)) {
        productObj.categoryId = null;
      }
    }

    // Populate only if categoryId is valid
    if (productObj.categoryId) {
      await this.productModel.populate(productObj, {
        path: 'categoryId',
        select: 'name slug',
        options: { strictPopulate: false },
      });
    }

    // Cache for 10 minutes
    try {
      await this.redisService.set(cacheKey, productObj, 600);
    } catch (error) {
      this.logger.warn('Redis cache error:', error.message);
    }

    return productObj;
  }

  async findBySlug(slug: string) {
    const cacheKey = `product:slug:${slug}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      this.logger.warn('Redis cache error:', error.message);
    }

    // Get product without populate first to avoid ObjectId casting errors
    const product = await this.productModel.findOne({ slug }).exec();

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Clean invalid categoryId before populating
    const productObj: any = product.toObject ? product.toObject() : product;
    if (productObj.categoryId) {
      const categoryIdStr = String(productObj.categoryId);
      if (categoryIdStr === 'undefined' || 
          categoryIdStr === 'null' || 
          !mongoose.Types.ObjectId.isValid(categoryIdStr)) {
        productObj.categoryId = null;
      }
    }

    // Populate only if categoryId is valid
    if (productObj.categoryId) {
      await this.productModel.populate(productObj, {
        path: 'categoryId',
        select: 'name slug',
        options: { strictPopulate: false },
      });
    }

    // Cache for 10 minutes
    try {
      await this.redisService.set(cacheKey, productObj, 600);
    } catch (error) {
      this.logger.warn('Redis cache error:', error.message);
    }

    return productObj;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // If name is being updated, regenerate slug
    if (updateProductDto.name && updateProductDto.name !== product.name) {
      const newSlug = this.generateSlug(updateProductDto.name);
      const existingProduct = await this.productModel.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });

      if (existingProduct) {
        throw new ConflictException('Product with this name already exists');
      }

      (updateProductDto as any).slug = newSlug;
    }

    const updatedProduct = await this.productModel.findByIdAndUpdate(
      id,
      { $set: updateProductDto },
      { new: true, runValidators: true },
    );

    // Invalidate cache
    await this.invalidateProductCache(id);

    return updatedProduct;
  }

  async remove(id: string) {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.productModel.findByIdAndDelete(id);

    // Invalidate cache
    await this.invalidateProductCache(id);

    return { message: 'Product deleted successfully' };
  }

  async updateStock(id: string, quantity: number) {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    product.stock += quantity;
    if (product.stock < 0) {
      throw new ConflictException('Insufficient stock');
    }

    await product.save();

    // Invalidate cache
    await this.invalidateProductCache(id);

    return product;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private async invalidateProductCache(productId?: string) {
    if (productId) {
      await this.redisService.del(`product:${productId}`);
      // Also invalidate slug cache - would need to fetch product first
    }
    // Invalidate all product list caches
    await this.redisService.flushPattern('products:*');
  }
}

