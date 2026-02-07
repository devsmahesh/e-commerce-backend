import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FlashDealDocument = FlashDeal & Document;

export enum FlashDealType {
  Discount = 'discount',
  Shipping = 'shipping',
  NewArrival = 'new_arrival',
  Custom = 'custom',
}

export enum ButtonVariant {
  Default = 'default',
  Outline = 'outline',
}

@Schema({ timestamps: true })
export class FlashDeal {
  @Prop({ required: true, trim: true, minlength: 3, maxlength: 100 })
  title: string;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 500 })
  description: string;

  @Prop({
    type: String,
    enum: FlashDealType,
    required: true,
    index: true,
  })
  type: FlashDealType;

  @Prop({
    type: Number,
    min: 0,
    max: 100,
    validate: {
      validator: function (value: number | undefined) {
        if (this.type === FlashDealType.Discount && value === undefined) {
          return false;
        }
        return true;
      },
      message: 'discountPercentage is required when type is discount',
    },
  })
  discountPercentage?: number;

  @Prop({ type: Number, min: 0, default: 0 })
  minPurchaseAmount: number;

  @Prop({ type: String, trim: true, default: '' })
  link: string;

  @Prop({ type: String, trim: true, maxlength: 50 })
  buttonText?: string;

  @Prop({
    type: String,
    enum: ButtonVariant,
    default: ButtonVariant.Default,
  })
  buttonVariant: ButtonVariant;

  @Prop({ type: Boolean, default: true, index: true })
  active: boolean;

  @Prop({ type: Date, required: true, index: true })
  startDate: Date;

  @Prop({
    type: Date,
    required: true,
    index: true,
    validate: {
      validator: function (value: Date) {
        return value > this.startDate;
      },
      message: 'endDate must be after startDate',
    },
  })
  endDate: Date;

  @Prop({ type: Number, default: 0, index: true })
  priority: number;
}

export const FlashDealSchema = SchemaFactory.createForClass(FlashDeal);

// Indexes for performance
FlashDealSchema.index({ active: 1, startDate: 1, endDate: 1 });
FlashDealSchema.index({ type: 1, active: 1 });
FlashDealSchema.index({ priority: -1, createdAt: -1 });

