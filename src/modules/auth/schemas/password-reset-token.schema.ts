import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PasswordResetTokenDocument = PasswordResetToken & Document;

@Schema({ timestamps: true })
export class PasswordResetToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  token: string;

  @Prop({ required: true, index: true })
  expiresAt: Date;

  @Prop({ default: false, index: true })
  used: boolean;

  @Prop()
  usedAt?: Date;
}

export const PasswordResetTokenSchema =
  SchemaFactory.createForClass(PasswordResetToken);

// Compound index for efficient queries
PasswordResetTokenSchema.index({ userId: 1, used: 1, expiresAt: 1 });

// TTL index for automatic cleanup of expired tokens (optional, MongoDB will handle this)
// Note: MongoDB TTL indexes only work on Date fields, so we'll handle cleanup manually

