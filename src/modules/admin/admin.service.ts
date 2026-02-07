import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Coupon, CouponDocument } from '../coupons/schemas/coupon.schema';
import { Review, ReviewDocument, ReviewStatus } from '../reviews/schemas/review.schema';
import { Banner, BannerDocument } from './schemas/banner.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { Role } from '../../common/decorators/roles.decorator';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Banner.name) private bannerModel: Model<BannerDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  /**
   * Calculate period dates based on period string
   */
  private calculatePeriodDates(period: string): {
    startDate: Date | null;
    endDate: Date;
    prevStartDate: Date | null;
    prevEndDate: Date | null;
  } {
    const now = new Date();
    const endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999); // End of today

    let startDate: Date | null = null;
    let prevStartDate: Date | null = null;
    let prevEndDate: Date | null = null;

    switch (period) {
      case '7d': {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevStartDate.setHours(0, 0, 0, 0);
        break;
      }
      case '30d': {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevStartDate.setHours(0, 0, 0, 0);
        break;
      }
      case '90d': {
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000);
        prevStartDate.setHours(0, 0, 0, 0);
        break;
      }
      case '1y': {
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        prevStartDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'all': {
        // No date filter for 'all'
        startDate = null;
        prevStartDate = null;
        prevEndDate = null;
        break;
      }
      default: {
        // Default to 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        prevEndDate = new Date(startDate.getTime() - 1);
        prevStartDate = new Date(startDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevStartDate.setHours(0, 0, 0, 0);
      }
    }

    return { startDate, endDate, prevStartDate, prevEndDate };
  }

  /**
   * Calculate percentage change
   */
  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 100) * 10 / 10; // Round to 1 decimal place
  }

  async getDashboardStats(period: string = '30d') {
    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y', 'all'];
    if (!validPeriods.includes(period)) {
      throw new BadRequestException('Invalid period parameter. Must be one of: 7d, 30d, 90d, 1y, all');
    }

    const { startDate, endDate, prevStartDate, prevEndDate } = this.calculatePeriodDates(period);

    // Build date filter for current period
    const currentPeriodFilter: any = {};
    if (startDate) {
      currentPeriodFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Build date filter for previous period
    const previousPeriodFilter: any = {};
    if (prevStartDate && prevEndDate) {
      previousPeriodFilter.createdAt = { $gte: prevStartDate, $lte: prevEndDate };
    }

    // Revenue calculation: sum orders with paymentStatus: 'PAID' and status != 'cancelled'
    const revenueMatchCurrent = {
      ...currentPeriodFilter,
      paymentStatus: PaymentStatus.PAID,
      status: { $ne: OrderStatus.Cancelled },
    };
    const revenueMatchPrevious = {
      ...previousPeriodFilter,
      paymentStatus: PaymentStatus.PAID,
      status: { $ne: OrderStatus.Cancelled },
    };

    // Get all stats in parallel
    const [
      currentRevenueResult,
      previousRevenueResult,
      currentOrdersCount,
      previousOrdersCount,
      totalUsersAllTime,
      previousPeriodUsersCount,
      currentPeriodUsersCount,
      orderStatusCounts,
      paymentStatusCounts,
      productStats,
      categoryCount,
      pendingReviewsCount,
    ] = await Promise.all([
      // Revenue
      this.orderModel.aggregate([
        { $match: revenueMatchCurrent },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      this.orderModel.aggregate([
        { $match: revenueMatchPrevious },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      // Orders count
      this.orderModel.countDocuments(currentPeriodFilter),
      prevStartDate && prevEndDate
        ? this.orderModel.countDocuments(previousPeriodFilter)
        : Promise.resolve(0),
      // Users count (all time for totalUsers)
      this.userModel.countDocuments(),
      // Users created in previous period for comparison
      prevStartDate && prevEndDate
        ? this.userModel.countDocuments(previousPeriodFilter)
        : Promise.resolve(0),
      // Users created in current period for comparison
      this.userModel.countDocuments(currentPeriodFilter),
      // Order status breakdown
      this.orderModel.aggregate([
        { $match: currentPeriodFilter },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      // Payment status breakdown
      this.orderModel.aggregate([
        { $match: currentPeriodFilter },
        {
          $group: {
            _id: '$paymentStatus',
            count: { $sum: 1 },
          },
        },
      ]),
      // Product stats
      Promise.all([
        this.productModel.countDocuments({ stock: { $lt: 10 }, isActive: true }),
        this.productModel.countDocuments(),
        this.productModel.countDocuments({ isActive: true }),
      ]),
      // Category count
      this.categoryModel.countDocuments(),
      // Pending reviews
      this.reviewModel.countDocuments({ status: ReviewStatus.Pending }),
    ]);

    const totalRevenue = currentRevenueResult[0]?.total || 0;
    const previousRevenue = previousRevenueResult[0]?.total || 0;
    const totalOrders = currentOrdersCount;
    const previousOrders = previousOrdersCount;
    const totalUsers = totalUsersAllTime; // All time users
    const previousUsers = previousPeriodUsersCount;
    const currentPeriodUsers = currentPeriodUsersCount;

    // Calculate percentage changes
    const revenueChange = this.calculatePercentageChange(totalRevenue, previousRevenue);
    const ordersChange = this.calculatePercentageChange(totalOrders, previousOrders);
    const usersChange = this.calculatePercentageChange(currentPeriodUsers, previousUsers);

    // Calculate growth rate (overall growth rate based on revenue)
    const growthRate = revenueChange;

    // Calculate average order value
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Process order status counts
    const orderStatusMap: Record<string, number> = {};
    orderStatusCounts.forEach((item) => {
      orderStatusMap[item._id] = item.count;
    });

    // Process payment status counts
    const paymentStatusMap: Record<string, number> = {};
    paymentStatusCounts.forEach((item) => {
      paymentStatusMap[item._id] = item.count;
    });

    return {
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalOrders,
        totalUsers,
        growthRate: Math.round(growthRate * 10) / 10,
        revenueChange: Math.round(revenueChange * 10) / 10,
        ordersChange: Math.round(ordersChange * 10) / 10,
        usersChange: Math.round(usersChange * 10) / 10,
        averageOrderValue: Math.round(averageOrderValue * 100) / 100,
        pendingOrders: orderStatusMap[OrderStatus.Pending] || 0,
        processingOrders: orderStatusMap[OrderStatus.Processing] || 0,
        shippedOrders: orderStatusMap[OrderStatus.Shipped] || 0,
        deliveredOrders: orderStatusMap[OrderStatus.Delivered] || 0,
        cancelledOrders: orderStatusMap[OrderStatus.Cancelled] || 0,
        paidOrders: paymentStatusMap[PaymentStatus.PAID] || 0,
        pendingPayments: paymentStatusMap[PaymentStatus.PENDING] || paymentStatusMap[PaymentStatus.CREATED] || paymentStatusMap[PaymentStatus.VERIFICATION_PENDING] || 0,
        failedPayments: paymentStatusMap[PaymentStatus.FAILED] || 0,
        lowStockProducts: productStats[0],
        totalProducts: productStats[1],
        activeProducts: productStats[2],
        totalCategories: categoryCount,
        pendingReviews: pendingReviewsCount,
      },
    };
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date, groupBy: 'day' | 'week' | 'month'): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (groupBy === 'day') {
      const day = date.getDate();
      const month = months[date.getMonth()];
      return `${month} ${day}`;
    } else if (groupBy === 'week') {
      const day = date.getDate();
      const month = months[date.getMonth()];
      return `${month} ${day}`;
    } else {
      // month
      return months[date.getMonth()];
    }
  }

  async getDashboardRevenue(
    period: string = '30d',
    startDate?: string,
    endDate?: string,
  ) {
    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y', 'all'];
    if (period && !validPeriods.includes(period)) {
      throw new BadRequestException('Invalid period parameter. Must be one of: 7d, 30d, 90d, 1y, all');
    }

    let dateFilter: any = {};
    let groupBy: 'day' | 'week' | 'month' = 'day';
    let dateFormat = '%Y-%m-%d';

    // If custom dates provided, use them
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      // Determine groupBy based on date range
      const daysDiff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 30) {
        groupBy = 'day';
        dateFormat = '%Y-%m-%d';
      } else if (daysDiff <= 90) {
        groupBy = 'week';
        dateFormat = '%Y-%m-%d';
      } else {
        groupBy = 'month';
        dateFormat = '%Y-%m';
      }
    } else {
      // Use period
      const periodDates = this.calculatePeriodDates(period);
      if (periodDates.startDate) {
        dateFilter.createdAt = {
          $gte: periodDates.startDate,
          $lte: periodDates.endDate,
        };
      }

      // Determine groupBy based on period
      switch (period) {
        case '7d':
        case '30d':
          groupBy = 'day';
          dateFormat = '%Y-%m-%d';
          break;
        case '90d':
          groupBy = 'week';
          dateFormat = '%Y-%m-%d';
          break;
        case '1y':
        case 'all':
          groupBy = 'month';
          dateFormat = '%Y-%m';
          break;
      }
    }

    // Revenue calculation: sum orders with paymentStatus: 'PAID' and status != 'cancelled'
    const matchFilter = {
      ...dateFilter,
      paymentStatus: PaymentStatus.PAID,
      status: { $ne: OrderStatus.Cancelled },
    };

    // Aggregate revenue and orders
    const revenueData = await this.orderModel.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' },
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          revenue: { $round: ['$revenue', 2] },
          orders: 1,
        },
      },
    ]);

    // Create a map of existing data
    const dataMap = new Map<string, { revenue: number; orders: number }>();
    revenueData.forEach((item) => {
      dataMap.set(item.date, { revenue: item.revenue || 0, orders: item.orders || 0 });
    });

    // Fill missing dates
    const formattedData: Array<{
      date: string;
      formattedDate: string;
      revenue: number;
      orders: number;
    }> = [];

    if (dateFilter.createdAt) {
      const start = new Date(dateFilter.createdAt.$gte);
      const end = new Date(dateFilter.createdAt.$lte);
      const current = new Date(start);

      while (current <= end) {
        let dateKey: string;
        if (groupBy === 'month') {
          const month = String(current.getMonth() + 1).padStart(2, '0');
          dateKey = `${current.getFullYear()}-${month}`;
          // Move to next month
          current.setMonth(current.getMonth() + 1);
        } else if (groupBy === 'week') {
          // For weeks, group by week (start of week)
          const weekStart = new Date(current);
          weekStart.setDate(current.getDate() - current.getDay()); // Start of week (Sunday)
          const month = String(weekStart.getMonth() + 1).padStart(2, '0');
          const day = String(weekStart.getDate()).padStart(2, '0');
          dateKey = `${weekStart.getFullYear()}-${month}-${day}`;
          // Move to next week
          current.setDate(current.getDate() + 7);
        } else {
          // day
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          dateKey = `${current.getFullYear()}-${month}-${day}`;
          // Move to next day
          current.setDate(current.getDate() + 1);
        }

        const existingData = dataMap.get(dateKey);
        const dateObj = new Date(dateKey + (groupBy === 'month' ? '-01' : ''));
        
        formattedData.push({
          date: dateKey,
          formattedDate: this.formatDate(dateObj, groupBy),
          revenue: existingData?.revenue || 0,
          orders: existingData?.orders || 0,
        });
      }
    } else {
      // For 'all' period, just format existing data
      formattedData.push(
        ...revenueData.map((item) => {
          const date = new Date(item.date + (groupBy === 'month' ? '-01' : ''));
          return {
            date: item.date,
            formattedDate: this.formatDate(date, groupBy),
            revenue: item.revenue || 0,
            orders: item.orders || 0,
          };
        }),
      );
    }

    return {
      success: true,
      message: 'Revenue data retrieved successfully',
      data: formattedData,
    };
  }

  async getRecentOrders(limit: number = 5) {
    // Validate limit
    const validLimit = Math.min(Math.max(1, limit), 20);

    const orders = await this.orderModel
      .find()
      .sort({ createdAt: -1 })
      .limit(validLimit)
      .populate('items.productId', 'name images price')
      .exec();

    return {
      success: true,
      message: 'Recent orders retrieved successfully',
      data: orders,
    };
  }

  async getTopProducts(limit: number = 5, period: string = '30d') {
    // Validate period
    const validPeriods = ['7d', '30d', '90d', '1y', 'all'];
    if (!validPeriods.includes(period)) {
      throw new BadRequestException('Invalid period parameter. Must be one of: 7d, 30d, 90d, 1y, all');
    }

    // Validate limit
    const validLimit = Math.min(Math.max(1, limit), 20);

    const { startDate, endDate } = this.calculatePeriodDates(period);

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Match orders with paymentStatus: 'PAID' and status != 'cancelled'
    const orderMatch = {
      ...dateFilter,
      paymentStatus: PaymentStatus.PAID,
      status: { $ne: OrderStatus.Cancelled },
    };

    // Aggregate product sales
    const topProducts = await this.orderModel.aggregate([
      { $match: orderMatch },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          quantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
          orderCount: { $addToSet: '$_id' },
        },
      },
      {
        $project: {
          _id: 1,
          quantitySold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          orderCount: { $size: '$orderCount' },
        },
      },
      { $sort: { totalRevenue: -1, quantitySold: -1 } },
      { $limit: validLimit },
    ]);

    // Populate product details
    const productIds = topProducts.map((item) => item._id);
    const products = await this.productModel.find({ _id: { $in: productIds } }).exec();
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const result = topProducts.map((item) => {
      const product = productMap.get(item._id.toString());
      return {
        id: item._id.toString(),
        product: product
          ? {
              id: product._id.toString(),
              name: product.name,
              images: product.images || [],
              price: product.price,
              slug: product.slug,
              stock: product.stock,
              isActive: product.isActive,
            }
          : null,
        quantitySold: item.quantitySold,
        totalRevenue: item.totalRevenue,
        orderCount: item.orderCount,
      };
    });

    return {
      success: true,
      message: 'Top products retrieved successfully',
      data: result,
    };
  }

  async getAllUsers(page = 1, limit = 10, search?: string) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('-password -refreshTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(query),
    ]);

    return {
      items: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(userId: string) {
    const user = await this.userModel
      .findById(userId)
      .select('-password -refreshTokens')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUser(userId: string, updateData: Partial<User>) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password -refreshTokens')
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async deleteUser(userId: string) {
    const user = await this.userModel.findByIdAndDelete(userId).exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { message: 'User deleted successfully' };
  }

  async updateUserStatus(userId: string, isActive: boolean) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { isActive },
      { new: true },
    ).select('-password -refreshTokens');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateUserRole(userId: string, role: string) {
    // Validate role
    if (!Object.values(Role).includes(role as Role)) {
      throw new BadRequestException(`Invalid role. Must be one of: ${Object.values(Role).join(', ')}`);
    }

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      { role },
      { new: true },
    ).select('-password -refreshTokens');

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Banner Management
  async getAllBanners() {
    return this.bannerModel.find().sort({ createdAt: -1 }).exec();
  }

  async getBannerById(id: string) {
    const banner = await this.bannerModel.findById(id).exec();
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return banner;
  }

  async createBanner(createBannerDto: CreateBannerDto) {
    const banner = await this.bannerModel.create({
      ...createBannerDto,
      startDate: createBannerDto.startDate ? new Date(createBannerDto.startDate) : undefined,
      endDate: createBannerDto.endDate ? new Date(createBannerDto.endDate) : undefined,
    });
    return banner;
  }

  async updateBanner(id: string, updateBannerDto: UpdateBannerDto) {
    const updateData: any = { ...updateBannerDto };
    
    if (updateBannerDto.startDate) {
      updateData.startDate = new Date(updateBannerDto.startDate);
    }
    if (updateBannerDto.endDate) {
      updateData.endDate = new Date(updateBannerDto.endDate);
    }

    const banner = await this.bannerModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })
      .exec();

    if (!banner) {
      throw new NotFoundException('Banner not found');
    }

    return banner;
  }

  async deleteBanner(id: string) {
    const banner = await this.bannerModel.findByIdAndDelete(id).exec();
    if (!banner) {
      throw new NotFoundException('Banner not found');
    }
    return { message: 'Banner deleted successfully' };
  }

  // Reviews Management
  async getAllReviews(
    page = 1,
    limit = 10,
    productId?: string,
    status?: ReviewStatus,
  ) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (productId) {
      query.productId = productId;
    }
    if (status !== undefined) {
      query.status = status;
    }

    const [reviews, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'firstName lastName email')
        .populate('productId', 'name slug images')
        .exec(),
      this.reviewModel.countDocuments(query),
    ]);

    return {
      items: reviews,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateReviewStatus(id: string, status: ReviewStatus) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const wasApproved = review.status === ReviewStatus.Approved;
    review.status = status;
    await review.save();

    // Update product rating if status changed to/from approved
    if (status === ReviewStatus.Approved && !wasApproved) {
      // Status changed to approved
      await this.updateProductRating(review.productId.toString());
    } else if (wasApproved && status !== ReviewStatus.Approved) {
      // Status changed from approved to something else
      await this.updateProductRating(review.productId.toString());
    }

    return review;
  }

  async deleteReview(id: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const productId = review.productId.toString();
    const wasApproved = review.status === ReviewStatus.Approved;
    await this.reviewModel.findByIdAndDelete(id);

    // Update product rating only if the deleted review was approved
    if (wasApproved) {
      await this.updateProductRating(productId);
    }

    return { message: 'Review deleted successfully' };
  }

  private async updateProductRating(productId: string) {
    const reviews = await this.reviewModel.find({
      productId,
      status: ReviewStatus.Approved,
    });

    if (reviews.length === 0) {
      await this.productModel.findByIdAndUpdate(productId, {
        averageRating: 0,
        reviewCount: 0,
      });
      return;
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = totalRating / reviews.length;

    await this.productModel.findByIdAndUpdate(productId, {
      averageRating: Math.round(averageRating * 10) / 10,
      reviewCount: reviews.length,
    });
  }
}

