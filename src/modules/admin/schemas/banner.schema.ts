import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BannerDocument = Banner & Document;

@Schema({ timestamps: true })
export class Banner {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  image: string;

  @Prop()
  link?: string;

  @Prop({ required: true })
  position: string;

  @Prop({ default: true })
  active: boolean;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  description?: string;
}

export const BannerSchema = SchemaFactory.createForClass(Banner);

// Indexes
BannerSchema.index({ position: 1 });
BannerSchema.index({ active: 1 });
BannerSchema.index({ startDate: 1, endDate: 1 });

