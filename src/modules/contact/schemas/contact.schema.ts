import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ContactDocument = Contact & Document;

export enum ContactStatus {
  Pending = 'pending',
  Read = 'read',
  Replied = 'replied',
  Archived = 'archived',
}

@Schema({ timestamps: true })
export class Contact {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 100 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true, maxlength: 255 })
  email: string;

  @Prop({ required: true, trim: true })
  phone: string;

  @Prop({ required: true, trim: true, minlength: 3, maxlength: 200 })
  subject: string;

  @Prop({ required: true, trim: true, minlength: 10, maxlength: 5000 })
  message: string;

  @Prop({
    type: String,
    enum: ContactStatus,
    default: ContactStatus.Pending,
  })
  status: ContactStatus;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ type: Date })
  repliedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  repliedBy?: Types.ObjectId;

  @Prop({ maxlength: 1000 })
  notes?: string;

  // Timestamps are automatically added by Mongoose when timestamps: true
  createdAt?: Date;
  updatedAt?: Date;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);

// Indexes for faster queries
ContactSchema.index({ email: 1, createdAt: -1 });
ContactSchema.index({ status: 1, createdAt: -1 });
ContactSchema.index({ createdAt: -1 });

