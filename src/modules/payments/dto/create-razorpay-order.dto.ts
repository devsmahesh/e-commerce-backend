import { IsString, IsOptional, IsObject, IsMongoId, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * CreateRazorpayOrderDto
 * 
 * Note: Amount is NOT accepted from frontend.
 * Amount is fetched from database (source of truth).
 * This prevents fraud by ensuring frontend cannot manipulate payment amounts.
 */
export class CreateRazorpayOrderDto {
  @ApiProperty({
    description: 'Order ID from database (MongoDB ObjectId). Amount will be fetched from this order.',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsNotEmpty({ message: 'orderId is required' })
  @IsMongoId({ message: 'orderId must be a valid MongoDB ObjectId' })
  orderId: string;

  @ApiPropertyOptional({
    description: 'Currency code (default: INR). If not provided, uses order currency.',
    example: 'INR',
    default: 'INR',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Receipt ID (e.g., order number). If not provided, uses order.orderNumber.',
    example: 'ORD-ABC123',
  })
  @IsString()
  @IsOptional()
  receipt?: string;

  @ApiPropertyOptional({
    description: 'Optional notes/metadata to include in Razorpay order',
    example: { customNote: 'Special handling required' },
  })
  @IsObject()
  @IsOptional()
  notes?: Record<string, string>;
}

