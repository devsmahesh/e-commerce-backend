import { IsNumber, IsString, IsOptional, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRazorpayOrderDto {
  @ApiProperty({
    description: 'Amount in paise (e.g., 10000 for ₹100)',
    example: 10000,
    minimum: 100,
  })
  @IsNumber()
  @Min(100) // Minimum ₹1
  amount: number;

  @ApiPropertyOptional({
    description: 'Currency code (default: INR)',
    example: 'INR',
    default: 'INR',
  })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Receipt ID (e.g., order number)',
    example: 'ORD-ABC123',
  })
  @IsString()
  @IsOptional()
  receipt?: string;

  @ApiPropertyOptional({
    description: 'Optional notes/metadata',
    example: { orderId: '507f1f77bcf86cd799439011', orderNumber: 'ORD-ABC123' },
  })
  @IsObject()
  @IsOptional()
  notes?: Record<string, string>;
}

