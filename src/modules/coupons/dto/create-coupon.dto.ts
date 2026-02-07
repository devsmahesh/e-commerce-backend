import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsArray,
  Min,
  IsOptional,
} from 'class-validator';
import { CouponType } from '../schemas/coupon.schema';

export class CreateCouponDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: CouponType })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  minPurchase: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscount?: number;

  @ApiProperty()
  @IsDateString()
  expiresAt: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  usageLimit?: number;

  @ApiPropertyOptional({ default: true, description: 'Coupon active status' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Alias for isActive - coupon active status' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableCategories?: string[];
}

