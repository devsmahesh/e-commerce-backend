import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { Category, CategoryDocument } from './schemas/category.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoriesQueryDto } from './dto/categories-query.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private configService: ConfigService,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Check if slug already exists
    const existingCategory = await this.categoryModel.findOne({
      slug: createCategoryDto.slug,
    });
    if (existingCategory) {
      throw new ConflictException('Category with this slug already exists');
    }

    // Validate parent if provided
    if (createCategoryDto.parentId) {
      const parent = await this.categoryModel.findById(
        createCategoryDto.parentId,
      );
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const category = await this.categoryModel.create({
      ...createCategoryDto,
      isActive:
        createCategoryDto.isActive !== undefined
          ? createCategoryDto.isActive
          : true,
    });

    // Transform image URL
    return this.transformCategoryImage(category);
  }

  async findAll(query: CategoriesQueryDto) {
    const filter: any = {};
    if (!query.includeInactive) {
      filter.isActive = true;
    }

    const categories = await this.categoryModel
      .find(filter)
      .sort({ name: 1 })
      .populate('parentId', 'name slug')
      .exec();

    // Transform image URLs for all categories
    return categories.map((category: any) => this.transformCategoryImage(category));
  }

  async findOne(id: string) {
    const category = await this.categoryModel
      .findById(id)
      .populate('parentId', 'name slug')
      .exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Transform image URL
    return this.transformCategoryImage(category);
  }

  async findBySlug(slug: string) {
    const category = await this.categoryModel
      .findOne({ slug })
      .populate('parentId', 'name slug')
      .exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Transform image URL
    return this.transformCategoryImage(category);
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check slug uniqueness if slug is being updated
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const existingCategory = await this.categoryModel.findOne({
        slug: updateCategoryDto.slug,
        _id: { $ne: id },
      });
      if (existingCategory) {
        throw new ConflictException('Category with this slug already exists');
      }
    }

    // Prevent circular references
    if (updateCategoryDto.parentId) {
      if (updateCategoryDto.parentId === id) {
        throw new BadRequestException('Category cannot be its own parent');
      }
      // Check if parent is a descendant (prevent circular hierarchy)
      const isDescendant = await this.isDescendant(
        id,
        updateCategoryDto.parentId,
      );
      if (isDescendant) {
        throw new BadRequestException(
          'Cannot set parent: would create circular reference',
        );
      }
    }

    const updatedCategory = await this.categoryModel.findByIdAndUpdate(
      id,
      { $set: updateCategoryDto },
      { new: true, runValidators: true },
    );

    // Transform image URL
    return this.transformCategoryImage(updatedCategory);
  }

  async remove(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check for associated products
    const productCount = await this.productModel.countDocuments({
      categoryId: id,
    });

    if (productCount > 0) {
      throw new BadRequestException(
        `Cannot delete category. It has ${productCount} associated product(s). Please reassign or delete products first.`,
      );
    }

    await this.categoryModel.findByIdAndDelete(id);

    return { message: 'Category deleted successfully' };
  }

  private async isDescendant(
    categoryId: string,
    potentialParentId: string,
  ): Promise<boolean> {
    // Recursive check to prevent circular references
    let current = await this.categoryModel.findById(categoryId);

    while (current?.parentId) {
      if (String(current.parentId) === potentialParentId) {
        return true;
      }
      current = await this.categoryModel.findById(current.parentId);
    }

    return false;
  }

  private transformImageUrl(imagePath: string, folder: string = 'categories'): string {
    if (!imagePath) {
      return imagePath;
    }

    // Extract filename from path (handles both full URLs and relative paths)
    let filename: string;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      // Extract filename from full URL
      const urlParts = imagePath.split('/');
      filename = urlParts[urlParts.length - 1] || imagePath;
    } else {
      // Extract filename from relative path
      filename = imagePath.includes('/') ? (imagePath.split('/').pop() || imagePath) : imagePath;
    }
    
    // Get base URL - use BACKEND_URL from env or config
    let apiUrl = process.env.BACKEND_URL || this.configService.get<string>('BACKEND_URL');
    if (!apiUrl) {
      const port = process.env.PORT || 3000;
      apiUrl = `http://localhost:${port}`;
    }
    
    // Return full URL: baseurl/uploads/folder/filename
    return `${apiUrl}/uploads/${folder}/${filename}`;
  }

  private transformCategoryImage(category: any): any {
    if (!category) {
      return category;
    }

    const categoryObj = category.toObject ? category.toObject() : category;
    
    // Transform image field
    if (categoryObj.image) {
      categoryObj.image = this.transformImageUrl(categoryObj.image, 'categories');
    }

    return categoryObj;
  }
}
