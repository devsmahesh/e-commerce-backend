import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument, ReviewStatus } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { RedisService } from '../../config/redis/redis.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private redisService: RedisService,
  ) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, comment } = createReviewDto;

    // Validate rating is integer
    if (!Number.isInteger(rating)) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    // Check if product exists
    const product = await this.productModel.findById(productId);
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await this.reviewModel.findOne({
      productId,
      userId,
    });

    if (existingReview) {
      throw new ConflictException('You have already reviewed this product');
    }

    // Check if user has purchased this product (for verified purchase badge)
    const hasPurchased = await this.orderModel.exists({
      userId,
      status: { $in: [OrderStatus.Delivered, OrderStatus.Shipped] },
      'items.productId': productId,
    });

    // Create review with status 'approved' (auto-approved)
    const review = await this.reviewModel.create({
      productId,
      userId,
      rating,
      comment: comment.trim(),
      status: ReviewStatus.Approved,
      isVerifiedPurchase: !!hasPurchased,
    });

    // Update product rating immediately since review is auto-approved
    await this.updateProductRating(productId);

    // Invalidate product cache so reviews are included in next fetch
    await this.invalidateProductCache(productId);

    return {
      success: true,
      message: 'Review submitted successfully',
      data: review,
    };
  }

  async findAll(
    productId?: string,
    approvedOnly = true,
    page = 1,
    limit = 10,
  ) {
    const query: any = {};
    if (productId) {
      query.productId = productId;
    }
    if (approvedOnly) {
      query.status = ReviewStatus.Approved;
    }

    const skip = Math.max(0, (page - 1) * limit);
    const numericLimit = Number(limit);

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .populate('userId', 'firstName lastName email avatar')
        .exec(),
      this.reviewModel.countDocuments(query).exec(),
    ]);

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: numericLimit,
        totalPages: Math.ceil(total / numericLimit),
      },
    };
  }

  async findOne(id: string) {
    const review = await this.reviewModel
      .findById(id)
      .populate('userId', 'firstName lastName email avatar')
      .populate('productId', 'name slug')
      .exec();

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }

  async approve(id: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const wasApproved = review.status === ReviewStatus.Approved;
    review.status = ReviewStatus.Approved;
    await review.save();

    // Update product rating only if status changed to approved
    if (!wasApproved) {
      await this.updateProductRating(review.productId.toString());
    }

    // Invalidate product cache
    await this.invalidateProductCache(review.productId.toString());

    return review;
  }

  async reject(id: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const wasApproved = review.status === ReviewStatus.Approved;
    review.status = ReviewStatus.Rejected;
    await review.save();

    // Update product rating if it was previously approved
    if (wasApproved) {
      await this.updateProductRating(review.productId.toString());
    }

    // Invalidate product cache
    await this.invalidateProductCache(review.productId.toString());

    return review;
  }

  async delete(id: string, userId: string, userRole: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Check ownership: users can only delete their own reviews, admins can delete any
    const isOwner = review.userId.toString() === userId;
    const isAdmin = userRole === 'admin';

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'You can only delete your own reviews',
      );
    }

    const productId = review.productId.toString();
    const wasApproved = review.status === ReviewStatus.Approved;

    await this.reviewModel.findByIdAndDelete(id);

    // Update product rating only if the deleted review was approved
    if (wasApproved) {
      await this.updateProductRating(productId);
    }

    // Invalidate product cache
    await this.invalidateProductCache(productId);

    return { message: 'Review deleted successfully' };
  }

  private async invalidateProductCache(productId: string) {
    try {
      // Invalidate product cache by ID
      await this.redisService.del(`product:${productId}`);
      // Also try to invalidate by slug (would need to fetch product first, but for now just clear ID cache)
    } catch (error) {
      // If Redis fails, continue without cache invalidation
      console.warn('Redis cache invalidation error:', error.message);
    }
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
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviewCount: reviews.length,
    });
  }
}

