import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReviewDto {
  @ApiProperty({ description: 'Product ID' })
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ minimum: 1, maximum: 5, description: 'Rating must be an integer between 1 and 5' })
  @IsInt({ message: 'Rating must be an integer' })
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ maxLength: 1000, description: 'Review comment (max 1000 characters)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000, { message: 'Comment must not exceed 1000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  comment: string;
}

