import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateCheckoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiProperty()
  @IsUrl()
  @IsNotEmpty()
  successUrl: string;

  @ApiProperty()
  @IsUrl()
  @IsNotEmpty()
  cancelUrl: string;
}

