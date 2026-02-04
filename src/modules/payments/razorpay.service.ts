import { Injectable, BadRequestException } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

@Injectable()
export class RazorpayService {
  private razorpay: Razorpay;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured');
    }

    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }

  async createOrder(data: {
    amount: number;
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
  }) {
    try {
      const order = await this.razorpay.orders.create({
        amount: data.amount,
        currency: data.currency || 'INR',
        receipt: data.receipt,
        notes: data.notes,
      });
      return order;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to create Razorpay order: ${error.message || 'Unknown error'}`,
      );
    }
  }

  verifyPayment(
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
  ): boolean {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured');
    }

    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    return generated_signature === razorpay_signature;
  }

  verifyWebhookSignature(body: string | any, signature: string): boolean {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
    }

    // If body is already a string (raw body), use it directly
    // Otherwise, stringify it (for backward compatibility)
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(text)
      .digest('hex');

    return generatedSignature === signature;
  }

  async fetchPayment(paymentId: string) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to fetch payment: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async fetchOrder(orderId: string) {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      return order;
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to fetch order: ${error.message || 'Unknown error'}`,
      );
    }
  }
}

