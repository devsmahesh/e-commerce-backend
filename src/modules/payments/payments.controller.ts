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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { RazorpayService } from './razorpay.service';
import { OrdersService } from '../orders/orders.service';
import { CartService } from '../cart/cart.service';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly razorpayService: RazorpayService,
    private readonly ordersService: OrdersService,
    private readonly cartService: CartService,
  ) {}

  @Post('razorpay/create-order')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create Razorpay order' })
  @ApiResponse({ status: 201, description: 'Razorpay order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid amount or request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createRazorpayOrder(
    @CurrentUser() user: any,
    @Body() createRazorpayOrderDto: CreateRazorpayOrderDto,
  ) {
    // Validate amount (must be positive, minimum ₹1)
    if (!createRazorpayOrderDto.amount || createRazorpayOrderDto.amount <= 0) {
      throw new BadRequestException('Amount is required and must be greater than 0');
    }

    if (createRazorpayOrderDto.amount < 100) {
      throw new BadRequestException('Minimum amount is ₹1 (100 paise)');
    }

    // Generate receipt if not provided
    const receipt = createRazorpayOrderDto.receipt || `receipt_${Date.now()}`;

    // Create Razorpay order
    const razorpayOrder = await this.razorpayService.createOrder({
      amount: createRazorpayOrderDto.amount,
      currency: createRazorpayOrderDto.currency || 'INR',
      receipt: receipt,
      notes: createRazorpayOrderDto.notes || {},
    });

    // Return the complete Razorpay order object directly
    // The TransformInterceptor will detect it's a Razorpay order and return it unwrapped
    return razorpayOrder;
  }

  @Post('razorpay/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Verify Razorpay payment' })
  @ApiResponse({ status: 200, description: 'Payment verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid payment signature' })
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

    // Verify signature first
    const isValid = this.razorpayService.verifyPayment(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid payment signature');
    }

    // Get order from database for ownership verification
    // Use lean query to get plain object with userId as ObjectId (not populated)
    const orderForVerification = await this.ordersService.findOneForVerification(orderId);

    // Verify order belongs to user
    // Since we used lean(), userId is an ObjectId, convert both to strings for comparison
    const orderUserId = orderForVerification.userId.toString();
    const authenticatedUserId = user.id.toString();

    if (orderUserId !== authenticatedUserId) {
      // Debug logging for troubleshooting
      console.error('Order ownership verification failed:', {
        orderId: orderId,
        orderUserId: orderUserId,
        authenticatedUserId: authenticatedUserId,
        orderUserIdType: typeof orderUserId,
        authenticatedUserIdType: typeof authenticatedUserId,
      });
      throw new ForbiddenException('Order does not belong to user');
    }

    // Now get the full order with all populated fields for the response
    const order = await this.ordersService.findOne(orderId);

    // Get payment details to determine payment method
    let paymentMethod = 'unknown';
    try {
      const payment = await this.razorpayService.fetchPayment(razorpay_payment_id);
      paymentMethod = payment.method || 'unknown';
    } catch (error) {
      // If we can't fetch payment details, continue with default
      console.warn('Could not fetch payment details:', error);
    }

    // Update order payment status
    const updatedOrder = await this.ordersService.updateRazorpayPaymentStatus(orderId, {
      paymentStatus: 'paid',
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      paymentGateway: 'razorpay',
      paymentMethod: paymentMethod,
    });

    // Clear user's cart
    try {
      await this.cartService.clearCart(user.id);
    } catch (error) {
      // Log error but don't fail the payment verification
      console.warn('Could not clear cart:', error);
    }

    return {
      success: true,
      message: 'Payment verified successfully',
      order: updatedOrder,
    };
  }

  @Post('razorpay/webhook')
  @Public()
  @ApiOperation({ summary: 'Razorpay webhook endpoint' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleRazorpayWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Req() req: any,
  ) {
    // Get raw body for signature verification
    // The raw body should be available from the middleware or NestJS rawBody option
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const bodyString = rawBody.toString('utf8');

    // Verify webhook signature using raw body string
    const isValid = this.razorpayService.verifyWebhookSignature(bodyString, signature);

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Parse the body for processing
    const body = typeof req.body === 'object' ? req.body : JSON.parse(bodyString);

    const event = body.event;
    const payload = body.payload;

    // Handle different events
    switch (event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(payload);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(payload);
        break;
      case 'order.paid':
        await this.handleOrderPaid(payload);
        break;
      case 'refund.created':
        await this.handleRefundCreated(payload);
        break;
      case 'refund.processed':
        await this.handleRefundProcessed(payload);
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }

    return { received: true };
  }

  private async handlePaymentCaptured(payload: any) {
    try {
      const orderId = payload.payment?.entity?.order_id;
      const paymentId = payload.payment?.entity?.id;
      const paymentMethod = payload.payment?.entity?.method;

      if (!orderId) {
        console.error('Order ID not found in payment.captured payload');
        return;
      }

      // Find order by razorpayOrderId
      const order = await this.ordersService.findByRazorpayOrderId(orderId);

      if (order) {
        await this.ordersService.updateRazorpayPaymentStatus(order._id.toString(), {
          paymentStatus: 'paid',
          razorpayPaymentId: paymentId,
          paymentMethod: paymentMethod,
          paymentGateway: 'razorpay',
        });
      } else {
        console.warn(`Order not found for Razorpay order ID: ${orderId}`);
      }
    } catch (error) {
      console.error('Error handling payment.captured:', error);
    }
  }

  private async handlePaymentFailed(payload: any) {
    try {
      const orderId = payload.payment?.entity?.order_id;
      const errorDescription =
        payload.payment?.entity?.error_description || 'Payment failed';

      if (!orderId) {
        console.error('Order ID not found in payment.failed payload');
        return;
      }

      // Find order by razorpayOrderId
      const order = await this.ordersService.findByRazorpayOrderId(orderId);

      if (order) {
        await this.ordersService.updateRazorpayPaymentStatus(order._id.toString(), {
          paymentStatus: 'failed',
          paymentGateway: 'razorpay',
        });
        console.error(`Payment failed for order ${order._id}: ${errorDescription}`);
      } else {
        console.warn(`Order not found for Razorpay order ID: ${orderId}`);
      }
    } catch (error) {
      console.error('Error handling payment.failed:', error);
    }
  }

  private async handleOrderPaid(payload: any) {
    try {
      const orderId = payload.order?.entity?.id;

      if (!orderId) {
        console.error('Order ID not found in order.paid payload');
        return;
      }

      // Find order by razorpayOrderId
      const order = await this.ordersService.findByRazorpayOrderId(orderId);

      if (order) {
        await this.ordersService.updateRazorpayPaymentStatus(order._id.toString(), {
          paymentStatus: 'paid',
          paymentGateway: 'razorpay',
        });
      } else {
        console.warn(`Order not found for Razorpay order ID: ${orderId}`);
      }
    } catch (error) {
      console.error('Error handling order.paid:', error);
    }
  }

  private async handleRefundCreated(payload: any) {
    try {
      const paymentId = payload.refund?.entity?.payment_id;

      if (!paymentId) {
        console.error('Payment ID not found in refund.created payload');
        return;
      }

      // Find order by razorpayPaymentId
      const order = await this.ordersService.findByRazorpayPaymentId(paymentId);

      if (order) {
        // Check if it's a full refund
        const refundAmount = payload.refund?.entity?.amount;
        const orderTotal = order.total * 100; // Convert to paise

        if (refundAmount && refundAmount >= orderTotal) {
          await this.ordersService.updateRazorpayPaymentStatus(order._id.toString(), {
            paymentStatus: 'refunded',
            paymentGateway: 'razorpay',
          });
        }
      } else {
        console.warn(`Order not found for Razorpay payment ID: ${paymentId}`);
      }
    } catch (error) {
      console.error('Error handling refund.created:', error);
    }
  }

  private async handleRefundProcessed(payload: any) {
    try {
      const paymentId = payload.refund?.entity?.payment_id;

      if (!paymentId) {
        console.error('Payment ID not found in refund.processed payload');
        return;
      }

      // Find order by razorpayPaymentId
      const order = await this.ordersService.findByRazorpayPaymentId(paymentId);

      if (order) {
        const refundAmount = payload.refund?.entity?.amount;
        const orderTotal = order.total * 100; // Convert to paise

        if (refundAmount && refundAmount >= orderTotal) {
          await this.ordersService.updateRazorpayPaymentStatus(order._id.toString(), {
            paymentStatus: 'refunded',
            paymentGateway: 'razorpay',
          });
        }
      } else {
        console.warn(`Order not found for Razorpay payment ID: ${paymentId}`);
      }
    } catch (error) {
      console.error('Error handling refund.processed:', error);
    }
  }
}

