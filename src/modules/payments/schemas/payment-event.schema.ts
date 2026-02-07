import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PaymentEventDocument = PaymentEvent & Document;

/**
 * PaymentEvent Schema
 * 
 * Stores Razorpay webhook events for idempotency.
 * Ensures each event is processed only once.
 */
@Schema({ timestamps: true })
export class PaymentEvent {
  @Prop({ required: true, unique: true, index: true })
  eventId: string; // Razorpay event.id

  @Prop({ required: true, index: true })
  type: string; // e.g., 'payment.captured', 'payment.failed', 'refund.processed'

  @Prop({ type: Object, required: true })
  payload: Record<string, any>; // Full webhook payload

  @Prop({ default: false, index: true })
  processed: boolean; // Whether this event has been processed

  @Prop()
  processedAt?: Date; // When the event was processed

  @Prop()
  error?: string; // Error message if processing failed

  @Prop({ type: Number })
  retryCount?: number; // Number of retry attempts
}

export const PaymentEventSchema = SchemaFactory.createForClass(PaymentEvent);

// Compound index for efficient querying
PaymentEventSchema.index({ processed: 1, createdAt: -1 });

