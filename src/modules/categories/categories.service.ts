import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from './schemas/category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    // Generate slug from name
    const slug = this.generateSlug(createCategoryDto.name);

    // Check if slug exists
    const existingCategory = await this.categoryModel.findOne({ slug });
    if (existingCategory) {
      throw new ConflictException('Category with this name already exists');
    }

    const category = await this.categoryModel.create({
      ...createCategoryDto,
      slug,
    });

    return category;
  }

  async findAll(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
    }

    return this.categoryModel
      .find(query)
      .sort({ order: 1, name: 1 })
      .populate('parentId', 'name slug')
      .exec();
  }

  async findOne(id: string) {
    const category = await this.categoryModel
      .findById(id)
      .populate('parentId', 'name slug')
      .exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findBySlug(slug: string) {
    const category = await this.categoryModel
      .findOne({ slug })
      .populate('parentId', 'name slug')
      .exec();

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // If name is being updated, regenerate slug
    if (updateCategoryDto.name && updateCategoryDto.name !== category.name) {
      const newSlug = this.generateSlug(updateCategoryDto.name);
      const existingCategory = await this.categoryModel.findOne({
        slug: newSlug,
        _id: { $ne: id },
      });

      if (existingCategory) {
        throw new ConflictException('Category with this name already exists');
      }

      (updateCategoryDto as any).slug = newSlug;
    }

    const updatedCategory = await this.categoryModel.findByIdAndUpdate(
      id,
      { $set: updateCategoryDto },
      { new: true, runValidators: true },
    );

    return updatedCategory;
  }

  async remove(id: string) {
    const category = await this.categoryModel.findById(id);
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // Check if category has products
    // This would require Product model - for now, just delete
    await this.categoryModel.findByIdAndDelete(id);

    return { message: 'Category deleted successfully' };
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

