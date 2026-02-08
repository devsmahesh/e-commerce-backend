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
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from './schemas/user.schema';
import {
  PasswordResetToken,
  PasswordResetTokenDocument,
} from './schemas/password-reset-token.schema';
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
    @InjectModel(PasswordResetToken.name)
    private passwordResetTokenModel: Model<PasswordResetTokenDocument>,
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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();

    // Find user (but don't reveal if email exists for security)
    const user = await this.userModel.findOne({ email: normalizedEmail });

    // Check for rate limiting: max 3 requests per email per hour
    if (user) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTokens = await this.passwordResetTokenModel.countDocuments({
        userId: user._id,
        createdAt: { $gte: oneHourAgo },
      });

      if (recentTokens >= 3) {
        this.logger.warn(
          `Rate limit exceeded for password reset requests: ${normalizedEmail}`,
        );
        // Still return success message to prevent email enumeration
        return {
          success: true,
          message: 'Password reset link has been sent to your email',
        };
      }
    }

    // Always return success message to prevent email enumeration
    if (!user) {
      this.logger.log(
        `Password reset requested for non-existent email: ${normalizedEmail}`,
      );
      return {
        success: true,
        message: 'Password reset link has been sent to your email',
      };
    }

    // Check if user is active
    if (!user.isActive) {
      // Still return success to prevent revealing account status
      this.logger.warn(
        `Password reset requested for inactive account: ${normalizedEmail}`,
      );
      return {
        success: true,
        message: 'Password reset link has been sent to your email',
      };
    }

    // Generate cryptographically secure reset token (64 character hex string)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour expiration

    // Create password reset token document
    await this.passwordResetTokenModel.create({
      userId: user._id,
      token,
      expiresAt,
      used: false,
    });

    // Log the request for security monitoring
    this.logger.log(
      `Password reset token generated for user: ${user.email} (ID: ${user._id})`,
    );

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(
        user.email,
        user.firstName,
        token,
      );
      this.logger.log(
        `Password reset email sent successfully to ${user.email}`,
      );
    } catch (error) {
      // Log error but don't reveal if email failed for security
      this.logger.error(
        `Failed to send password reset email to ${user.email}:`,
        error instanceof Error ? error.message : String(error),
      );
      // Still return success message for security
    }

    return {
      success: true,
      message: 'Password reset link has been sent to your email',
    };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, password } = resetPasswordDto;

    // Validate input
    if (!token || !password) {
      throw new BadRequestException('Token and password are required');
    }

    // Validate password length
    if (password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    // Find the reset token
    const resetToken = await this.passwordResetTokenModel.findOne({ token });

    if (!resetToken) {
      this.logger.warn(`Invalid password reset token attempted: ${token.substring(0, 8)}...`);
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if token is already used
    if (resetToken.used) {
      this.logger.warn(
        `Attempted to use already-used password reset token: ${token.substring(0, 8)}...`,
      );
      throw new BadRequestException(
        'This reset link has already been used. Please request a new one',
      );
    }

    // Check if token is expired
    if (new Date() > resetToken.expiresAt) {
      this.logger.warn(
        `Attempted to use expired password reset token: ${token.substring(0, 8)}...`,
      );
      throw new BadRequestException(
        'Reset token has expired. Please request a new one',
      );
    }

    // Find the user
    const user = await this.userModel.findById(resetToken.userId);
    if (!user) {
      this.logger.error(
        `Password reset token references non-existent user: ${resetToken.userId}`,
      );
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new BadRequestException('Account is deactivated');
    }

    // Hash new password with bcrypt (12 salt rounds for better security)
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update user password
    user.password = hashedPassword;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    resetToken.usedAt = new Date();
    await resetToken.save();

    // Invalidate all existing refresh tokens for security (force re-login on all devices)
    user.refreshTokens = [];
    await user.save();

    // Log the password reset for security monitoring
    this.logger.log(
      `Password reset successful for user: ${user.email} (ID: ${user._id})`,
    );

    // Send email notification
    try {
      await this.emailService.sendPasswordChangeEmail(
        user.email,
        user.firstName,
      );
      this.logger.log(`Password reset email sent to ${user.email}`);
    } catch (error) {
      // Log error but don't fail the password reset if email fails
      this.logger.error(
        `Failed to send password reset email to ${user.email}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      success: true,
      message: 'Password has been reset successfully',
    };
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

