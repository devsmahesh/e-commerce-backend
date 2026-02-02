import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  slug: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String] })
  images: string[];

  @Prop({ required: true, type: Number, min: 0 })
  price: number;

  @Prop({ type: Number, min: 0 })
  compareAtPrice?: number;

  @Prop({ required: true, type: Number, min: 0 })
  stock: number;

  @Prop({ type: String, ref: 'Category', required: true })
  categoryId: string;

  @Prop({ type: [String], ref: 'Category' })
  tags?: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isFeatured: boolean;

  @Prop({ type: Number, default: 0, min: 0, max: 5 })
  averageRating: number;

  @Prop({ type: Number, default: 0 })
  reviewCount: number;

  @Prop({ type: Number, default: 0 })
  salesCount: number;

  @Prop({ type: Object })
  specifications?: Record<string, any>;

  @Prop({ type: Object })
  variants?: Record<string, any>;

  @Prop()
  sku?: string;

  @Prop({ default: 0 })
  weight?: number;

  @Prop()
  dimensions?: string;

  // Ghee-specific fields
  @Prop({ type: String, enum: ['cow', 'buffalo', 'mixed'] })
  gheeType?: 'cow' | 'buffalo' | 'mixed';

  @Prop({ type: Number, min: 0, max: 100 })
  purity?: number;

  @Prop()
  origin?: string;

  @Prop()
  shelfLife?: string;

  @Prop()
  brand?: string;
}

export const ProductSchema = SchemaFactory.createForClass(Product);

// Indexes
ProductSchema.index({ slug: 1 });
ProductSchema.index({ categoryId: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isFeatured: 1 });
ProductSchema.index({ price: 1 });
ProductSchema.index({ averageRating: -1 });
ProductSchema.index({ name: 'text', description: 'text' });
// Ghee-specific indexes
ProductSchema.index({ gheeType: 1 });
ProductSchema.index({ weight: 1 });
ProductSchema.index({ purity: 1 });
ProductSchema.index({ origin: 1 });

