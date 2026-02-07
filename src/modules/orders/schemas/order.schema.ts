import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';

export type OrderDocument = Order & Document;

export enum OrderStatus {
  Pending = 'pending',
  Paid = 'paid',
  Processing = 'processing',
  Shipped = 'shipped',
  Delivered = 'delivered',
  Cancelled = 'cancelled',
  Refunded = 'refunded',
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  image: string;

  @Prop({ required: true, min: 1 })
  quantity: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  total: number;
}

export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ _id: false })
export class ShippingAddress {
  @Prop({ required: true })
  street: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  state: string;

  @Prop({ required: true })
  zipCode: string;

  @Prop({ required: true })
  country: string;
}

export const ShippingAddressSchema = SchemaFactory.createForClass(ShippingAddress);

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  orderNumber: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ type: ShippingAddressSchema, required: true })
  shippingAddress: ShippingAddress;

  @Prop({ required: true, min: 0 })
  subtotal: number;

  @Prop({ default: 0, min: 0 })
  shippingCost: number;

  @Prop({ default: 0, min: 0 })
  tax: number;

  @Prop({ default: 0, min: 0 })
  discount: number;

  @Prop({ type: String, ref: 'Coupon' })
  couponId?: string;

  @Prop()
  couponCode?: string;

  @Prop({ required: true, min: 0 })
  total: number; // Total in rupees (for display/legacy)

  /**
   * Payment amount in paise (smallest currency unit).
   * This is the source of truth for payment amounts.
   * Razorpay amounts are always in paise.
   */
  @Prop({ required: true, min: 0 })
  amount: number; // Amount in paise

  /**
   * Currency code (e.g., 'INR').
   * Defaults to INR for Indian payments.
   */
  @Prop({ default: 'INR' })
  currency: string;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.Pending })
  status: OrderStatus;

  @Prop()
  paymentIntentId?: string;

  @Prop()
  paymentMethod?: string;

  /**
   * Razorpay Order ID (order_xxx)
   * Created when initiating payment with Razorpay.
   */
  @Prop({ index: true })
  razorpayOrderId?: string;

  /**
   * Razorpay Payment ID (pay_xxx)
   * Received after successful payment capture.
   */
  @Prop({ index: true })
  razorpayPaymentId?: string;

  /**
   * Razorpay payment signature for verification.
   * Used to verify payment authenticity.
   */
  @Prop()
  razorpaySignature?: string;

  /**
   * Payment status following fintech best practices.
   * Database is source of truth, webhooks confirm final state.
   */
  @Prop({ 
    type: String, 
    enum: PaymentStatus, 
    default: PaymentStatus.PENDING,
    index: true,
  })
  paymentStatus: PaymentStatus;

  @Prop()
  paymentGateway?: string;

  /**
   * Timestamp when payment was successfully captured.
   * Set only after webhook confirmation.
   */
  @Prop()
  paidAt?: Date;

  @Prop({ trim: true, maxlength: 100 })
  trackingNumber?: string;

  @Prop()
  shippedAt?: Date;

  @Prop()
  deliveredAt?: Date;

  @Prop()
  cancelledAt?: Date;

  @Prop()
  cancellationReason?: string;

  /**
   * Razorpay Refund ID (rfnd_xxx)
   * Stored after successful refund creation.
   */
  @Prop()
  refundId?: string;

  @Prop({ type: String, enum: ['processed', 'pending', 'failed'] })
  refundStatus?: 'processed' | 'pending' | 'failed';

  /**
   * Refund amount in paise.
   * Must match Razorpay refund amount.
   */
  @Prop({ min: 0 })
  refundAmount?: number; // Amount in paise

  @Prop()
  refundedAt?: Date;

  @Prop()
  refundError?: string;

  /**
   * Number of payment attempts.
   * Tracks failed payment attempts for fraud detection.
   */
  @Prop({ default: 0, min: 0 })
  paymentAttempts: number;

  /**
   * Additional payment metadata.
   * Stores payment method details, gateway responses, etc.
   */
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes
OrderSchema.index({ userId: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ razorpayOrderId: 1 });
OrderSchema.index({ razorpayPaymentId: 1 });
OrderSchema.index({ paymentStatus: 1 });

