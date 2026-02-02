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
} from 'class-validator';

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

  @ApiProperty()
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.compareAtPrice !== undefined)
  @Max(999999, { message: 'compareAtPrice must be less than 999999' })
  compareAtPrice?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  stock: number;

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

  @ApiPropertyOptional()
  @IsOptional()
  variants?: Record<string, any>;

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

