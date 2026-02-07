import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsNumber, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { FlashDealType } from '../schemas/flash-deal.schema';

export class QueryFlashDealDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Filter by active status',
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    example: 10,
    description: 'Limit number of results',
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({
    enum: FlashDealType,
    description: 'Filter by deal type',
  })
  @IsOptional()
  @IsEnum(FlashDealType)
  type?: FlashDealType;
}

