import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
  @ApiProperty({
    description: 'Razorpay order ID (received from Razorpay after order creation)',
    example: 'order_ABC123xyz',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'razorpay_order_id is required' })
  razorpay_order_id: string;

  @ApiProperty({
    description: 'Razorpay payment ID (received from Razorpay after successful payment)',
    example: 'pay_ABC123xyz',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'razorpay_payment_id is required' })
  razorpay_payment_id: string;

  @ApiProperty({
    description: 'Razorpay payment signature (received from Razorpay for signature verification)',
    example: 'abc123def456...',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'razorpay_signature is required' })
  razorpay_signature: string;

  @ApiProperty({
    description: 'Internal order ID from your database (MongoDB ObjectId)',
    example: '507f1f77bcf86cd799439011',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'orderId is required' })
  orderId: string;
}

