import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ContactStatus } from '../schemas/contact.schema';

export class UpdateContactDto {
  @ApiPropertyOptional({
    enum: ContactStatus,
    description: 'Contact status',
    example: 'replied',
  })
  @IsOptional()
  @IsEnum(ContactStatus, {
    message: 'Status must be one of: pending, read, replied, archived',
  })
  status?: ContactStatus;

  @ApiPropertyOptional({
    description: 'Admin notes (max 1000 characters)',
    example: 'Customer inquiry about bulk orders. Responded via email on 2024-01-16.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Notes must not exceed 1000 characters' })
  notes?: string;
}

