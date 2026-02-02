import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { Coupon, CouponDocument } from '../coupons/schemas/coupon.schema';
import { Review, ReviewDocument, ReviewStatus } from '../reviews/schemas/review.schema';
import { Banner, BannerDocument } from './schemas/banner.schema';
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
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      activeCoupons,
      pendingReviews,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.productModel.countDocuments(),
      this.orderModel.countDocuments(),
      this.orderModel.aggregate([
        { $match: { status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] } } },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      this.orderModel.countDocuments({ status: OrderStatus.Pending }),
      this.couponModel.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } }),
      this.reviewModel.countDocuments({ status: ReviewStatus.Pending }),
    ]);

    // Calculate growth rate (comparing last 30 days with previous 30 days)
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const previous30Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentPeriodRevenue, previousPeriodRevenue] = await Promise.all([
      this.orderModel.aggregate([
        {
          $match: {
            status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
            createdAt: { $gte: last30Days },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
      this.orderModel.aggregate([
        {
          $match: {
            status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
            createdAt: { $gte: previous30Days, $lt: last30Days },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    const currentRevenue = currentPeriodRevenue[0]?.total || 0;
    const previousRevenue = previousPeriodRevenue[0]?.total || 0;
    const growthRate =
      previousRevenue > 0
        ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
        : currentRevenue > 0
          ? 100
          : 0;

    return {
      totalRevenue: totalRevenue[0]?.total || 0,
      totalOrders,
      totalUsers,
      growthRate: Math.round(growthRate * 100) / 100,
    };
  }

  async getDashboardRevenue(period?: string) {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const revenueData = await this.orderModel.aggregate([
      {
        $match: {
          status: { $in: [OrderStatus.Paid, OrderStatus.Delivered] },
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
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
          revenue: 1,
          orders: 1,
        },
      },
    ]);

    return {
      data: revenueData,
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

