import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Cart, CartDocument } from '../cart/schemas/cart.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Coupon, CouponDocument } from '../coupons/schemas/coupon.schema';

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Cart.name) private cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
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
      if (coupon && coupon.isActive && new Date() <= coupon.expiresAt) {
        // Check usage limit
        if (coupon.usageLimit === 0 || coupon.usageCount < coupon.usageLimit) {
          if (coupon.type === 'percentage') {
            discount = (subtotal * coupon.value) / 100;
            if (coupon.maxDiscount) {
              discount = Math.min(discount, coupon.maxDiscount);
            }
          } else {
            discount = coupon.value;
          }
          discount = Math.min(discount, subtotal);
          appliedCoupon = coupon;
        }
      }
    }

    // Calculate totals
    const shippingCost = createOrderDto.shippingCost || 0;
    const tax = subtotal * 0.1; // 10% tax - adjust as needed
    const total = subtotal + shippingCost + tax - discount;

    // Generate order number
    const orderNumber = this.generateOrderNumber();

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
      couponId: createOrderDto.couponId,
      status: OrderStatus.Pending,
    });

    // Update product stock
    for (const item of orderItems) {
      await this.productModel.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity, salesCount: item.quantity },
      });
    }

    // Increment coupon usage if applied
    if (appliedCoupon) {
      await this.couponModel.findByIdAndUpdate(appliedCoupon._id, {
        $inc: { usageCount: 1 },
      });
    }

    // Clear cart
    cart.items = [];
    cart.total = 0;
    await cart.save();

    return order;
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
      const [orders, total] = await Promise.all([
        this.orderModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .populate('items.productId', 'name slug images')
          .populate('userId', 'email firstName lastName')
          .exec(),
        this.orderModel.countDocuments(query),
      ]);

      return {
        items: orders,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    // Otherwise return all results (backward compatibility)
    return this.orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('items.productId', 'name slug images')
      .populate('userId', 'email firstName lastName')
      .exec();
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

    return order;
  }

  async findByOrderNumber(orderNumber: string, userId?: string) {
    const query: any = { orderNumber };
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

    if (updateDto.trackingNumber) {
      order.trackingNumber = updateDto.trackingNumber;
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

    return order;
  }

  async updatePaymentInfo(id: string, paymentIntentId: string, paymentMethod: string) {
    const order = await this.orderModel.findById(id);
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.paymentIntentId = paymentIntentId;
    order.paymentMethod = paymentMethod;
    order.status = OrderStatus.Paid;
    await order.save();

    return order;
  }

  private generateOrderNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  }
}

