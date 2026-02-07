import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

/**
 * RazorpayService
 * 
 * Production-grade Razorpay payment gateway integration.
 * 
 * Key principles:
 * - All amounts handled in paise (integers)
 * - Never trust client-provided amounts
 * - Proper error handling and validation
 * - Structured exception messages
 */
@Injectable()
export class RazorpayService implements OnModuleInit {
  private readonly logger = new Logger(RazorpayService.name);
  private razorpay: Razorpay;
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string | undefined;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Validate required credentials at startup
    if (!this.keyId || !this.keySecret) {
      throw new Error(
        'RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured in environment variables',
      );
    }

    this.razorpay = new Razorpay({
      key_id: this.keyId,
      key_secret: this.keySecret,
    });
  }

  /**
   * Validate configuration on module initialization.
   */
  onModuleInit() {
    this.logger.log('RazorpayService initialized');
    if (!this.webhookSecret) {
      this.logger.warn(
        'RAZORPAY_WEBHOOK_SECRET not configured. Webhook signature verification will fail.',
      );
    }
  }

  /**
   * Create a Razorpay order.
   * 
   * @param data - Order creation data
   * @param data.amount - Amount in paise (integer, minimum 100 paise = ₹1)
   * @param data.currency - Currency code (default: 'INR')
   * @param data.receipt - Receipt identifier
   * @param data.notes - Additional metadata
   * @returns Razorpay order object
   * 
   * @throws BadRequestException if order creation fails
   */
  async createOrder(data: {
    amount: number; // Must be in paise
    currency?: string;
    receipt?: string;
    notes?: Record<string, string>;
  }) {
    // Validate amount (must be integer in paise, minimum ₹1 = 100 paise)
    if (!Number.isInteger(data.amount) || data.amount < 100) {
      throw new BadRequestException(
        'Amount must be an integer in paise and at least 100 paise (₹1)',
      );
    }

    // Validate currency
    const currency = (data.currency || 'INR').toUpperCase();
    if (currency !== 'INR') {
      this.logger.warn(`Non-INR currency requested: ${currency}`);
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: data.amount, // Already in paise
        currency: currency,
        receipt: data.receipt,
        notes: data.notes || {},
      });

      this.logger.log(`Razorpay order created: ${order.id}`);
      return order;
    } catch (error: any) {
      const errorMessage = this.extractRazorpayErrorMessage(error);
      this.logger.error(`Failed to create Razorpay order: ${errorMessage}`, error);
      throw new BadRequestException(`Failed to create Razorpay order: ${errorMessage}`);
    }
  }

  /**
   * Verify payment signature using HMAC SHA256.
   * 
   * Security: This verifies that the payment response came from Razorpay.
   * 
   * @param razorpay_order_id - Razorpay order ID
   * @param razorpay_payment_id - Razorpay payment ID
   * @param razorpay_signature - Signature provided by Razorpay
   * @returns true if signature is valid, false otherwise
   * 
   * @throws Error if key secret is not configured
   */
  verifyPaymentSignature(
    razorpay_order_id: string,
    razorpay_payment_id: string,
    razorpay_signature: string,
  ): boolean {
    if (!this.keySecret) {
      throw new Error('RAZORPAY_KEY_SECRET is not configured');
    }

    // Razorpay signature verification format: order_id|payment_id
    const text = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', this.keySecret)
      .update(text)
      .digest('hex');

    const isValid = generated_signature === razorpay_signature;

    if (!isValid) {
      this.logger.warn(
        `Payment signature verification failed for order: ${razorpay_order_id}`,
      );
    }

    return isValid;
  }

  /**
   * Verify webhook signature using HMAC SHA256.
   * 
   * Security: This verifies that the webhook came from Razorpay.
   * 
   * @param body - Raw webhook body (string)
   * @param signature - Signature from x-razorpay-signature header
   * @returns true if signature is valid, false otherwise
   * 
   * @throws Error if webhook secret is not configured
   */
  verifyWebhookSignature(body: string | any, signature: string): boolean {
    if (!this.webhookSecret) {
      throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
    }

    // If body is already a string (raw body), use it directly
    // Otherwise, stringify it (for backward compatibility)
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    
    const generatedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(text)
      .digest('hex');

    const isValid = generatedSignature === signature;

    if (!isValid) {
      this.logger.warn('Webhook signature verification failed');
    }

    return isValid;
  }

  /**
   * Fetch payment details from Razorpay API.
   * 
   * @param paymentId - Razorpay payment ID (pay_xxx)
   * @returns Payment object from Razorpay
   * 
   * @throws BadRequestException if payment fetch fails
   */
  async fetchPayment(paymentId: string) {
    if (!paymentId || !paymentId.startsWith('pay_')) {
      throw new BadRequestException(`Invalid payment ID format: ${paymentId}`);
    }

    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error: any) {
      const errorMessage = this.extractRazorpayErrorMessage(error);
      this.logger.error(`Failed to fetch payment ${paymentId}: ${errorMessage}`, error);
      throw new BadRequestException(`Failed to fetch payment: ${errorMessage}`);
    }
  }

  /**
   * Fetch order details from Razorpay API.
   * 
   * @param orderId - Razorpay order ID (order_xxx)
   * @returns Order object from Razorpay
   * 
   * @throws BadRequestException if order fetch fails
   */
  async fetchOrder(orderId: string) {
    if (!orderId || !orderId.startsWith('order_')) {
      throw new BadRequestException(`Invalid order ID format: ${orderId}`);
    }

    try {
      const order = await this.razorpay.orders.fetch(orderId);
      return order;
    } catch (error: any) {
      const errorMessage = this.extractRazorpayErrorMessage(error);
      this.logger.error(`Failed to fetch order ${orderId}: ${errorMessage}`, error);
      throw new BadRequestException(`Failed to fetch order: ${errorMessage}`);
    }
  }

  /**
   * Create a refund for a payment.
   * 
   * @param paymentId - Razorpay payment ID (pay_xxx)
   * @param data - Refund data
   * @param data.amount - Refund amount in paise (optional, for partial refunds)
   * @param data.notes - Additional refund notes
   * @returns Razorpay refund object
   * 
   * @throws BadRequestException if refund creation fails
   */
  async createRefund(
    paymentId: string,
    data: {
      amount?: number; // Amount in paise (for partial refunds)
      notes?: Record<string, string>;
    },
  ) {
    if (!paymentId || !paymentId.startsWith('pay_')) {
      throw new BadRequestException(`Invalid payment ID format: ${paymentId}`);
    }

    const refundData: any = {};

    // If amount is provided, validate and include it (for partial refunds)
    if (data.amount !== undefined) {
      if (!Number.isInteger(data.amount) || data.amount <= 0) {
        throw new BadRequestException(
          'Refund amount must be a positive integer in paise',
        );
      }
      refundData.amount = data.amount; // Already in paise
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

    try {
      this.logger.log(`Creating refund for payment ${paymentId}`, {
        paymentId,
        refundData: JSON.stringify(refundData),
      });

      const refund = await this.razorpay.payments.refund(paymentId, refundData);
      
      this.logger.log(`Refund created successfully: ${refund.id}`);
      return refund;
    } catch (error: any) {
      const errorMessage = this.extractRazorpayErrorMessage(error);
      this.logger.error(
        `Failed to create refund for payment ${paymentId}: ${errorMessage}`,
        error,
      );
      throw new BadRequestException(`Failed to create refund: ${errorMessage}`);
    }
  }

  /**
   * Extract error message from Razorpay API error.
   * 
   * Razorpay errors have a nested structure: error.error.description
   */
  private extractRazorpayErrorMessage(error: any): string {
    if (error.error) {
      // Razorpay API error structure
      return (
        error.error.description ||
        error.error.message ||
        JSON.stringify(error.error)
      );
    } else if (error.message) {
      return error.message;
    } else if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }

  /**
   * Convert rupees to paise.
   * 
   * @param rupees - Amount in rupees
   * @returns Amount in paise (integer)
   */
  static rupeesToPaise(rupees: number): number {
    return Math.round(rupees * 100);
  }

  /**
   * Convert paise to rupees.
   * 
   * @param paise - Amount in paise
   * @returns Amount in rupees
   */
  static paiseToRupees(paise: number): number {
    return paise / 100;
  }
}
