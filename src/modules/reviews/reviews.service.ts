import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Review, ReviewDocument } from './schemas/review.schema';
import { CreateReviewDto } from './dto/create-review.dto';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Order, OrderDocument, OrderStatus } from '../orders/schemas/order.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private reviewModel: Model<ReviewDocument>,
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
  ) {}

  async create(userId: string, createReviewDto: CreateReviewDto) {
    const { productId, rating, comment } = createReviewDto;

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

    // Create review
    const review = await this.reviewModel.create({
      productId,
      userId,
      rating,
      comment,
      isVerifiedPurchase: !!hasPurchased,
    });

    // Update product rating
    await this.updateProductRating(productId);

    return review;
  }

  async findAll(productId?: string, approvedOnly = true) {
    const query: any = {};
    if (productId) {
      query.productId = productId;
    }
    if (approvedOnly) {
      query.isApproved = true;
    }

    return this.reviewModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate('userId', 'firstName lastName')
      .exec();
  }

  async findOne(id: string) {
    const review = await this.reviewModel
      .findById(id)
      .populate('userId', 'firstName lastName')
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

    review.isApproved = true;
    await review.save();

    // Update product rating
    await this.updateProductRating(review.productId.toString());

    return review;
  }

  async reject(id: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    review.isApproved = false;
    await review.save();

    // Update product rating
    await this.updateProductRating(review.productId.toString());

    return review;
  }

  async delete(id: string) {
    const review = await this.reviewModel.findById(id);
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    const productId = review.productId.toString();
    await this.reviewModel.findByIdAndDelete(id);

    // Update product rating
    await this.updateProductRating(productId);

    return { message: 'Review deleted successfully' };
  }

  private async updateProductRating(productId: string) {
    const reviews = await this.reviewModel.find({
      productId,
      isApproved: true,
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

