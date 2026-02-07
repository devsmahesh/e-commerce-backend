import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

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
  total: number;

  @Prop({ type: String, enum: OrderStatus, default: OrderStatus.Pending })
  status: OrderStatus;

  @Prop()
  paymentIntentId?: string;

  @Prop()
  paymentMethod?: string;

  @Prop()
  razorpayOrderId?: string;

  @Prop()
  razorpayPaymentId?: string;

  @Prop({ type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' })
  paymentStatus?: 'pending' | 'paid' | 'failed' | 'refunded';

  @Prop()
  paymentGateway?: string;

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

  @Prop()
  refundId?: string;

  @Prop({ type: String, enum: ['processed', 'pending', 'failed'] })
  refundStatus?: 'processed' | 'pending' | 'failed';

  @Prop({ min: 0 })
  refundAmount?: number;

  @Prop()
  refundedAt?: Date;

  @Prop()
  refundError?: string;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// Indexes
OrderSchema.index({ userId: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

