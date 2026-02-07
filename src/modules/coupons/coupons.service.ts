import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coupon, CouponDocument, CouponType } from './schemas/coupon.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<CouponDocument>,
  ) {}

  /**
   * Helper method to add isExpired field to coupon response
   * If coupon is expired, automatically set isActive to false
   */
  private addIsExpiredToCoupon(coupon: any): any {
    const couponObj = coupon.toObject ? coupon.toObject() : coupon;
    const now = new Date();
    const isExpired = couponObj.expiresAt 
      ? new Date(couponObj.expiresAt) < now 
      : false;
    
    // If coupon is expired, set isActive to false
    const isActive = isExpired ? false : couponObj.isActive;
    
    return {
      ...couponObj,
      isExpired,
      isActive, // Override isActive if expired
    };
  }

  /**
   * Helper method to add isExpired field to array of coupons
   */
  private addIsExpiredToCoupons(coupons: any[]): any[] {
    return coupons.map(coupon => this.addIsExpiredToCoupon(coupon));
  }

  async create(createCouponDto: CreateCouponDto) {
    const code = createCouponDto.code.toUpperCase();

    // Check if coupon code exists
    const existingCoupon = await this.couponModel.findOne({ code });
    if (existingCoupon) {
      throw new ConflictException('Coupon code already exists');
    }

    // Handle active/isActive field - support both 'active' and 'isActive'
    const isActive = (createCouponDto as any).active !== undefined 
      ? (createCouponDto as any).active 
      : (createCouponDto.isActive !== undefined ? createCouponDto.isActive : true);

    // Remove 'active' from DTO to avoid storing it in DB
    const { active, ...couponData } = createCouponDto as any;

    // Default isActive to true if not provided
    const coupon = await this.couponModel.create({
      ...couponData,
      code,
      isActive,
    });

    return this.addIsExpiredToCoupon(coupon);
  }

  async findAll(includeInactive = true) {
    const query: any = {};
    // By default, return all coupons (both active and inactive)
    // Only filter if explicitly requested to exclude inactive
    if (!includeInactive) {
      query.isActive = true;
      query.expiresAt = { $gt: new Date() };
    }

    const coupons = await this.couponModel.find(query).sort({ createdAt: -1 }).exec();
    return this.addIsExpiredToCoupons(coupons);
  }

  async findOne(id: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return this.addIsExpiredToCoupon(coupon);
  }

  async findByCode(code: string) {
    // First, find coupon without filtering by isActive (for security check)
    const coupon = await this.couponModel.findOne({
      code: code.toUpperCase(),
    });

    if (!coupon) {
      throw new NotFoundException('Coupon not found or invalid');
    }

    // CRITICAL: Check active status FIRST (before other validations)
    // Return generic error message for security (don't reveal coupon exists if inactive)
    if (!coupon.isActive) {
      throw new NotFoundException('Coupon not found or invalid');
    }

    // Check expiration
    const now = new Date();
    if (coupon.expiresAt && now > coupon.expiresAt) {
      throw new BadRequestException('Coupon has expired');
    }

    // Check usage limit
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    return this.addIsExpiredToCoupon(coupon);
  }

  async validateCoupon(code: string, subtotal: number, categoryIds?: string[]) {
    const coupon = await this.findByCode(code);

    // Check usage limit
    if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
      throw new BadRequestException('Coupon usage limit exceeded');
    }

    // Check minimum purchase
    if (subtotal < coupon.minPurchase) {
      throw new BadRequestException(
        `Minimum purchase of $${coupon.minPurchase} required`,
      );
    }

    // Check category restrictions
    if (
      coupon.applicableCategories &&
      coupon.applicableCategories.length > 0 &&
      categoryIds
    ) {
      const hasApplicableCategory = categoryIds.some((id) =>
        coupon.applicableCategories!.includes(id),
      );
      if (!hasApplicableCategory) {
        throw new BadRequestException('Coupon not applicable to selected items');
      }
    }

    return coupon;
  }

  async applyCoupon(code: string, subtotal: number, categoryIds?: string[]) {
    const coupon = await this.validateCoupon(code, subtotal, categoryIds);

    let discount = 0;
    if (coupon.type === CouponType.Percentage) {
      discount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscount) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = Math.min(coupon.value, subtotal);
    }

    return {
      coupon,
      discount,
      finalAmount: subtotal - discount,
    };
  }

  async incrementUsage(code: string) {
    const coupon = await this.findByCode(code);
    coupon.usageCount += 1;
    await coupon.save();
  }

  async update(id: string, updateData: Partial<CreateCouponDto>) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (updateData.code) {
      const newCode = updateData.code.toUpperCase();
      if (newCode !== coupon.code) {
        const existingCoupon = await this.couponModel.findOne({
          code: newCode,
          _id: { $ne: id },
        });
        if (existingCoupon) {
          throw new ConflictException('Coupon code already exists');
        }
        updateData.code = newCode;
      }
    }

    // Handle active/isActive field - support both 'active' and 'isActive'
    const updatePayload: any = { ...updateData };
    if ((updateData as any).active !== undefined) {
      updatePayload.isActive = (updateData as any).active;
      delete updatePayload.active; // Remove 'active' to avoid storing it
    }

    const updatedCoupon = await this.couponModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true },
    );

    return this.addIsExpiredToCoupon(updatedCoupon);
  }

  async remove(id: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    await this.couponModel.findByIdAndDelete(id);
    return { message: 'Coupon deleted successfully' };
  }
}

