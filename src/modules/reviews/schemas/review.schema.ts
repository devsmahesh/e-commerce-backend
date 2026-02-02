import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum ReviewStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
}

export type ReviewDocument = Review & Document;

@Schema({ timestamps: true })
export class Review {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    type: Number,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: 'Rating must be an integer between 1 and 5',
    },
  })
  rating: number;

  @Prop({
    required: true,
    trim: true,
    maxlength: 1000,
  })
  comment: string;

  @Prop({
    type: String,
    enum: ReviewStatus,
    default: ReviewStatus.Approved,
    index: true,
  })
  status: ReviewStatus;

  @Prop({ default: false })
  isVerifiedPurchase: boolean;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

// Indexes
ReviewSchema.index({ productId: 1 });
ReviewSchema.index({ userId: 1 });
ReviewSchema.index({ productId: 1, userId: 1 }, { unique: true });
ReviewSchema.index({ status: 1 });
ReviewSchema.index({ productId: 1, status: 1 });

