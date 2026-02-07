import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { FlashDealType, ButtonVariant } from '../schemas/flash-deal.schema';

export class CreateFlashDealDto {
  @ApiProperty({
    example: 'Up to 50% Off',
    description: 'Deal title (3-100 characters)',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    example: 'Selected ghee products with massive discounts. Shop now before they\'re gone!',
    description: 'Deal description (10-500 characters)',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(500)
  description: string;

  @ApiProperty({
    enum: FlashDealType,
    example: FlashDealType.Discount,
    description: 'Type of flash deal',
  })
  @IsEnum(FlashDealType)
  type: FlashDealType;

  @ApiPropertyOptional({
    example: 50,
    description: 'Discount percentage (0-100). Required when type is discount',
    minimum: 0,
    maximum: 100,
  })
  @ValidateIf((o) => o.type === FlashDealType.Discount)
  @IsNotEmpty({ message: 'discountPercentage is required when type is discount' })
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPercentage?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Minimum purchase amount',
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPurchaseAmount?: number;

  @ApiPropertyOptional({
    example: '/products?sort=discount',
    description: 'Link URL or path',
  })
  @IsOptional()
  @IsString()
  link?: string;

  @ApiPropertyOptional({
    example: 'Shop Flash Deals',
    description: 'Button text (max 50 characters)',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  buttonText?: string;

  @ApiPropertyOptional({
    enum: ButtonVariant,
    example: ButtonVariant.Default,
    description: 'Button variant style',
    default: ButtonVariant.Default,
  })
  @IsOptional()
  @IsEnum(ButtonVariant)
  buttonVariant?: ButtonVariant;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the deal is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiProperty({
    example: '2024-01-01T00:00:00.000Z',
    description: 'Start date in ISO 8601 format',
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @ApiProperty({
    example: '2024-01-31T23:59:59.000Z',
    description: 'End date in ISO 8601 format. Must be after startDate',
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Priority for sorting (higher values appear first)',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  priority?: number;
}

