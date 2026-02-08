import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, name, firstName, lastName, phone } = registerDto;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const existingUser = await this.userModel.findOne({ email: normalizedEmail });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Split name into firstName and lastName if name is provided
    let finalFirstName: string;
    let finalLastName: string;
    
    if (name) {
      const nameParts = name.trim().split(/\s+/);
      finalFirstName = nameParts[0] || '';
      finalLastName = nameParts.slice(1).join(' ') || nameParts[0] || '';
      
      // Validate split names meet requirements
      if (finalFirstName.length < 2 || finalFirstName.length > 50) {
        throw new BadRequestException('Name must split into firstName (2-50 characters) and lastName (2-50 characters)');
      }
      if (finalLastName.length < 2 || finalLastName.length > 50) {
        throw new BadRequestException('Name must split into firstName (2-50 characters) and lastName (2-50 characters)');
      }
    } else {
      if (!firstName || !lastName) {
        throw new BadRequestException('Either provide "name" or both "firstName" and "lastName"');
      }
      finalFirstName = firstName;
      finalLastName = lastName;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const emailVerificationToken = uuidv4();
    const emailVerificationExpires = new Date();
    emailVerificationExpires.setHours(emailVerificationExpires.getHours() + 24);

    // Create user
    const user = await this.userModel.create({
      email: normalizedEmail,
      password: hashedPassword,
      firstName: finalFirstName,
      lastName: finalLastName,
      phone,
      emailVerificationToken,
      emailVerificationExpires,
    });

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(user.email, emailVerificationToken);
    } catch (error) {
      // Log error but don't fail registration if email fails
      console.error('Failed to send verification email:', error);
    }

    const { password: _, refreshTokens: __, ...userObject } = user.toObject();

    return {
      user: userObject,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Find user
    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);

    const { password: _, refreshTokens: __, ...userObject } = user.toObject();

    return {
      user: userObject,
      ...tokens,
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(refreshTokenDto.refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Check if refresh token is valid
      if (!user.refreshTokens || !user.refreshTokens.includes(payload.tokenId)) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user._id.toString(), user.email, user.role);

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async verifyEmail(token: string) {
    const user = await this.userModel.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    const user = await this.userModel.findOne({ email: normalizedEmail });
    if (!user) {
      // Don't reveal if user exists for security
      return { message: 'If the email exists, a password reset link has been sent' };
    }

    // Generate reset token
    const passwordResetToken = uuidv4();
    const passwordResetExpires = new Date();
    passwordResetExpires.setHours(passwordResetExpires.getHours() + 1);

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    // Check email service configuration
    const emailStatus = this.emailService.getEmailStatus();
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

    // Send password reset email
    let emailSent = false;
    let emailError: string | null = null;
    
    console.log('\n=== FORGOT PASSWORD REQUEST ===');
    console.log('User email:', user.email);
    console.log('Reset token generated:', passwordResetToken.substring(0, 8) + '...');
    console.log('Email service configured:', emailStatus.configured);
    
    try {
      await this.emailService.sendPasswordResetEmail(user.email, passwordResetToken);
      emailSent = true;
      const successMsg = `Password reset email sent successfully to ${user.email}`;
      this.logger.log(successMsg);
      console.log('✅', successMsg);
    } catch (error) {
      // Log error but don't reveal if email failed for security
      emailError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send password reset email to ${user.email}:`, error);
      this.logger.error('Error details:', emailError);
      console.error('❌ Failed to send password reset email:', emailError);
      // Still return success message for security (don't reveal if user exists)
    }
    console.log('==================================\n');

    const response: any = { 
      message: 'If the email exists, a password reset link has been sent' 
    };

    // Include debug info in development mode
    if (isDevelopment) {
      response.debug = {
        emailServiceConfigured: emailStatus.configured,
        emailSent,
        emailStatus: {
          service: emailStatus.service || 'Not configured',
          hasApiKey: emailStatus.hasApiKey,
        },
        ...(emailError && { emailError }),
      };
    }

    return response;
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    const user = await this.userModel.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return { message: 'Password reset successfully' };
  }

  async logout(userId: string, refreshToken: string) {
    const user = await this.userModel.findById(userId);
    if (user && user.refreshTokens) {
      user.refreshTokens = user.refreshTokens.filter(
        (token) => token !== refreshToken,
      );
      await user.save();
    }

    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const tokenId = uuidv4();
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    });

    const refreshToken = this.jwtService.sign(
      { ...payload, tokenId },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      },
    );

    // Save refresh token to user
    const user = await this.userModel.findById(userId);
    if (user) {
      if (!user.refreshTokens) {
        user.refreshTokens = [];
      }
      user.refreshTokens.push(tokenId);
      // Keep only last 5 refresh tokens
      if (user.refreshTokens.length > 5) {
        user.refreshTokens = user.refreshTokens.slice(-5);
      }
      await user.save();
    }

    return {
      accessToken,
      refreshToken,
    };
  }
}

