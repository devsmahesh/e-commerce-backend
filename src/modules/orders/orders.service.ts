import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { RazorpayService } from '../payments/razorpay.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Coupon, CouponDocument } from '../coupons/schemas/coupon.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { EmailService } from '../email/email.service';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private emailService: EmailService,
    @Inject(forwardRef(() => RazorpayService))
    private razorpayService: RazorpayService,
  ) {}

  async create(userId: string, createOrderDto: CreateOrderDto) {
    // Get user's cart
    const cart = await this.cartModel.findOne({ userId }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    // Verify products and stock
    const orderItems = [];
    let subtotal = 0;

    for (const cartItem of cart.items) {
      const product = await this.productModel.findById(cartItem.productId);
      if (!product) {
        throw new NotFoundException(`Product ${cartItem.productId} not found`);
      }

      if (!product.isActive) {
        throw new BadRequestException(`Product ${product.name} is not available`);
      }

      if (product.stock < cartItem.quantity) {
        throw new BadRequestException(`Insufficient stock for ${product.name}`);
      }

      const itemTotal = cartItem.price * cartItem.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: product._id,
        name: product.name,
        image: product.images?.[0] || '',
        quantity: cartItem.quantity,
        price: cartItem.price,
        total: itemTotal,
      });
    }

    // Calculate discount if coupon provided
    let discount = 0;
    let appliedCoupon = null;
    if (createOrderDto.couponId) {
      const coupon = await this.couponModel.findById(createOrderDto.couponId);
      
      if (!coupon) {
        throw new BadRequestException('Coupon validation failed: Coupon not found');
      }

      if (!coupon.isActive) {
        throw new BadRequestException('Coupon validation failed: Coupon is not active');
      }

      // Check expiration
      const now = new Date();
      if (coupon.expiresAt && now > coupon.expiresAt) {
        throw new BadRequestException('Coupon validation failed: Coupon has expired');
      }

      // Check usage limit
      if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
        throw new BadRequestException('Coupon validation failed: Coupon usage limit reached');
      }

      // Check minimum purchase
      if (coupon.minPurchase && subtotal < coupon.minPurchase) {
        throw new BadRequestException(
          `Coupon validation failed: Minimum purchase amount not met. Required: ${coupon.minPurchase}, Current: ${subtotal}`,
        );
      }

      // Calculate discount
      if (coupon.type === 'percentage') {
        discount = (subtotal * coupon.value) / 100;
        if (coupon.maxDiscount) {
          discount = Math.min(discount, coupon.maxDiscount);
        }
      } else {
        discount = coupon.value;
      }
      
      // Ensure discount doesn't exceed subtotal
      discount = Math.min(discount, subtotal);
      appliedCoupon = coupon;
    }

    // Calculate totals
    const shippingCost = createOrderDto.shippingCost || 0;
    const discountedSubtotal = subtotal - discount;
    const tax = discountedSubtotal * 0.1; // 10% tax - adjust as needed
    const total = discountedSubtotal + tax + shippingCost;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

    // Calculate amount in paise (source of truth for payments)
    const amountInPaise = RazorpayService.rupeesToPaise(total);

    // Create order
    const order = await this.orderModel.create({
      userId,
      orderNumber,
      items: orderItems,
      shippingAddress: createOrderDto.shippingAddress,
      subtotal,
      shippingCost,
      tax,
      discount,
      total,
      amount: amountInPaise, // Amount in paise for payment processing
      currency: 'INR', // Default currency
      couponId: appliedCoupon?._id?.toString(),
      couponCode: appliedCoupon?.code,
      status: OrderStatus.Pending,
      paymentStatus: PaymentStatus.PENDING, // Initial payment status
    });

    // Update product stock
    for (const item of orderItems) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity, salesCount: item.quantity },
      });
    }

    // Increment coupon usage if applied (atomic operation)
    if (appliedCoupon) {
      await this.couponModel.findByIdAndUpdate(appliedCoupon._id, {
        $inc: { usageCount: 1 },
      });
    }

    // Clear cart
    cart.items = [];
    cart.total = 0;
    await cart.save();

    // Populate user to get email and name for emails
    await order.populate('userId', 'email firstName lastName');

    // Transform items to include id field for each item and format product
    const transformedItems = order.items.map((item: any, index: number) => {
      // Generate an id for the item (embedded documents don't have _id by default)
      const itemId = item._id?.toString() || `item-${index}`;
      
      // Format product - productId is stored as ObjectId, convert it to string
      // We also store name, image, price directly in the item for denormalization
      const productId = item.productId 
        ? (item.productId._id ? item.productId._id.toString() : item.productId.toString())
        : '';

      const product = {
        id: productId,
        name: item.name,
        price: item.price,
        image: item.image || '',
      };

      return {
        id: itemId,
        product: product,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      };
    });

    // Access timestamps directly from order document
    const orderDoc = order as any;

    // Send order confirmation email to user
    try {
      const user = order.userId as any;
      if (user && user.email) {
        await this.emailService.sendOrderConfirmationEmail(user.email, {
          orderNumber: order.orderNumber,
          items: order.items.map((item: any) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.total,
          })),
          subtotal: order.subtotal,
          shipping: order.shippingCost || 0,
          tax: order.tax,
          discount: order.discount || 0,
          total: order.total,
          shippingAddress: order.shippingAddress,
        });
        this.logger.log(`Order confirmation email sent to ${user.email} for order ${order.orderNumber}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send order confirmation email: ${error instanceof Error ? error.message : String(error)}`);
      // Don't fail order creation if email fails
    }

    // Send notification email to all admin users
    try {
      const adminUsers = await this.userModel.find({ role: Role.Admin, isActive: true }).select('email firstName lastName').lean();
      const user = order.userId as any;
      const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Customer';
      const customerEmail = user?.email || 'Unknown';

      for (const admin of adminUsers) {
        if (admin.email) {
          await this.emailService.sendNewOrderNotificationToAdmin(admin.email, {
            orderNumber: order.orderNumber,
            customerName,
            customerEmail,
            items: order.items.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })),
            subtotal: order.subtotal,
            shipping: order.shippingCost || 0,
            tax: order.tax,
            discount: order.discount || 0,
            total: order.total,
            shippingAddress: order.shippingAddress,
          });
          this.logger.log(`New order notification sent to admin ${admin.email} for order ${order.orderNumber}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send admin notification email: ${error instanceof Error ? error.message : String(error)}`);
      // Don't fail order creation if email fails
    }

    // Format coupon information if present
    let coupon = undefined;
    if (appliedCoupon) {
      coupon = {
        id: appliedCoupon._id.toString(),
        code: appliedCoupon.code,
      };
    } else if (order.couponCode) {
      coupon = {
        id: order.couponId || undefined,
        code: order.couponCode,
      };
    }

    return {
      id: order._id.toString(), // Convert _id to id for frontend
      orderNumber: order.orderNumber, // Required: Human-readable order number
      items: transformedItems,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shippingCost || 0, // Map shippingCost to shipping
      discount: order.discount || 0,
      total: order.total,
      coupon: coupon,
      status: order.status,
      paymentStatus: order.paymentStatus || 'pending', // Ensure paymentStatus is included
      createdAt: orderDoc.createdAt || new Date(),
      updatedAt: orderDoc.updatedAt || new Date(),
    };
  }

  async findAll(userId?: string, page?: number, limit?: number, status?: OrderStatus) {
    const query: any = {};
    if (userId) {
      query.userId = userId;
    }
    if (status) {
      query.status = status;
    }

    // If pagination params are provided, return paginated results
    if (page !== undefined && limit !== undefined) {
      const skip = (page - 1) * limit;
      const ordersPromise = this.orderModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('items.productId', 'name slug images')
        .populate('userId', 'email firstName lastName phone')
        .exec();
      const totalPromise = this.orderModel.countDocuments(query);
      const orders = await ordersPromise;
      const total = await totalPromise;

      // Transform orders to ensure trackingNumber is included
      const transformedOrders = orders.map((order: any) => this.transformOrderResponse(order));

      return {
        items: transformedOrders,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Otherwise return all results (backward compatibility)
    const orders = await this.orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name slug images')
      .populate('userId', 'email firstName lastName phone')
      .exec();

    // Transform orders to ensure trackingNumber is included
    return orders.map((order: any) => this.transformOrderResponse(order));
  }

  async findOne(id: string, userId?: string) {
    const query: any = { _id: id };
    if (userId) {
      query.userId = userId;
    }

    const order = await this.orderModel
      .findOne(query)
      .populate('items.productId', 'name slug images')
      .populate('userId', 'email firstName lastName')
      .populate('couponId', 'code value type')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Transform order to ensure trackingNumber is included
    return this.transformOrderResponse(order);
  }

  /**
   * Find order by ID without populating userId (for ownership checks)
   * This is more efficient when we only need to verify ownership
   */
  async findOneForVerification(id: string) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.orderModel
      .findById(id)
      .select('userId status paymentStatus') // Only select fields needed for verification
      .lean() // Return plain object for faster access
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async findByOrderNumber(orderNumber: string, user: { id: string; role?: string }) {
    // Find order by order number (without userId filter to check ownership separately)
    const order = await this.orderModel
      .findOne({ orderNumber })
      .populate('items.productId', 'name slug images price')
      .populate('userId', 'email firstName lastName')
      .populate('couponId', 'code value type')
      .exec();

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check authorization: user must own the order or be an admin
    // Handle both populated and non-populated userId
    let orderUserId: string;
    if (order.userId instanceof Types.ObjectId) {
      orderUserId = order.userId.toString();
    } else if ((order.userId as any)?._id) {
      // Populated user object
      orderUserId = (order.userId as any)._id.toString();
    } else {
      // Fallback: try to convert to string
      orderUserId = String(order.userId);
    }
    
    const isOwner = orderUserId === user.id;
    const isAdmin = user.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException("You don't have permission to view this order");
    }

    // Transform items to include id field for each item and format product
    const transformedItems = order.items.map((item: any, index: number) => {
      // Generate an id for the item (embedded documents don't have _id by default)
      const itemId = item._id?.toString() || `item-${index}`;
      
      // Format product - productId might be populated or just ObjectId
      let productId = '';
      let productName = item.name;
      let productPrice = item.price;
      let productImages: string[] = [];

      if (item.productId) {
        // If populated, extract from populated object
        if (typeof item.productId === 'object' && item.productId._id) {
          productId = item.productId._id.toString();
          productName = item.productId.name || item.name;
          productPrice = item.productId.price || item.price;
          productImages = item.productId.images || [item.image || ''];
        } else {
          // If not populated, use stored values
          productId = item.productId.toString();
          productImages = [item.image || ''];
        }
      }

      const product = {
        id: productId,
        name: productName,
        images: productImages,
        price: productPrice,
      };

      return {
        id: itemId,
        product: product,
        quantity: item.quantity,
        price: item.price,
      };
    });

    return {
      id: order._id.toString(), // Convert _id to id for frontend
      orderNumber: order.orderNumber, // Required: Human-readable order number
      items: transformedItems,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shippingCost || 0, // Map shippingCost to shipping
      discount: order.discount || 0,
      total: order.total,
      status: order.status,
      paymentStatus: order.paymentStatus || 'pending', // Ensure paymentStatus is included
      shippingAddress: order.shippingAddress,
      paymentMethod: order.paymentMethod || undefined,
      trackingNumber: order.trackingNumber || undefined,
      createdAt: (order as any).createdAt || new Date(),
      updatedAt: (order as any).updatedAt || new Date(),
    };
  }

  async findByRazorpayOrderId(razorpayOrderId: string) {
    const order = await this.orderModel
      .findOne({ razorpayOrderId })
      .populate('items.productId', 'name slug images')
      .populate('userId', 'email firstName lastName')
      .populate('couponId', 'code value type')
      .exec();

    return order;
  }

  async findByRazorpayPaymentId(razorpayPaymentId: string) {
    const order = await this.orderModel
      .findOne({ razorpayPaymentId })
      .populate('items.productId', 'name slug images')
      .populate('userId', 'email firstName lastName')
      .populate('couponId', 'code value type')
      .exec();

    return order;
  }

  async updateStatus(id: string, updateDto: UpdateOrderStatusDto, isAdmin = false) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Only admin can update status after payment
    if (!isAdmin && order.status !== OrderStatus.Pending) {
      throw new BadRequestException('Cannot update order status');
    }

    const previousStatus = order.status;
    order.status = updateDto.status;

    // Handle tracking number: update if provided (including null to remove tracking)
    if (updateDto.trackingNumber !== undefined) {
      // Transform already handles trimming and empty string -> null conversion
      // Convert null to undefined to match the schema type
      order.trackingNumber = updateDto.trackingNumber ?? undefined;
    }

    if (updateDto.status === OrderStatus.Shipped && !order.shippedAt) {
      order.shippedAt = new Date();
    }

    if (updateDto.status === OrderStatus.Delivered && !order.deliveredAt) {
      order.deliveredAt = new Date();
    }

    if (updateDto.status === OrderStatus.Cancelled) {
      order.cancelledAt = new Date();
      order.cancellationReason = updateDto.cancellationReason;

      // Restore stock if order was paid
      if (previousStatus === OrderStatus.Paid || previousStatus === OrderStatus.Processing) {
        for (const item of order.items) {
          await this.productModel.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity, salesCount: -item.quantity },
          });
        }
      }
    }

    await order.save();

    // Populate related fields for response
    await order.populate('items.productId', 'name slug images');
    await order.populate('userId', 'email firstName lastName');
    await order.populate('couponId', 'code value type');

    // Send status update email to user if status changed
    if (previousStatus !== updateDto.status) {
      try {
        const user = order.userId as any;
        if (user && user.email) {
          await this.emailService.sendOrderStatusUpdateEmail(user.email, {
            orderNumber: order.orderNumber,
            status: updateDto.status,
            trackingNumber: order.trackingNumber || undefined,
            cancellationReason: order.cancellationReason || undefined,
          });
          this.logger.log(`Order status update email sent to ${user.email} for order ${order.orderNumber}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send order status update email: ${error instanceof Error ? error.message : String(error)}`);
        // Don't fail status update if email fails
      }
    }

    // Send detailed cancellation notification to admin if order is cancelled
    if (updateDto.status === OrderStatus.Cancelled) {
      try {
        const user = order.userId as any;
        const customerName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Customer';
        const customerEmail = user?.email || 'Unknown';
        const orderDoc = order as any;

        // Get all admin users
        const adminUsers = await this.userModel.find({ role: Role.Admin, isActive: true }).select('email firstName lastName').lean();

        for (const admin of adminUsers) {
          if (admin.email) {
            await this.emailService.sendOrderCancellationNotificationToAdmin(admin.email, {
              orderNumber: order.orderNumber,
              customerName,
              customerEmail,
              previousStatus,
              cancellationReason: order.cancellationReason || undefined,
              paymentStatus: order.paymentStatus || 'pending',
              paymentMethod: order.paymentMethod || undefined,
              items: order.items.map((item: any) => ({
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.total,
              })),
              subtotal: order.subtotal,
              shipping: order.shippingCost || 0,
              tax: order.tax,
              discount: order.discount || 0,
              total: order.total,
              shippingAddress: order.shippingAddress,
              orderDate: orderDoc.createdAt || new Date(),
              cancelledAt: order.cancelledAt || new Date(),
            });
            this.logger.log(`Order cancellation notification sent to admin ${admin.email} for order ${order.orderNumber}`);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to send cancellation notification to admin: ${error instanceof Error ? error.message : String(error)}`);
        // Don't fail cancellation if email fails
      }
    }

    // Transform items to include id field for each item and format product
    const transformedItems = order.items.map((item: any, index: number) => {
      const itemId = item._id?.toString() || `item-${index}`;
      
      let productId = '';
      let productName = item.name;
      let productPrice = item.price;
      let productImages: string[] = [];

      if (item.productId) {
        if (typeof item.productId === 'object' && item.productId._id) {
          productId = item.productId._id.toString();
          productName = item.productId.name || item.name;
          productPrice = item.productId.price || item.price;
          productImages = item.productId.images || [item.image || ''];
        } else {
          productId = item.productId.toString();
          productImages = [item.image || ''];
        }
      }

      const product = {
        id: productId,
        name: productName,
        images: productImages,
        price: productPrice,
      };

      return {
        id: itemId,
        product: product,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
      };
    });

    const orderDoc = order as any;

    // Return formatted response matching frontend expectations
    return {
      id: order._id.toString(),
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber || undefined,
      items: transformedItems,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shippingCost || 0,
      discount: order.discount || 0,
      total: order.total,
      shippingAddress: order.shippingAddress,
      paymentStatus: order.paymentStatus || 'pending',
      createdAt: orderDoc.createdAt || new Date(),
      updatedAt: orderDoc.updatedAt || new Date(),
    };
  }

  async updatePaymentInfo(id: string, paymentIntentId: string, paymentMethod: string) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.status;
    order.paymentIntentId = paymentIntentId;
    order.paymentMethod = paymentMethod;
    order.status = OrderStatus.Paid;
    await order.save();

    // Populate user for email
    await order.populate('userId', 'email firstName lastName');

    // Send status update email to user if status changed
    if (previousStatus !== OrderStatus.Paid) {
      try {
        const user = order.userId as any;
        if (user && user.email) {
          await this.emailService.sendOrderStatusUpdateEmail(user.email, {
            orderNumber: order.orderNumber,
            status: OrderStatus.Paid,
          });
          this.logger.log(`Payment confirmation email sent to ${user.email} for order ${order.orderNumber}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send payment confirmation email: ${error instanceof Error ? error.message : String(error)}`);
        // Don't fail payment update if email fails
      }
    }

    return order;
  }

  async updateRazorpayPaymentStatus(
    id: string,
    data: {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      paymentStatus: PaymentStatus;
      paymentMethod?: string;
      paymentGateway?: string;
    },
  ) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousStatus = order.status;

    if (data.razorpayOrderId) {
      order.razorpayOrderId = data.razorpayOrderId;
    }
    if (data.razorpayPaymentId) {
      order.razorpayPaymentId = data.razorpayPaymentId;
    }
    if (data.paymentStatus) {
      order.paymentStatus = data.paymentStatus;
    }
    if (data.paymentMethod) {
      order.paymentMethod = data.paymentMethod;
    }
    if (data.paymentGateway) {
      order.paymentGateway = data.paymentGateway;
    }

    // Update order status based on payment status
    if (data.paymentStatus === PaymentStatus.PAID) {
      order.status = OrderStatus.Paid;
    } else if (data.paymentStatus === PaymentStatus.FAILED) {
      order.status = OrderStatus.Pending;
    } else if (data.paymentStatus === PaymentStatus.REFUNDED) {
      order.status = OrderStatus.Refunded;
    }

    await order.save();

    // Populate user for email
    await order.populate('userId', 'email firstName lastName');

    // Send status update email to user if status changed
    if (previousStatus !== order.status) {
      try {
        const user = order.userId as any;
        if (user && user.email) {
          await this.emailService.sendOrderStatusUpdateEmail(user.email, {
            orderNumber: order.orderNumber,
            status: order.status,
          });
          this.logger.log(`Payment status update email sent to ${user.email} for order ${order.orderNumber}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send payment status update email: ${error instanceof Error ? error.message : String(error)}`);
        // Don't fail payment update if email fails
      }
    }

    return order;
  }

  /**
   * Update Razorpay order ID after creating Razorpay order.
   * Sets payment status to CREATED.
   */
  async updateRazorpayOrderId(
    id: string,
    razorpayOrderId: string,
    amountInPaise: number,
    currency: string = 'INR',
  ) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.razorpayOrderId = razorpayOrderId;
    order.amount = amountInPaise; // Ensure amount is set in paise
    order.currency = currency;
    order.paymentStatus = PaymentStatus.CREATED;
    order.paymentGateway = 'razorpay';

    await order.save();
    return order;
  }

  /**
   * Update payment verification details (fast confirmation).
   * Sets payment status to VERIFICATION_PENDING.
   * Webhook will confirm final state.
   */
  async updatePaymentVerification(
    id: string,
    data: {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
      paymentMethod?: string;
      paymentGateway?: string;
    },
  ) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Don't overwrite PAID status - webhook is source of truth
    if (order.paymentStatus === PaymentStatus.PAID) {
      this.logger.log(
        `Order ${order.orderNumber} is already PAID. Not updating to VERIFICATION_PENDING.`,
      );
      // Still update other fields but not payment status
    } else {
      // Only set to VERIFICATION_PENDING if not already PAID
      order.paymentStatus = PaymentStatus.VERIFICATION_PENDING;
    }

    if (data.razorpayOrderId) {
      order.razorpayOrderId = data.razorpayOrderId;
    }
    if (data.razorpayPaymentId) {
      order.razorpayPaymentId = data.razorpayPaymentId;
    }
    if (data.razorpaySignature) {
      order.razorpaySignature = data.razorpaySignature;
    }
    if (data.paymentMethod) {
      order.paymentMethod = data.paymentMethod;
    }
    if (data.paymentGateway) {
      order.paymentGateway = data.paymentGateway;
    }

    await order.save();
    return order;
  }

  /**
   * Update payment status (used by webhooks - source of truth).
   */
  async updatePaymentStatus(
    id: string,
    data: {
      paymentStatus: PaymentStatus;
      razorpayPaymentId?: string;
      paymentMethod?: string;
      paymentGateway?: string;
      paidAt?: Date;
      metadata?: Record<string, any>;
    },
  ) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const previousPaymentStatus = order.paymentStatus;
    const previousOrderStatus = order.status;

    // Update payment fields
    if (data.razorpayPaymentId) {
      order.razorpayPaymentId = data.razorpayPaymentId;
    }
    if (data.paymentMethod) {
      order.paymentMethod = data.paymentMethod;
    }
    if (data.paymentGateway) {
      order.paymentGateway = data.paymentGateway;
    }
    if (data.paidAt) {
      order.paidAt = data.paidAt;
    }
    if (data.metadata) {
      order.metadata = { ...(order.metadata || {}), ...data.metadata };
    }

    // Update payment status
    order.paymentStatus = data.paymentStatus;

    // Update order status based on payment status
    if (data.paymentStatus === PaymentStatus.PAID) {
      order.status = OrderStatus.Paid;
    } else if (data.paymentStatus === PaymentStatus.FAILED) {
      order.status = OrderStatus.Pending;
    } else if (data.paymentStatus === PaymentStatus.REFUNDED) {
      order.status = OrderStatus.Refunded;
    }

    await order.save();

    // Populate user for email
    await order.populate('userId', 'email firstName lastName');

    // Send status update email if payment status changed to PAID
    if (
      previousPaymentStatus !== PaymentStatus.PAID &&
      data.paymentStatus === PaymentStatus.PAID
    ) {
      try {
        const user = order.userId as any;
        if (user && user.email) {
          await this.emailService.sendOrderStatusUpdateEmail(user.email, {
            orderNumber: order.orderNumber,
            status: order.status,
          });
          this.logger.log(
            `Payment confirmation email sent to ${user.email} for order ${order.orderNumber}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to send payment confirmation email: ${error instanceof Error ? error.message : String(error)}`,
        );
        // Don't fail payment update if email fails
      }
    }

    return order;
  }

  /**
   * Update refund status.
   */
  async updateRefundStatus(
    id: string,
    data: {
      refundId?: string;
      refundAmount?: number; // Amount in paise
      refundStatus?: 'processed' | 'pending' | 'failed';
      refundedAt?: Date;
      refundError?: string;
      paymentStatus?: PaymentStatus;
    },
  ) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (data.refundId) {
      order.refundId = data.refundId;
    }
    if (data.refundAmount !== undefined) {
      order.refundAmount = data.refundAmount;
    }
    if (data.refundStatus) {
      order.refundStatus = data.refundStatus;
    }
    if (data.refundedAt) {
      order.refundedAt = data.refundedAt;
    }
    if (data.refundError) {
      order.refundError = data.refundError;
    }
    if (data.paymentStatus) {
      order.paymentStatus = data.paymentStatus;
      // Update order status based on payment status
      if (data.paymentStatus === PaymentStatus.REFUNDED) {
        order.status = OrderStatus.Refunded;
      } else if (data.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED) {
        // Keep order status as Paid for partial refunds
        order.status = OrderStatus.Paid;
      }
    }

    await order.save();
    return order;
  }

  /**
   * Increment payment attempts (for fraud detection).
   */
  async incrementPaymentAttempts(id: string) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.paymentAttempts = (order.paymentAttempts || 0) + 1;
    await order.save();
    return order;
  }

  /**
   * Transform a MongoDB order document to a formatted response object
   */
  private transformOrderResponse(order: any): any {
    // Transform items to include id field for each item and format product
    const transformedItems = order.items?.map((item: any, index: number) => {
      const itemId = item._id?.toString() || `item-${index}`;
      
      let productId = '';
      let productName = item.name;
      let productPrice = item.price;
      let productImages: string[] = [];

      if (item.productId) {
        if (typeof item.productId === 'object' && item.productId._id) {
          productId = item.productId._id.toString();
          productName = item.productId.name || item.name;
          productPrice = item.productId.price || item.price;
          productImages = item.productId.images || [item.image || ''];
        } else {
          productId = item.productId.toString();
          productImages = [item.image || ''];
        }
      }

      const product = {
        id: productId,
        name: productName,
        images: productImages,
        price: productPrice,
      };

      return {
        id: itemId,
        product: product,
        quantity: item.quantity,
        price: item.price,
        total: item.total || item.price * item.quantity,
      };
    }) || [];

    const orderDoc = order as any;

    // Extract customer information from populated userId
    let customer = {};
    if (order.userId) {
      if (typeof order.userId === 'object' && order.userId._id) {
        // Populated user object
        customer = {
          id: order.userId._id.toString(),
          email: order.userId.email || '',
          firstName: order.userId.firstName || '',
          lastName: order.userId.lastName || '',
          phone: order.userId.phone || undefined,
        };
      } else if (order.userId instanceof Types.ObjectId) {
        // Just ObjectId, no populated data
        customer = {
          id: order.userId.toString(),
        };
      }
    }

    // Format coupon information if present
    let coupon = undefined;
    if (order.couponId) {
      if (typeof order.couponId === 'object' && order.couponId._id) {
        // Populated coupon object
        coupon = {
          id: order.couponId._id.toString(),
          code: order.couponId.code || order.couponCode,
        };
      } else if (order.couponCode) {
        // Just coupon code stored directly
        coupon = {
          id: order.couponId?.toString() || undefined,
          code: order.couponCode,
        };
      }
    }

    return {
      id: order._id?.toString() || order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      trackingNumber: order.trackingNumber || undefined,
      items: transformedItems,
      subtotal: order.subtotal,
      tax: order.tax,
      shipping: order.shippingCost || 0,
      discount: order.discount || 0,
      total: order.total,
      coupon: coupon,
      shippingAddress: order.shippingAddress,
      paymentStatus: order.paymentStatus || 'pending',
      paymentMethod: order.paymentMethod || undefined,
      customer: customer,
      createdAt: orderDoc.createdAt || order.createdAt || new Date(),
      updatedAt: orderDoc.updatedAt || order.updatedAt || new Date(),
    };
  }

  async cancelOrder(orderId: string, userId: string, userRole?: string) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check authorization: user must own the order or be an admin
    const isAdmin = userRole === Role.Admin;
    const orderUserId = order.userId instanceof Types.ObjectId
      ? order.userId.toString()
      : (order.userId as any)?._id?.toString() || String(order.userId);

    if (!isAdmin && orderUserId !== userId) {
      throw new ForbiddenException("You don't have permission to cancel this order");
    }

    // Check if order can be cancelled
    // Allow cancellation of: Pending, Paid, and Processing orders
    // Shipped and Delivered orders cannot be cancelled (already in transit/delivered)
    const allowedStatuses = [
      OrderStatus.Pending,
      OrderStatus.Paid,
      OrderStatus.Processing,
    ];
    
    if (!allowedStatuses.includes(order.status)) {
      throw new BadRequestException(
        `Order cannot be cancelled. Only pending, paid, or processing orders can be cancelled. Orders that are shipped or delivered cannot be cancelled.`,
      );
    }

    // Check if already cancelled
    if (order.status === OrderStatus.Cancelled) {
      throw new BadRequestException('Order is already cancelled');
    }

    const previousStatus = order.status;
    const previousPaymentStatus = order.paymentStatus;

    // Update order status
    order.status = OrderStatus.Cancelled;
    order.cancelledAt = new Date();
    // Note: updatedAt is automatically managed by Mongoose timestamps

    // Handle payment refund if paid
    if (previousPaymentStatus === PaymentStatus.PAID && order.razorpayPaymentId) {
      try {
        // Initiate refund with Razorpay
        const refund = await this.razorpayService.createRefund(order.razorpayPaymentId, {
          amount: order.amount || RazorpayService.rupeesToPaise(order.total), // Amount in paise
          notes: {
            orderId: order._id.toString(),
            orderNumber: order.orderNumber,
            reason: 'Order cancelled',
            cancelledBy: isAdmin ? 'admin' : 'customer',
          },
        });

        // Store refund details
        order.refundId = refund.id;
        order.refundStatus = refund.status === 'processed' ? 'processed' : 'pending';
        order.refundAmount = refund.amount || 0; // Amount in paise
        order.refundedAt = new Date();
        order.paymentStatus = PaymentStatus.REFUNDED;

        this.logger.log(`Refund successful for order ${order.orderNumber}: ${refund.id}`);
      } catch (refundError: any) {
        // Log refund failure but still cancel order
        this.logger.error(
          `Refund failed for order ${order.orderNumber}: ${refundError.message || String(refundError)}`,
        );

        // Store refund error details
        order.refundError = refundError.message || 'Refund failed';
        order.refundStatus = 'failed';

        // Note: Order will still be cancelled, but payment status remains 'paid'
        // Admin should manually process refund or retry
      }
    }

    await order.save();

    // Restore inventory
    for (const item of order.items) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity, salesCount: -item.quantity },
      });
    }

    // Update coupon usage if applicable
    if (order.couponId) {
      await this.couponModel.findByIdAndUpdate(order.couponId, {
        $inc: { usageCount: -1 },
      });
    }

    // Populate related fields for response
    await order.populate('items.productId', 'name slug images');
    await order.populate('userId', 'email firstName lastName');
    await order.populate('couponId', 'code value type');

    // Send refund notification email if refund was successful
    if (order.paymentStatus === PaymentStatus.REFUNDED && order.refundId) {
      try {
        const user = order.userId as any;
        if (user && user.email) {
          await this.emailService.sendOrderStatusUpdateEmail(user.email, {
            orderNumber: order.orderNumber,
            status: OrderStatus.Refunded,
          });
          this.logger.log(`Refund notification email sent to ${user.email} for order ${order.orderNumber}`);
        }
      } catch (error) {
        this.logger.error(
          `Failed to send refund notification email: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Send cancellation email to user
    try {
      const user = order.userId as any;
      if (user && user.email) {
        await this.emailService.sendOrderStatusUpdateEmail(user.email, {
          orderNumber: order.orderNumber,
          status: OrderStatus.Cancelled,
          cancellationReason: order.cancellationReason || undefined,
        });
        this.logger.log(`Order cancellation email sent to ${user.email} for order ${order.orderNumber}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Send cancellation notification to admin
    try {
      const user = order.userId as any;
      const customerName = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
        : 'Customer';
      const customerEmail = user?.email || 'Unknown';
      const orderDoc = order as any;

      const adminUsers = await this.userModel
        .find({ role: Role.Admin, isActive: true })
        .select('email firstName lastName')
        .lean();

      for (const admin of adminUsers) {
        if (admin.email) {
          await this.emailService.sendOrderCancellationNotificationToAdmin(admin.email, {
            orderNumber: order.orderNumber,
            customerName,
            customerEmail,
            previousStatus,
            cancellationReason: order.cancellationReason || undefined,
            paymentStatus: order.paymentStatus || 'pending',
            paymentMethod: order.paymentMethod || undefined,
            items: order.items.map((item: any) => ({
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
            })),
            subtotal: order.subtotal,
            shipping: order.shippingCost || 0,
            tax: order.tax,
            discount: order.discount || 0,
            total: order.total,
            shippingAddress: order.shippingAddress,
            orderDate: orderDoc.createdAt || new Date(),
            cancelledAt: order.cancelledAt || new Date(),
          });
          this.logger.log(
            `Order cancellation notification sent to admin ${admin.email} for order ${order.orderNumber}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation notification to admin: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Transform and return updated order
    return this.transformOrderResponse(order);
  }

  async refundOrder(orderId: string, amount?: number, reason?: string, refundedBy?: string) {
    // Validate ObjectId format
    if (!Types.ObjectId.isValid(orderId)) {
      throw new BadRequestException('Invalid order ID format');
    }

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Check if already refunded
    if (order.paymentStatus === PaymentStatus.REFUNDED && order.refundStatus === 'processed') {
      throw new BadRequestException('Refund already processed for this order');
    }

    // Check if order was paid
    if (order.paymentStatus !== PaymentStatus.PAID) {
      throw new BadRequestException(
        'Order is not eligible for refund. Only paid orders can be refunded.',
      );
    }

    // Check if payment ID exists
    if (!order.razorpayPaymentId) {
      throw new BadRequestException('Payment ID not found. Cannot process refund.');
    }

    // Validate payment ID format (Razorpay payment IDs start with 'pay_')
    if (!order.razorpayPaymentId.startsWith('pay_')) {
      this.logger.warn(
        `Invalid Razorpay payment ID format: ${order.razorpayPaymentId}. Expected format: pay_xxxxx`,
      );
    }

    // Determine refund amount
    const refundAmountInRupees = amount !== undefined ? amount : order.total;
    
    // Log refund attempt details
    this.logger.log(
      `Attempting refund for order ${order.orderNumber}: Payment ID: ${order.razorpayPaymentId}, Amount: ${refundAmountInRupees} INR (${Math.round(refundAmountInRupees * 100)} paise)`,
    );
    if (refundAmountInRupees > order.total) {
      throw new BadRequestException('Refund amount cannot exceed order total');
    }

    if (refundAmountInRupees <= 0) {
      throw new BadRequestException('Refund amount must be greater than 0');
    }

    // Verify payment exists and get current refund status (MANDATORY)
    let payment;
    try {
      payment = await this.razorpayService.fetchPayment(order.razorpayPaymentId);
      
      // Log payment details for debugging
      this.logger.log(
        `Payment details for ${order.razorpayPaymentId}: Status: ${payment.status}, Amount: ${payment.amount} paise, Refunded: ${payment.amount_refunded || 0} paise`,
      );
      
      // Check if payment is captured (only captured payments can be refunded)
      if (payment.status !== 'captured') {
        throw new BadRequestException(
          `Payment is not eligible for refund. Payment status: ${payment.status}. Only captured payments can be refunded.`,
        );
      }

      // Check if payment has already been fully refunded
      // Razorpay amounts are in paise (smallest currency unit) and may be strings or numbers
      const refundedAmount = Number(payment.amount_refunded || 0);
      const paymentAmount = Number(payment.amount || 0);
      
      if (refundedAmount >= paymentAmount) {
        throw new BadRequestException('Payment has already been fully refunded.');
      }

      // Check if refund amount exceeds remaining refundable amount
      const remainingRefundable = (paymentAmount - refundedAmount) / 100; // Convert paise to rupees
      if (refundAmountInRupees > remainingRefundable) {
        throw new BadRequestException(
          `Refund amount (${refundAmountInRupees}) exceeds remaining refundable amount (${remainingRefundable}).`,
        );
      }
    } catch (verifyError: any) {
      // If it's already a BadRequestException, rethrow it
      if (verifyError instanceof BadRequestException) {
        throw verifyError;
      }
      
      // Payment verification failed - don't proceed with refund
      this.logger.error(
        `Payment verification failed for ${order.razorpayPaymentId}: ${verifyError.message || String(verifyError)}`,
      );
      throw new BadRequestException(
        `Cannot verify payment status: ${verifyError.message || 'Payment verification failed'}. Refund cannot be processed.`,
      );
    }

    // Process refund via Razorpay
    // Convert refund amount to paise (Razorpay expects amount in paise)
    const refundAmountInPaise = RazorpayService.rupeesToPaise(refundAmountInRupees);
    
    let refund;
    try {
      refund = await this.razorpayService.createRefund(order.razorpayPaymentId, {
        amount: refundAmountInPaise, // Amount in paise
        notes: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          reason: reason || 'Admin refund',
          refundedBy: refundedBy || 'admin',
        },
      });
    } catch (refundError: any) {
      // Log full error details for debugging
      this.logger.error(
        `Razorpay refund failed for order ${order.orderNumber} (Payment ID: ${order.razorpayPaymentId}):`,
        JSON.stringify(refundError, null, 2),
      );

      // Extract error message from BadRequestException thrown by RazorpayService
      // The error message is already formatted by RazorpayService
      const errorMessage = refundError.message || refundError.response?.message || 'Refund failed';

      throw new BadRequestException(errorMessage);
    }

    // Update order with refund details
    order.refundId = refund.id;
    order.refundStatus = refund.status === 'processed' ? 'processed' : 'pending';
    // Razorpay returns amount in paise, store it directly
    order.refundAmount = typeof refund.amount === 'string' 
      ? parseInt(refund.amount, 10) 
      : (refund.amount || refundAmountInPaise); // Amount in paise
    order.refundedAt = new Date();
    
    // Determine if full or partial refund
    const dbAmountInPaise = order.amount || RazorpayService.rupeesToPaise(order.total);
    const isFullRefund = refundAmountInPaise >= dbAmountInPaise;
    
    order.paymentStatus = isFullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    
    // If full refund, update order status to Refunded
    if (isFullRefund) {
      order.status = OrderStatus.Refunded;
    }

    await order.save();

    // Populate related fields for response
    await order.populate('items.productId', 'name slug images');
    await order.populate('userId', 'email firstName lastName');
    await order.populate('couponId', 'code value type');

    // Send refund notification email to user
    try {
      const user = order.userId as any;
      if (user && user.email) {
        await this.emailService.sendOrderStatusUpdateEmail(user.email, {
          orderNumber: order.orderNumber,
          status: order.status,
        });
        this.logger.log(`Refund notification email sent to ${user.email} for order ${order.orderNumber}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to send refund notification email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const transformedOrder = this.transformOrderResponse(order);

    return {
      refundId: refund.id,
      refundAmount: refund.amount ? refund.amount / 100 : refundAmountInRupees,
      refundStatus: refund.status === 'processed' ? 'processed' : 'pending',
      order: transformedOrder,
    };
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }
}

