import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as mongoose from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Product, ProductDocument } from './schemas/product.schema';
import { Review, ReviewDocument, ReviewStatus } from '../reviews/schemas/review.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { RedisService } from '../../config/redis/redis.service';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {}

  async create(createProductDto: CreateProductDto) {
    // Validate and process variants if provided
    if (createProductDto.variants && createProductDto.variants.length > 0) {
      this.validateVariants(createProductDto.variants);
    }

    // Validate and process details if provided
    if (createProductDto.details) {
      this.validateDetails(createProductDto.details);
    }

    // Validate compareAtPrice >= price if both are provided
    if (
      createProductDto.compareAtPrice !== undefined &&
      createProductDto.price !== undefined &&
      createProductDto.compareAtPrice < createProductDto.price
    ) {
      throw new BadRequestException(
        'compareAtPrice must be greater than or equal to price',
      );
    }

    // Generate slug from name
    const slug = this.generateSlug(createProductDto.name);

    // Check if slug exists
    const existingProduct = await this.productModel.findOne({ slug });
    if (existingProduct) {
      throw new ConflictException('Product with this name already exists');
    }

    // Prepare product data
    const productData: any = {
      ...createProductDto,
      slug,
    };

    // Process variants: remove temporary IDs and ensure proper structure
    if (createProductDto.variants && createProductDto.variants.length > 0) {
      productData.variants = createProductDto.variants.map((variant) => ({
        name: variant.name,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stock: variant.stock,
        sku: variant.sku,
        tags: variant.tags || [],
        isDefault: variant.isDefault || false,
      }));
    }

    // Process details: only store enabled sections with content
    if (createProductDto.details) {
      const processedDetails: any = {};
      
      if (createProductDto.details.whyChooseUs?.enabled && createProductDto.details.whyChooseUs?.content) {
        processedDetails.whyChooseUs = {
          title: createProductDto.details.whyChooseUs.title || null,
          content: createProductDto.details.whyChooseUs.content,
          enabled: true,
        };
      }
      
      if (createProductDto.details.keyBenefits?.enabled && createProductDto.details.keyBenefits?.content) {
        processedDetails.keyBenefits = {
          title: createProductDto.details.keyBenefits.title || null,
          content: createProductDto.details.keyBenefits.content,
          enabled: true,
        };
      }
      
      if (createProductDto.details.refundPolicy?.enabled && createProductDto.details.refundPolicy?.content) {
        processedDetails.refundPolicy = {
          title: createProductDto.details.refundPolicy.title || null,
          content: createProductDto.details.refundPolicy.content,
          enabled: true,
        };
      }

      if (Object.keys(processedDetails).length > 0) {
        productData.details = processedDetails;
      }
    }

    const product = await this.productModel.create(productData);

    // Invalidate cache
    await this.invalidateProductCache();

    // Transform image URLs
    return this.transformProductImages(product);
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
        isActive,
        sortBy = 'name',
        sortOrder = 'asc',
        gheeType,
        minWeight,
        maxWeight,
        minPurity,
        origin,
      } = filterDto;

      // Normalize and validate search string (minimum 2 characters)
      const search = rawSearch && rawSearch.trim().length >= 2 ? rawSearch.trim() : undefined;
      
      // Validate search length if provided
      if (rawSearch && rawSearch.trim().length > 0 && rawSearch.trim().length < 2) {
        throw new BadRequestException('Search query must be at least 2 characters long');
      }

    // Build cache key
    const cacheKey = `products:${JSON.stringify(filterDto)}`;

    // Try to get from cache (only if Redis is available)
    try {
      const cached: any = await this.redisService.get(cacheKey);
      if (cached) {
        // Transform image URLs in case cache has old format
        if (cached.items && Array.isArray(cached.items)) {
          cached.items = cached.items.map((item: any) => 
            this.transformProductImages(item)
          );
        }
        // Return in expected format
        return {
          success: true,
          message: 'Products retrieved successfully',
          data: cached,
        };
      }
    } catch (error) {
      // If Redis fails, continue without cache
      this.logger.warn('Redis cache error:', error.message);
    }

    // Build query
    const query: any = {};

    // Only filter by isActive if explicitly provided, otherwise default to true for public access
    if (isActive !== undefined) {
      query.isActive = isActive;
    } else {
      query.isActive = true; // Default to active products for public endpoints
    }

    // Enhanced search: Use text search if available (searches name, description, brand, tags, sku)
    if (search && search.trim().length >= 2) {
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

    // Ghee-specific filters
    if (gheeType) {
      query.gheeType = gheeType;
    }

    if (minWeight !== undefined || maxWeight !== undefined) {
      query.weight = {};
      if (minWeight !== undefined) {
        query.weight.$gte = minWeight;
      }
      if (maxWeight !== undefined) {
        query.weight.$lte = maxWeight;
      }
    }

    if (minPurity !== undefined) {
      query.purity = { $gte: minPurity };
    }

    if (origin) {
      query.origin = { $regex: origin, $options: 'i' };
    }

    // Build sort - validate sortBy field
    const validSortFields = ['name', 'price', 'rating', 'createdAt', 'salesCount', 'averageRating'];
    const actualSortBy = validSortFields.includes(sortBy || '') ? (sortBy || 'name') : 'name';
    
    // Map 'rating' to 'averageRating' for consistency
    const sortField = actualSortBy === 'rating' ? 'averageRating' : actualSortBy;
    
    const sort: any = {};
    // Only use textScore if we're actually doing a text search (prioritize relevance)
    if (search && search.trim().length >= 2) {
      sort.score = { $meta: 'textScore' };
      // Secondary sort by the requested field
      sort[sortField] = (sortOrder === 'asc' ? 1 : -1);
    } else {
      // No search: sort by the requested field
      sort[sortField] = (sortOrder === 'asc' ? 1 : -1);
    }
    
    // Ensure we have at least one sort field (fallback)
    if (Object.keys(sort).length === 0) {
      sort.name = 1;
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
        const productObj: any = product.toObject?.() || product;
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
      // If text search fails (e.g., no text index), fall back to enhanced regex search
      if (search && search.trim().length >= 2 && (error.message?.includes('text index') || error.message?.includes('$text'))) {
        // Fallback to regex search if text index doesn't exist
        delete query.$text;
        const searchRegex = new RegExp(search.trim(), 'i');
        
        // Find categories matching the search term
        let matchingCategoryIds: string[] = [];
        try {
          const matchingCategories = await this.categoryModel
            .find({ name: searchRegex })
            .select('_id')
            .lean()
            .exec();
          matchingCategoryIds = matchingCategories.map((cat: any) => String(cat._id));
        } catch (catError) {
          this.logger.warn('Error searching categories:', catError);
        }
        
        // Enhanced regex search across multiple fields
        query.$or = [
          { name: searchRegex },
          { description: searchRegex },
          { brand: searchRegex },
          { sku: searchRegex },
          { tags: { $in: [searchRegex] } },
        ];
        
        // Add category name search if categories found
        if (matchingCategoryIds.length > 0) {
          query.$or.push({ categoryId: { $in: matchingCategoryIds } });
        }
        
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

    // Transform image URLs for all products
    const transformedItems = (items || []).map((item: any) => 
      this.transformProductImages(item)
    );

    const result = {
      items: transformedItems,
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

    // Return in expected format (transform interceptor will handle wrapping if needed)
    return {
      success: true,
      message: 'Products retrieved successfully',
      data: result,
    };
    } catch (error) {
      this.logger.error(`Error in findAll: ${error.message}`, error.stack);
      
      // Re-throw BadRequestException as-is (for validation errors)
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      // Re-throw with more context for other errors
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to retrieve products. Please try again.`);
    }
  }

  async findOne(id: string) {
    const cacheKey = `product:${id}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        // Transform image URLs in case cache has old format
        return this.transformProductImages(cached);
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
    const productObj: any = product.toObject?.() || product;
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

    // Fetch approved reviews for this product
    const reviews = await this.reviewModel
      .find({
        productId: productObj._id,
        status: ReviewStatus.Approved,
      })
      .sort({ createdAt: -1 })
      .limit(10) // Limit to latest 10 reviews
      .populate('userId', 'firstName lastName email avatar')
      .select('rating comment userId isVerifiedPurchase createdAt updatedAt')
      .exec();

    // Add reviews to product object
    productObj.reviews = reviews;

    // Transform image URLs
    const transformedProduct = this.transformProductImages(productObj);

    // Cache for 10 minutes
    try {
      await this.redisService.set(cacheKey, transformedProduct, 600);
    } catch (error) {
      this.logger.warn('Redis cache error:', error.message);
    }

    return transformedProduct;
  }

  async findBySlug(slug: string) {
    const cacheKey = `product:slug:${slug}`;
    try {
      const cached = await this.redisService.get(cacheKey);
      if (cached) {
        // Transform image URLs in case cache has old format
        return this.transformProductImages(cached);
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
    const productObj: any = product.toObject?.() || product;
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

    // Fetch approved reviews for this product
    const reviews = await this.reviewModel
      .find({
        productId: productObj._id,
        status: ReviewStatus.Approved,
      })
      .sort({ createdAt: -1 })
      .limit(10) // Limit to latest 10 reviews
      .populate('userId', 'firstName lastName email avatar')
      .select('rating comment userId isVerifiedPurchase createdAt updatedAt')
      .exec();

    // Add reviews to product object
    productObj.reviews = reviews;

    // Transform image URLs
    const transformedProduct = this.transformProductImages(productObj);

    // Cache for 10 minutes
    try {
      await this.redisService.set(cacheKey, transformedProduct, 600);
    } catch (error) {
      this.logger.warn('Redis cache error:', error.message);
    }

    return transformedProduct;
  }

  async update(id: string, updateProductDto: UpdateProductDto) {
    const product = await this.productModel.findById(id);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Validate and process variants if provided
    if (updateProductDto.variants !== undefined) {
      if (Array.isArray(updateProductDto.variants) && updateProductDto.variants.length > 0) {
        this.validateVariants(updateProductDto.variants);
      }
    }

    // Validate and process details if provided
    if (updateProductDto.details !== undefined) {
      this.validateDetails(updateProductDto.details);
    }

    // Validate compareAtPrice >= price if both are provided
    const finalPrice =
      updateProductDto.price !== undefined
        ? updateProductDto.price
        : product.price;
    if (
      updateProductDto.compareAtPrice !== undefined &&
      updateProductDto.compareAtPrice < finalPrice
    ) {
      throw new BadRequestException(
        'compareAtPrice must be greater than or equal to price',
      );
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

    // Prepare update data
    const updateData: any = { ...updateProductDto };

    // Process variants: if provided, replace all existing variants
    if (updateProductDto.variants !== undefined) {
      if (Array.isArray(updateProductDto.variants) && updateProductDto.variants.length > 0) {
        // Process and replace variants
        updateData.variants = updateProductDto.variants.map((variant) => ({
          name: variant.name,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          stock: variant.stock,
          sku: variant.sku,
          tags: variant.tags || [],
          isDefault: variant.isDefault || false,
        }));
      } else {
        // Empty array means remove all variants
        updateData.variants = [];
      }
    }
    // If variants is not provided, keep existing variants (don't include in updateData)

    // Process details: if provided, replace all existing details
    if (updateProductDto.details !== undefined) {
      const processedDetails: any = {};
      
      if (updateProductDto.details.whyChooseUs?.enabled && updateProductDto.details.whyChooseUs?.content) {
        processedDetails.whyChooseUs = {
          title: updateProductDto.details.whyChooseUs.title || null,
          content: updateProductDto.details.whyChooseUs.content,
          enabled: true,
        };
      }
      
      if (updateProductDto.details.keyBenefits?.enabled && updateProductDto.details.keyBenefits?.content) {
        processedDetails.keyBenefits = {
          title: updateProductDto.details.keyBenefits.title || null,
          content: updateProductDto.details.keyBenefits.content,
          enabled: true,
        };
      }
      
      if (updateProductDto.details.refundPolicy?.enabled && updateProductDto.details.refundPolicy?.content) {
        processedDetails.refundPolicy = {
          title: updateProductDto.details.refundPolicy.title || null,
          content: updateProductDto.details.refundPolicy.content,
          enabled: true,
        };
      }

      // If no enabled sections, set to empty object (removes all details)
      updateData.details = Object.keys(processedDetails).length > 0 ? processedDetails : {};
    }
    // If details is not provided, keep existing details (don't include in updateData)

    const updatedProduct = await this.productModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    // Invalidate cache
    await this.invalidateProductCache(id);

    // Transform image URLs
    return this.transformProductImages(updatedProduct);
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

  private validateVariants(variants: any[]) {
    if (!variants || variants.length === 0) {
      return;
    }

    // Check that at least one variant is default
    const hasDefault = variants.some((v) => v.isDefault === true);
    if (!hasDefault) {
      // Auto-set first variant as default if none is set
      variants[0].isDefault = true;
    }

    // Check for unique variant names
    const variantNames = variants.map((v) => v.name);
    const uniqueNames = new Set(variantNames);
    if (variantNames.length !== uniqueNames.size) {
      throw new BadRequestException('Variant names must be unique within a product');
    }

    // Validate each variant
    for (const variant of variants) {
      if (!variant.name || variant.name.trim() === '') {
        throw new BadRequestException('Variant name is required');
      }

      if (variant.price === undefined || variant.price === null || variant.price <= 0) {
        throw new BadRequestException('Variant price must be a positive number');
      }

      if (variant.stock === undefined || variant.stock === null || variant.stock < 0) {
        throw new BadRequestException('Variant stock must be a non-negative number');
      }

      if (variant.compareAtPrice !== undefined && variant.compareAtPrice !== null) {
        if (variant.compareAtPrice < variant.price) {
          throw new BadRequestException(
            `Variant "${variant.name}": compareAtPrice must be greater than or equal to price`,
          );
        }
      }

      // Validate tags if provided
      if (variant.tags && Array.isArray(variant.tags)) {
        const allowedTags = ['BEST SELLER', 'MONEY SAVER'];
        const invalidTags = variant.tags.filter((tag: string) => !allowedTags.includes(tag));
        if (invalidTags.length > 0) {
          throw new BadRequestException(
            `Invalid variant tags: ${invalidTags.join(', ')}. Allowed tags: ${allowedTags.join(', ')}`,
          );
        }
      }
    }
  }

  private validateDetails(details: any) {
    if (!details) {
      return;
    }

    const sections = ['whyChooseUs', 'keyBenefits', 'refundPolicy'];
    
    for (const sectionKey of sections) {
      const section = details[sectionKey];
      if (section && section.enabled) {
        if (!section.content || section.content.trim() === '') {
          throw new BadRequestException(
            `${sectionKey}: content is required when section is enabled`,
          );
        }
      }
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private transformImageUrl(imagePath: string, folder: string = 'products'): string {
    if (!imagePath) {
      return imagePath;
    }

    // If it's already a Cloudinary URL, return it as-is
    if (imagePath.includes('res.cloudinary.com') || imagePath.startsWith('https://res.cloudinary.com')) {
      return imagePath;
    }

    // If it's already a full URL (but not Cloudinary), return it as-is
    // This handles old local URLs that are still in the database
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Old local file URLs will be broken, but we return them as-is
      // The frontend can handle broken images or the user needs to re-upload
      return imagePath;
    }

    // If it's just a filename or relative path, it's likely an old local file reference
    // Since we're using Cloudinary now, we can't serve these files
    // Return as-is (will be broken, but that's expected for old data)
    // In production, you might want to return a placeholder image instead
    console.warn(`⚠️  Old local file reference detected: ${imagePath}. Please re-upload this image to Cloudinary.`);
    return imagePath;
  }

  private transformProductImages(product: any): any {
    if (!product) {
      return product;
    }

    const productObj = product.toObject ? product.toObject() : product;
    
    // Transform images array
    if (productObj.images && Array.isArray(productObj.images)) {
      productObj.images = productObj.images.map((img: string) => 
        this.transformImageUrl(img, 'products')
      );
    }

    return productObj;
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

