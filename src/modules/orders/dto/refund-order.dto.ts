import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';

export class RefundOrderDto {
  @ApiPropertyOptional({
    description: 'Partial refund amount in rupees. If not provided, full refund will be processed.',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01, { message: 'Refund amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({
    description: 'Reason for refund',
    example: 'Customer request',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

