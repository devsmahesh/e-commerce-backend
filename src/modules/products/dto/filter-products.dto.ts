import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  Min,
  Max,
  IsArray,
  IsBoolean,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FilterProductsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Type(() => String)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ enum: ['price', 'rating', 'createdAt', 'salesCount'] })
  @IsOptional()
  @IsString()
  sortBy?: 'price' | 'rating' | 'createdAt' | 'salesCount';

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  // Ghee-specific filters
  @ApiPropertyOptional({ enum: ['cow', 'buffalo', 'mixed'], description: 'Filter by ghee type' })
  @IsOptional()
  @IsEnum(['cow', 'buffalo', 'mixed'])
  gheeType?: 'cow' | 'buffalo' | 'mixed';

  @ApiPropertyOptional({ description: 'Minimum weight in grams' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minWeight?: number;

  @ApiPropertyOptional({ description: 'Maximum weight in grams' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxWeight?: number;

  @ApiPropertyOptional({ description: 'Minimum purity percentage' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minPurity?: number;

  @ApiPropertyOptional({ description: 'Filter by origin/region' })
  @IsOptional()
  @IsString()
  origin?: string;
}

