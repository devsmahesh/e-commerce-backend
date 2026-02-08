import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  IsBoolean,
  IsOptional,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
  ArrayMinSize,
  ValidateIf,
  ValidateNested,
  ArrayUnique,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ProductVariantDto {
  @ApiProperty({ description: 'Variant name (e.g., "1 Ltr", "500 ml")' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsNumber()
  @Min(0.01)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.compareAtPrice !== undefined && o.compareAtPrice !== null)
  compareAtPrice?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ type: [String], description: 'Tags like "BEST SELLER", "MONEY SAVER"' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ProductDetailSectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Content is required when enabled is true' })
  @IsOptional()
  @IsString()
  @ValidateIf((o) => o.enabled === true)
  @IsNotEmpty()
  content?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  enabled: boolean;
}

export class ProductDetailsDto {
  @ApiPropertyOptional({ type: ProductDetailSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDetailSectionDto)
  whyChooseUs?: ProductDetailSectionDto;

  @ApiPropertyOptional({ type: ProductDetailSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDetailSectionDto)
  keyBenefits?: ProductDetailSectionDto;

  @ApiPropertyOptional({ type: ProductDetailSectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDetailSectionDto)
  refundPolicy?: ProductDetailSectionDto;
}

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

  @ApiPropertyOptional({ 
    description: 'Base price (used if no variants provided). If variants exist, this can be used as fallback or ignored.'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => !o.variants || o.variants.length === 0)
  price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.compareAtPrice !== undefined)
  @Max(999999, { message: 'compareAtPrice must be less than 999999' })
  compareAtPrice?: number;

  @ApiPropertyOptional({ 
    description: 'Base stock (used if no variants provided). If variants exist, this can be used as fallback or ignored.'
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => !o.variants || o.variants.length === 0)
  stock?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dimensions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  specifications?: Record<string, any>;

  @ApiPropertyOptional({ 
    type: [ProductVariantDto],
    description: 'Product variants (sizes with different prices). Optional - if not provided, product uses base price/stock.'
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({
    type: ProductDetailsDto,
    description: 'Collapsible product details sections (Why Choose Us, Key Benefits, Refund Policy). Optional.'
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDetailsDto)
  details?: ProductDetailsDto;

  // Ghee-specific fields
  @ApiPropertyOptional({ enum: ['cow', 'buffalo', 'mixed'], description: 'Type of ghee' })
  @IsOptional()
  @IsEnum(['cow', 'buffalo', 'mixed'])
  gheeType?: 'cow' | 'buffalo' | 'mixed';

  @ApiPropertyOptional({ description: 'Purity percentage (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  purity?: number;

  @ApiPropertyOptional({ description: 'Origin/region (e.g., "Punjab, India")' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  origin?: string;

  @ApiPropertyOptional({ description: 'Shelf life information (e.g., "12 months")' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shelfLife?: string;

  @ApiPropertyOptional({ description: 'Brand name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  brand?: string;
}

