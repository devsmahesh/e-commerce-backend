import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'abc123def456...',
    description: 'Password reset token from email link',
  })
  @IsString()
  token: string;

  @ApiProperty({
    example: 'newSecurePassword123',
    description: 'New password (minimum 6 characters)',
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password: string;
}

