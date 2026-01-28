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

  async create(createCouponDto: CreateCouponDto) {
    const code = createCouponDto.code.toUpperCase();

    // Check if coupon code exists
    const existingCoupon = await this.couponModel.findOne({ code });
    if (existingCoupon) {
      throw new ConflictException('Coupon code already exists');
    }

    const coupon = await this.couponModel.create({
      ...createCouponDto,
      code,
    });

    return coupon;
  }

  async findAll(includeInactive = false) {
    const query: any = {};
    if (!includeInactive) {
      query.isActive = true;
      query.expiresAt = { $gt: new Date() };
    }

    return this.couponModel.find(query).sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }
    return coupon;
  }

  async findByCode(code: string) {
    const coupon = await this.couponModel.findOne({
      code: code.toUpperCase(),
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!coupon) {
      throw new NotFoundException('Invalid or expired coupon');
    }

    return coupon;
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

    const updatedCoupon = await this.couponModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    return updatedCoupon;
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

