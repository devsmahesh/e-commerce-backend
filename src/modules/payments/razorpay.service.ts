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

  async createRefund(paymentId: string, data: {
    amount?: number;
    notes?: Record<string, string>;
  }) {
    try {
      const refundData: any = {};
      
      // If amount is provided, include it (for partial refunds)
      // Amount should be in paise (smallest currency unit) and must be an integer
      if (data.amount !== undefined && data.amount > 0) {
        refundData.amount = Math.round(data.amount * 100); // Convert rupees to paise
      }

      // Only include notes if they exist and are not empty
      // Razorpay requires notes values to be strings
      if (data.notes && Object.keys(data.notes).length > 0) {
        // Convert all note values to strings (Razorpay requirement)
        const stringNotes: Record<string, string> = {};
        for (const [key, value] of Object.entries(data.notes)) {
          stringNotes[key] = String(value);
        }
        refundData.notes = stringNotes;
      }

      // Log the refund request for debugging
      console.log('Razorpay refund request:', {
        paymentId,
        refundData: JSON.stringify(refundData),
      });

      const refund = await this.razorpay.payments.refund(paymentId, refundData);
      return refund;
    } catch (error: any) {
      // Razorpay errors have a nested structure: error.error.description
      let errorMessage = 'Unknown error';
      
      if (error.error) {
        // Razorpay API error structure
        errorMessage = error.error.description || error.error.message || JSON.stringify(error.error);
      } else if (error.message) {
        // Standard error message
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Log full error for debugging
      console.error('Razorpay refund error:', JSON.stringify(error, null, 2));

      throw new BadRequestException(
        `Failed to create refund: ${errorMessage}`,
      );
    }
  }
}

