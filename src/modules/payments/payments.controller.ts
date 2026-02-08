import {
  Controller,
  Post,
  Body,
  Headers,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { RazorpayService } from './razorpay.service';
import { PaymentEventService } from './payment-event.service';
import { OrdersService } from '../orders/orders.service';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaymentStatus } from './enums/payment-status.enum';
import { OrderStatus } from '../orders/schemas/order.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { Role } from '../../common/decorators/roles.decorator';

/**
 * PaymentsController
 * 
 * Production-grade payment gateway controller following fintech best practices:
 * 
 * 1. Database is source of truth (not Razorpay)
 * 2. Webhooks are the source of truth for final payment state
 * 3. Never trust frontend-provided amounts
 * 4. All amounts handled in paise (integers)
 * 5. Idempotent operations
 * 6. Strong validation and fraud protection
 */
@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly paymentEventService: PaymentEventService,
    private readonly ordersService: OrdersService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Step 1: Create Razorpay Order
   * 
   * This endpoint:
   * 1. Validates user authentication
   * 2. Fetches order from database (source of truth)
   * 3. Ensures order is in PENDING status
   * 4. Creates Razorpay order using DB amount (never trust frontend)
   * 5. Stores razorpayOrderId in database
   * 6. Updates status to CREATED
   * 
   * Security: Frontend must NEVER control amount. Amount comes from DB.
   */
  @Post('razorpay/create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Create Razorpay payment order',
    description: 'Creates a Razorpay order for an existing order. Amount is fetched from database, never trusted from frontend.',
  })
  @ApiResponse({ status: 201, description: 'Razorpay order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order or amount mismatch' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Order does not belong to user' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async createRazorpayOrder(
    @CurrentUser() user: any,
    @Body() createRazorpayOrderDto: CreateRazorpayOrderDto,
  ) {
    const { orderId } = createRazorpayOrderDto;

    // Step 1: Verify order ownership first (using lean query for efficiency)
    const orderForVerification = await this.ordersService.findOneForVerification(orderId);
    if (!orderForVerification) {
      throw new NotFoundException('Order not found');
    }

    // Step 2: Verify order ownership
    const orderUserId = orderForVerification.userId.toString();
    const authenticatedUserId = user.id.toString();
    if (orderUserId !== authenticatedUserId) {
      throw new ForbiddenException('Order does not belong to user');
    }

    // Step 3: Fetch raw order from database (source of truth)
    // Get raw order to access amount field directly
    const rawOrder = await this.orderModel.findById(orderId).exec();
    if (!rawOrder) {
      throw new NotFoundException('Order not found');
    }

    // Step 4: Ensure order is in PENDING status
    if (rawOrder.paymentStatus !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        `Order is not in PENDING status. Current status: ${rawOrder.paymentStatus}`,
      );
    }

    // Step 5: Get amount from database (NEVER trust frontend)
    // If order.amount doesn't exist (legacy orders), calculate from total
    const amountInPaise = rawOrder.amount || RazorpayService.rupeesToPaise(rawOrder.total);

    // Step 5: Validate amount (must be at least ₹1 = 100 paise)
    if (amountInPaise < 100) {
      throw new BadRequestException('Order amount must be at least ₹1 (100 paise)');
    }

    // Step 6: Create Razorpay order using DB amount
    const receipt = createRazorpayOrderDto.receipt || rawOrder.orderNumber;
    const notes = {
      orderId: rawOrder._id.toString(),
      orderNumber: rawOrder.orderNumber,
      ...(createRazorpayOrderDto.notes || {}),
    };

    const razorpayOrder = await this.razorpayService.createOrder({
      amount: amountInPaise, // From database, not frontend
      currency: createRazorpayOrderDto.currency || rawOrder.currency || 'INR',
      receipt: receipt,
      notes: notes,
    });

    // Step 7: Update order with Razorpay order ID and status
    await this.ordersService.updateRazorpayOrderId(
      orderId,
      razorpayOrder.id,
      amountInPaise,
      createRazorpayOrderDto.currency || rawOrder.currency || 'INR',
    );

    this.logger.log(
      `Razorpay order created for order ${rawOrder.orderNumber}: ${razorpayOrder.id}`,
    );

    // Return Razorpay order details for frontend
    return {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID, // Frontend needs this for Razorpay Checkout
      orderId: orderId,
    };
  }

  /**
   * Step 3: Verify Payment (Optional Fast Confirmation)
   * 
   * This is NOT the source of truth. Webhooks are.
   * This endpoint provides fast feedback to the user, but webhooks
   * will confirm the final state.
   * 
   * What it does:
   * 1. Verifies HMAC SHA256 signature
   * 2. Fetches payment from Razorpay API
   * 3. Validates payment status and amount match
   * 4. Marks order as VERIFICATION_PENDING (not final)
   * 
   * Security: Validates amount matches database amount.
   */
  @Post('razorpay/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Verify Razorpay payment (fast confirmation)',
    description: 'Verifies payment signature and marks as verification pending. Webhook is the source of truth for final state.',
  })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment signature or amount mismatch' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Order does not belong to user' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async verifyRazorpayPayment(
    @CurrentUser() user: any,
    @Body() verifyPaymentDto: VerifyPaymentDto,
  ) {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = verifyPaymentDto;

    // Step 1: Verify signature
    const isValid = this.razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Step 2: Verify order ownership first (using lean query for efficiency)
    const orderForVerification = await this.ordersService.findOneForVerification(orderId);
    if (!orderForVerification) {
      throw new NotFoundException('Order not found');
    }

    // Step 3: Verify order ownership
    const orderUserId = orderForVerification.userId.toString();
    const authenticatedUserId = user.id.toString();
    if (orderUserId !== authenticatedUserId) {
      throw new ForbiddenException('Order does not belong to user');
    }

    // Step 4: Fetch raw order from database for amount validation
    const rawOrder = await this.orderModel.findById(orderId).exec();
    if (!rawOrder) {
      throw new NotFoundException('Order not found');
    }

    // Step 4.5: Check if order is already PAID (webhook may have already processed it)
    // Don't overwrite PAID status - webhook is source of truth
    if (rawOrder.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(
        `Order ${rawOrder.orderNumber} is already PAID. Webhook has already confirmed payment.`,
      );
      return {
        success: true,
        message: 'Payment already confirmed via webhook.',
        orderId: orderId,
        status: PaymentStatus.PAID,
      };
    }

    // Step 5: Fetch payment from Razorpay to validate
    const payment = await this.razorpayService.fetchPayment(razorpay_payment_id);

    // Step 5: Validate payment status
    if (payment.status !== 'captured') {
      throw new BadRequestException(
        `Payment not captured. Status: ${payment.status}`,
      );
    }

    // Step 6: Validate amount matches database (fraud protection)
    const dbAmountInPaise = rawOrder.amount || RazorpayService.rupeesToPaise(rawOrder.total);
    const razorpayAmount = typeof payment.amount === 'string' 
      ? parseInt(payment.amount, 10) 
      : payment.amount;

    if (razorpayAmount !== dbAmountInPaise) {
      this.logger.error(
        `Amount mismatch for order ${rawOrder.orderNumber}: DB=${dbAmountInPaise}, Razorpay=${razorpayAmount}`,
      );
      throw new BadRequestException(
        'Payment amount does not match order amount. Possible fraud attempt.',
      );
    }

    // Step 8: Validate currency matches
    const dbCurrency = rawOrder.currency || 'INR';
    if (payment.currency !== dbCurrency) {
      throw new BadRequestException('Payment currency does not match order currency');
    }

    // Step 9: Update order with payment details (VERIFICATION_PENDING, not final)
    // Webhook will confirm final state
    await this.ordersService.updatePaymentVerification(
      orderId,
      {
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        paymentMethod: payment.method || 'unknown',
        paymentGateway: 'razorpay',
      },
    );

    this.logger.log(
      `Payment verification pending for order ${rawOrder.orderNumber}. Waiting for webhook confirmation.`,
    );

    return {
      success: true,
      message: 'Payment verified. Awaiting webhook confirmation for final status.',
      orderId: orderId,
      status: PaymentStatus.VERIFICATION_PENDING,
    };
  }

  /**
   * Step 4: Webhook Handler (SOURCE OF TRUTH)
   * 
   * This is the source of truth for payment state.
   * All final payment state changes happen here.
   * 
   * Security:
   * 1. Verifies webhook signature
   * 2. Checks event idempotency
   * 3. Stores event before processing
   * 4. Validates amounts against database
   * 
   * Handles events:
   * - payment.captured: Final confirmation of payment
   * - payment.failed: Payment failure
   * - refund.processed: Refund completion
   * - refund.failed: Refund failure
   */
  @Post('razorpay/webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Razorpay webhook endpoint (source of truth)',
    description: 'Handles Razorpay webhook events. This is the source of truth for payment state.',
  })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: any,
  ) {
    // Step 1: Get raw body for signature verification
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const bodyString = rawBody.toString('utf8');

    // Step 2: Verify webhook signature
    const isValid = this.razorpayService.verifyWebhookSignature(bodyString, signature);
    if (!isValid) {
      this.logger.error('Invalid webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    // Step 3: Parse webhook body
    const body = typeof req.body === 'object' ? req.body : JSON.parse(bodyString);
    const event = body.event;
    const eventId = body.event?.id || body.id || `event_${Date.now()}`;
    const payload = body.payload;

    this.logger.log(`Received webhook event: ${event}, ID: ${eventId}`);

    // Step 4: Check idempotency - has this event been processed?
    const existingEvent = await this.paymentEventService.findEventById(eventId);
    if (existingEvent?.processed) {
      this.logger.log(`Event ${eventId} already processed. Ignoring.`);
      return { received: true, message: 'Event already processed' };
    }

    // Step 5: Store event (if not exists)
    let paymentEvent;
    if (!existingEvent) {
      paymentEvent = await this.paymentEventService.createEvent(eventId, event, payload);
    } else {
      paymentEvent = existingEvent;
    }

    // Step 6: Process event based on type
    try {
      switch (event) {
        case 'payment.captured':
          await this.handlePaymentCaptured(payload, paymentEvent);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(payload, paymentEvent);
          break;
        case 'refund.processed':
          await this.handleRefundProcessed(payload, paymentEvent);
          break;
        case 'refund.failed':
          await this.handleRefundFailed(payload, paymentEvent);
          break;
        default:
          this.logger.log(`Unhandled webhook event: ${event}`);
      }

      // Mark event as processed
      await this.paymentEventService.markAsProcessed(eventId);
    } catch (error: any) {
      // Mark event as processed with error
      await this.paymentEventService.markAsProcessed(eventId, error.message);
      this.logger.error(`Error processing webhook event ${eventId}:`, error);
      // Don't throw - return 200 to prevent Razorpay retries for non-retryable errors
      // Razorpay will retry if we return non-2xx
    }

    return { received: true };
  }

  /**
   * Handle payment.captured webhook event.
   * This is the source of truth for payment confirmation.
   */
  private async handlePaymentCaptured(payload: any, event: any) {
    const paymentEntity = payload.payment?.entity || payload.payment;
    const razorpayOrderId = paymentEntity?.order_id;
    const razorpayPaymentId = paymentEntity?.id;
    const paymentMethod = paymentEntity?.method;
    const razorpayAmount = typeof paymentEntity?.amount === 'string'
      ? parseInt(paymentEntity.amount, 10)
      : paymentEntity?.amount;

    if (!razorpayOrderId) {
      this.logger.error('Order ID not found in payment.captured payload');
      return;
    }

    // Find order by razorpayOrderId
    const order = await this.ordersService.findByRazorpayOrderId(razorpayOrderId);
    if (!order) {
      this.logger.warn(`Order not found for Razorpay order ID: ${razorpayOrderId}`);
      return;
    }

    // Idempotency check: if already PAID, ignore
    if (order.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(
        `Order ${order.orderNumber} already marked as PAID. Ignoring duplicate webhook.`,
      );
      return;
    }

    // Validate amount matches database (fraud protection)
    const dbAmountInPaise = order.amount || RazorpayService.rupeesToPaise(order.total);
    if (razorpayAmount !== dbAmountInPaise) {
      this.logger.error(
        `Amount mismatch for order ${order.orderNumber}: DB=${dbAmountInPaise}, Razorpay=${razorpayAmount}`,
      );
      throw new BadRequestException('Payment amount does not match order amount');
    }

    // Update order to PAID status (final state)
    await this.ordersService.updatePaymentStatus(
      order._id.toString(),
      {
        paymentStatus: PaymentStatus.PAID,
        razorpayPaymentId: razorpayPaymentId,
        paymentMethod: paymentMethod,
        paymentGateway: 'razorpay',
        paidAt: new Date(),
      },
    );

    this.logger.log(`Order ${order.orderNumber} marked as PAID via webhook`);
  }

  /**
   * Handle payment.failed webhook event.
   */
  private async handlePaymentFailed(payload: any, event: any) {
    const paymentEntity = payload.payment?.entity || payload.payment;
    const razorpayOrderId = paymentEntity?.order_id;
    const errorDescription = paymentEntity?.error_description || 'Payment failed';

    if (!razorpayOrderId) {
      this.logger.error('Order ID not found in payment.failed payload');
      return;
    }

    const order = await this.ordersService.findByRazorpayOrderId(razorpayOrderId);
    if (!order) {
      this.logger.warn(`Order not found for Razorpay order ID: ${razorpayOrderId}`);
      return;
    }

    // Increment payment attempts for fraud detection
    await this.ordersService.incrementPaymentAttempts(order._id.toString());

    // Update payment status to FAILED
    await this.ordersService.updatePaymentStatus(
      order._id.toString(),
      {
        paymentStatus: PaymentStatus.FAILED,
        paymentGateway: 'razorpay',
        metadata: {
          ...(order.metadata || {}),
          lastFailureReason: errorDescription,
        },
      },
    );

    this.logger.warn(`Payment failed for order ${order.orderNumber}: ${errorDescription}`);

    // Send admin notification for high-value orders (configurable threshold, default: 5000 INR)
    const highValueThreshold = Number(this.configService.get<string>('HIGH_VALUE_ORDER_THRESHOLD')) || 2500;
    if (order.total >= highValueThreshold) {
      try {
        // Populate user data
        const populatedOrder = await this.orderModel.findById(order._id).populate('userId', 'email firstName lastName').lean();
        const user = (populatedOrder as any)?.userId;
        const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Customer';
        const customerEmail = user?.email || 'Unknown';
        const orderDoc = populatedOrder as any;

        const adminUsers = await this.userModel
          .find({ role: Role.Admin, isActive: true })
          .select('email firstName lastName')
          .lean();

        this.logger.log(`High-value order (₹${order.total}) payment failed. Found ${adminUsers.length} admin user(s) for notification.`);

        if (adminUsers.length > 0) {
          for (let i = 0; i < adminUsers.length; i++) {
            const admin = adminUsers[i];
            if (admin.email) {
              try {
                // Add delay between emails to respect rate limits
                if (i > 0) {
                  await new Promise(resolve => setTimeout(resolve, 700));
                }
                this.logger.log(`Attempting to send payment failed notification to admin: ${admin.email} for high-value order ${order.orderNumber}`);
                await this.emailService.sendPaymentFailedNotificationToAdmin(admin.email, {
                  orderNumber: order.orderNumber,
                  customerName,
                  customerEmail,
                  orderTotal: order.total,
                  paymentMethod: order.paymentMethod || undefined,
                  failureReason: errorDescription,
                  paymentAttempts: order.paymentAttempts || 1,
                  orderDate: orderDoc.createdAt || new Date(),
                });
                this.logger.log(`✅ Payment failed notification sent to admin ${admin.email} for high-value order ${order.orderNumber}`);
              } catch (emailError) {
                this.logger.error(`❌ Failed to send payment failed notification to ${admin.email}: ${emailError instanceof Error ? emailError.message : String(emailError)}`);
              }
            }
          }
        }
      } catch (error) {
        this.logger.error(`Failed to send payment failed notification to admin: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      this.logger.debug(`Order ${order.orderNumber} payment failed but order value (₹${order.total}) is below high-value threshold (₹${highValueThreshold}). Admin notification not sent.`);
    }
  }

  /**
   * Handle refund.processed webhook event.
   */
  private async handleRefundProcessed(payload: any, event: any) {
    const refundEntity = payload.refund?.entity || payload.refund;
    const razorpayPaymentId = refundEntity?.payment_id;
    const refundId = refundEntity?.id;
    const refundAmount = typeof refundEntity?.amount === 'string'
      ? parseInt(refundEntity.amount, 10)
      : refundEntity?.amount;

    if (!razorpayPaymentId) {
      this.logger.error('Payment ID not found in refund.processed payload');
      return;
    }

    const order = await this.ordersService.findByRazorpayPaymentId(razorpayPaymentId);
    if (!order) {
      this.logger.warn(`Order not found for Razorpay payment ID: ${razorpayPaymentId}`);
      return;
    }

    const dbAmountInPaise = order.amount || RazorpayService.rupeesToPaise(order.total);
    const isFullRefund = refundAmount >= dbAmountInPaise;

    // Update refund status
    await this.ordersService.updateRefundStatus(
      order._id.toString(),
      {
        refundId: refundId,
        refundAmount: refundAmount,
        refundStatus: 'processed',
        refundedAt: new Date(),
        paymentStatus: isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
      },
    );

    this.logger.log(
      `Refund processed for order ${order.orderNumber}: ${refundAmount} paise (${isFullRefund ? 'full' : 'partial'})`,
    );
  }

  /**
   * Handle refund.failed webhook event.
   */
  private async handleRefundFailed(payload: any, event: any) {
    const refundEntity = payload.refund?.entity || payload.refund;
    const razorpayPaymentId = refundEntity?.payment_id;
    const errorDescription = refundEntity?.error_description || 'Refund failed';

    if (!razorpayPaymentId) {
      this.logger.error('Payment ID not found in refund.failed payload');
      return;
    }

    const order = await this.ordersService.findByRazorpayPaymentId(razorpayPaymentId);
    if (!order) {
      this.logger.warn(`Order not found for Razorpay payment ID: ${razorpayPaymentId}`);
      return;
    }

    await this.ordersService.updateRefundStatus(
      order._id.toString(),
      {
        refundStatus: 'failed',
        refundError: errorDescription,
      },
    );

    this.logger.error(`Refund failed for order ${order.orderNumber}: ${errorDescription}`);
  }
}
