import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContactDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Full name (2-100 characters)',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens, and apostrophes',
  })
  @Transform(({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value))
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Valid email address (max 255 characters)',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({
    example: '1234567890',
    description: 'Phone number (10 digits for Indian format)',
  })
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @Matches(/^[0-9]{10}$/, {
    message: 'Phone number must be 10 digits',
  })
  @Transform(({ value }: { value: any }) =>
    typeof value === 'string' ? value.replace(/[\s\-\(\)]/g, '') : value,
  )
  phone: string;

  @ApiProperty({
    example: 'Product Inquiry',
    description: 'Subject of the message (3-200 characters)',
    minLength: 3,
    maxLength: 200,
  })
  @IsString({ message: 'Subject must be a string' })
  @IsNotEmpty({ message: 'Subject is required' })
  @MinLength(3, { message: 'Subject must be at least 3 characters' })
  @MaxLength(200, { message: 'Subject must not exceed 200 characters' })
  @Transform(({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value))
  subject: string;

  @ApiProperty({
    example: 'I would like to know more about your premium ghee products.',
    description: 'Message content (10-5000 characters)',
    minLength: 10,
    maxLength: 5000,
  })
  @IsString({ message: 'Message must be a string' })
  @IsNotEmpty({ message: 'Message is required' })
  @MinLength(10, { message: 'Message must be at least 10 characters' })
  @MaxLength(5000, { message: 'Message must not exceed 5000 characters' })
  @Transform(({ value }: { value: any }) => (typeof value === 'string' ? value.trim() : value))
  message: string;
}

