import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { AddAddressDto } from './dto/add-address.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { multerConfig } from '../../common/config/multer.config';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, updateProfileDto);
  }

  @Put('profile/change-password')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } }) // 5 requests per hour
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Password has been changed successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid current password, same password, or weak password',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Current password is incorrect' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 429,
    description: 'Too many requests',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: { type: 'string', example: 'Too many requests. Please try again later' },
      },
    },
  })
  async changePassword(
    @CurrentUser() user: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(user.id, changePasswordDto);
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar', multerConfig))
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file (JPG, PNG, GIF, WebP, max 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Avatar uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Avatar uploaded successfully' },
        data: {
          type: 'object',
          properties: {
            _id: { type: 'string', example: 'user_id_here' },
            id: { type: 'string', example: 'user_id_here' },
            email: { type: 'string', example: 'user@example.com' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            phone: { type: 'string', example: '+1234567890' },
            role: { type: 'string', example: 'user' },
            avatar: { type: 'string', example: 'https://res.cloudinary.com/.../avatars/avatar.jpg' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
            updatedAt: { type: 'string', example: '2024-01-15T10:30:00.000Z' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size, or no file provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 500, description: 'Failed to upload avatar' })
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No avatar file provided.');
    }

    return this.usersService.uploadAvatar(user.id, file);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get user addresses' })
  @ApiResponse({ status: 200, description: 'Addresses retrieved successfully' })
  async getAddresses(@CurrentUser() user: any) {
    return this.usersService.getAddresses(user.id);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Add new address' })
  @ApiResponse({ status: 201, description: 'Address added successfully' })
  async addAddress(
    @CurrentUser() user: any,
    @Body() addAddressDto: AddAddressDto,
  ) {
    return this.usersService.addAddress(user.id, addAddressDto);
  }

  @Put('addresses/:addressId')
  @ApiOperation({ summary: 'Update address' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  async updateAddress(
    @CurrentUser() user: any,
    @Param('addressId') addressId: string,
    @Body() updateData: Partial<AddAddressDto>,
  ) {
    return this.usersService.updateAddress(user.id, addressId, updateData);
  }

  @Delete('addresses/:addressId')
  @ApiOperation({ summary: 'Delete address' })
  @ApiResponse({ status: 200, description: 'Address deleted successfully' })
  async deleteAddress(
    @CurrentUser() user: any,
    @Param('addressId') addressId: string,
  ) {
    return this.usersService.deleteAddress(user.id, addressId);
  }

  @Get('wishlist')
  @ApiOperation({ summary: 'Get user wishlist' })
  @ApiResponse({ status: 200, description: 'Wishlist retrieved successfully' })
  async getWishlist(@CurrentUser() user: any) {
    return this.usersService.getWishlist(user.id);
  }

  @Post('wishlist/:productId')
  @ApiOperation({ summary: 'Add product to wishlist' })
  @ApiResponse({ status: 201, description: 'Product added to wishlist' })
  async addToWishlist(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.usersService.addToWishlist(user.id, productId);
  }

  @Delete('wishlist/:productId')
  @ApiOperation({ summary: 'Remove product from wishlist' })
  @ApiResponse({ status: 200, description: 'Product removed from wishlist' })
  async removeFromWishlist(
    @CurrentUser() user: any,
    @Param('productId') productId: string,
  ) {
    return this.usersService.removeFromWishlist(user.id, productId);
  }
}

