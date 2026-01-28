import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ 
    example: 'John Doe', 
    description: 'Full name (alternative to firstName + lastName). If provided, firstName and lastName will be ignored.' 
  })
  @ValidateIf((o) => !o.firstName && !o.lastName)
  @IsString({ message: 'name must be a string' })
  @MinLength(2, { message: 'name must be at least 2 characters' })
  @MaxLength(100, { message: 'name must be at most 100 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'John' })
  @ValidateIf((o) => !o.name)
  @IsString({ message: 'firstName must be a string' })
  @MinLength(2, { message: 'firstName must be at least 2 characters' })
  @MaxLength(50, { message: 'firstName must be at most 50 characters' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @ValidateIf((o) => !o.name)
  @IsString({ message: 'lastName must be a string' })
  @MinLength(2, { message: 'lastName must be at least 2 characters' })
  @MaxLength(50, { message: 'lastName must be at most 50 characters' })
  lastName?: string;

  @ApiProperty({
    example: 'SecurePass123!',
    description: 'Password must be at least 8 characters, contain uppercase, lowercase, number and special character',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiProperty({ example: '+1234567890', required: false })
  @IsOptional()
  @IsString()
  phone?: string;
}

