import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CouponDocument = Coupon & Document;

export enum CouponType {
  Percentage = 'percentage',
  Fixed = 'fixed',
}

@Schema({ timestamps: true })
export class Coupon {
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, enum: CouponType, required: true })
  type: CouponType;

  @Prop({ required: true, min: 0 })
  value: number;

  @Prop({ required: true, min: 0 })
  minPurchase: number;

  @Prop()
  maxDiscount?: number;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  usageLimit: number;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: [String] })
  applicableCategories?: string[];
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Indexes
CouponSchema.index({ code: 1 });
CouponSchema.index({ expiresAt: 1 });
CouponSchema.index({ isActive: 1 });

