import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { OrdersService } from '../orders/orders.service';
import { OrderStatus, OrderItem } from '../orders/schemas/order.schema';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    private ordersService: OrdersService,
  ) {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(
      stripeKey,
      {
        apiVersion: '2023-10-16',
      },
    );
  }

  async createCheckoutSession(orderId: string, successUrl: string, cancelUrl: string) {
    const order = await this.ordersService.findOne(orderId);

    if (order.status !== OrderStatus.Pending) {
      throw new BadRequestException('Order is not in pending status');
    }

    const lineItems = order.items.map((item: OrderItem) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          images: item.image ? [item.image] : [],
        },
        unit_amount: Math.round(item.price * 100), // Convert to cents
      },
      quantity: item.quantity,
    }));

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      client_reference_id: orderId,
      metadata: {
        orderId: orderId,
        orderNumber: order.orderNumber,
      },
    });

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new BadRequestException('Webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException(`Webhook signature verification failed: ${err.message}`);
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutSessionCompleted(session);
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentSucceeded(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentFailed(failedPayment);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.error('Order ID not found in session metadata');
      return;
    }

    await this.ordersService.updatePaymentInfo(
      orderId,
      session.payment_intent as string,
      'card',
    );
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    // Payment was successful, order status should already be updated
    console.log('Payment intent succeeded:', paymentIntent.id);
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    // Handle failed payment
    console.error('Payment intent failed:', paymentIntent.id);
  }

  async createRefund(paymentIntentId: string, amount?: number) {
    const refundData: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
    };

    if (amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const refund = await this.stripe.refunds.create(refundData);

    return {
      refundId: refund.id,
      amount: refund.amount / 100, // Convert back to dollars
      status: refund.status,
    };
  }
}

