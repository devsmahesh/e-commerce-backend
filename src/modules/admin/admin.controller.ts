import { Controller, Get, Put, Delete, Post, Param, Query, UseGuards, Body, Patch, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdminService } from './admin.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { ReviewStatus } from '../reviews/schemas/review.schema';
import { ContactStatus } from '../contact/schemas/contact.schema';
import { UpdateContactDto } from '../contact/dto/update-contact.dto';
import { ContactService } from '../contact/contact.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FileUploadService } from '../../common/services/file-upload.service';
import { multerConfig } from '../../common/config/multer.config';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly fileUploadService: FileUploadService,
    private readonly contactService: ContactService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get comprehensive dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid period parameter' })
  async getDashboardStats(@Query('period') period?: string) {
    return this.adminService.getDashboardStats(period || '30d');
  }

  @Get('dashboard/revenue')
  @ApiOperation({ summary: 'Get revenue and orders data grouped by date for charts' })
  @ApiResponse({ status: 200, description: 'Revenue data retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid period parameter' })
  async getDashboardRevenue(
    @Query('period') period?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminService.getDashboardRevenue(period || '30d', startDate, endDate);
  }

  @Get('dashboard/recent-orders')
  @ApiOperation({ summary: 'Get the most recent orders for quick overview' })
  @ApiResponse({ status: 200, description: 'Recent orders retrieved successfully' })
  async getRecentOrders(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.adminService.getRecentOrders(limitNum);
  }

  @Get('dashboard/top-products')
  @ApiOperation({ summary: 'Get top selling products by revenue or quantity sold' })
  @ApiResponse({ status: 200, description: 'Top products retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid period parameter' })
  async getTopProducts(
    @Query('limit') limit?: string,
    @Query('period') period?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 5;
    return this.adminService.getTopProducts(limitNum, period || '30d');
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.adminService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User retrieved successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    return this.adminService.getUserById(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user information' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Put('users/:id/status')
  @ApiOperation({ summary: 'Update user status' })
  @ApiResponse({ status: 200, description: 'User status updated' })
  async updateUserStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.adminService.updateUserStatus(id, isActive);
  }

  @Put('users/:id/role')
  @ApiOperation({ summary: 'Update user role (promote to admin)' })
  @ApiResponse({ status: 200, description: 'User role updated' })
  async updateUserRole(
    @Param('id') id: string,
    @Body('role') role: string,
  ) {
    return this.adminService.updateUserRole(id, role);
  }

  // Banner Management
  @Post('banners/upload-image')
  @ApiOperation({ summary: 'Upload banner image (Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPG, PNG, GIF, WebP, max 5MB)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Image uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Image uploaded successfully' },
        data: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              example: 'https://res.cloudinary.com/your-cloud/banners/image.jpg',
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid file type or size, or no file provided' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @ApiResponse({ status: 500, description: 'Failed to upload image' })
  @UseInterceptors(FileInterceptor('image', multerConfig))
  async uploadBannerImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No image file provided.');
    }

    const result = await this.fileUploadService.uploadImage(file, 'banners');

    return {
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: result.url,
      },
    };
  }

  @Get('banners')
  @ApiOperation({ summary: 'Get all banners' })
  @ApiResponse({ status: 200, description: 'Banners retrieved successfully' })
  async getAllBanners() {
    return this.adminService.getAllBanners();
  }

  @Get('banners/:id')
  @ApiOperation({ summary: 'Get banner by ID' })
  @ApiResponse({ status: 200, description: 'Banner retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async getBannerById(@Param('id') id: string) {
    return this.adminService.getBannerById(id);
  }

  @Post('banners')
  @ApiOperation({ summary: 'Create a new banner' })
  @ApiResponse({ status: 201, description: 'Banner created successfully' })
  async createBanner(@Body() createBannerDto: CreateBannerDto) {
    return this.adminService.createBanner(createBannerDto);
  }

  @Patch('banners/:id')
  @ApiOperation({ summary: 'Update a banner' })
  @ApiResponse({ status: 200, description: 'Banner updated successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async updateBanner(
    @Param('id') id: string,
    @Body() updateBannerDto: UpdateBannerDto,
  ) {
    return this.adminService.updateBanner(id, updateBannerDto);
  }

  @Delete('banners/:id')
  @ApiOperation({ summary: 'Delete a banner' })
  @ApiResponse({ status: 200, description: 'Banner deleted successfully' })
  @ApiResponse({ status: 404, description: 'Banner not found' })
  async deleteBanner(@Param('id') id: string) {
    return this.adminService.deleteBanner(id);
  }

  // Reviews Management
  @Get('reviews')
  @ApiOperation({ summary: 'Get all reviews with filters' })
  @ApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  async getAllReviews(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
  ) {
    let reviewStatus: ReviewStatus | undefined;
    if (status) {
      // Validate status value
      if (Object.values(ReviewStatus).includes(status as ReviewStatus)) {
        reviewStatus = status as ReviewStatus;
      }
    }
    
    return this.adminService.getAllReviews(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      productId,
      reviewStatus,
    );
  }

  @Put('reviews/:id/status')
  @ApiOperation({ summary: 'Update review status (pending/approved/rejected)' })
  @ApiResponse({ status: 200, description: 'Review status updated' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  @ApiResponse({ status: 400, description: 'Invalid status value' })
  async updateReviewStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    // Validate status
    if (!Object.values(ReviewStatus).includes(status as ReviewStatus)) {
      throw new BadRequestException(`Invalid status. Must be one of: ${Object.values(ReviewStatus).join(', ')}`);
    }
    return this.adminService.updateReviewStatus(id, status as ReviewStatus);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }

  // Contact Management
  @Get('contacts')
  @ApiOperation({ summary: 'Get all contact form submissions' })
  @ApiResponse({ status: 200, description: 'Contacts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllContacts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    let contactStatus: ContactStatus | undefined;
    if (status) {
      if (Object.values(ContactStatus).includes(status as ContactStatus)) {
        contactStatus = status as ContactStatus;
      } else {
        throw new BadRequestException(
          `Invalid status. Must be one of: ${Object.values(ContactStatus).join(', ')}`,
        );
      }
    }

    const result = await this.contactService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      contactStatus,
      search,
    );

    return {
      success: true,
      message: 'Contacts retrieved successfully',
      data: result,
    };
  }

  @Get('contacts/:id')
  @ApiOperation({ summary: 'Get contact submission by ID' })
  @ApiResponse({ status: 200, description: 'Contact retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getContactById(@Param('id') id: string) {
    const contact = await this.contactService.findOne(id);
    return {
      success: true,
      message: 'Contact retrieved successfully',
      data: contact,
    };
  }

  @Patch('contacts/:id')
  @ApiOperation({ summary: 'Update contact status and notes' })
  @ApiResponse({ status: 200, description: 'Contact updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid status or notes too long' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async updateContact(
    @Param('id') id: string,
    @Body() updateContactDto: UpdateContactDto,
    @CurrentUser() user: any,
  ) {
    const contact = await this.contactService.update(id, updateContactDto, user.id);
    return {
      success: true,
      message: 'Contact updated successfully',
      data: contact,
    };
  }

  @Delete('contacts/:id')
  @ApiOperation({ summary: 'Delete a contact submission' })
  @ApiResponse({ status: 200, description: 'Contact deleted successfully' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async deleteContact(@Param('id') id: string) {
    await this.contactService.delete(id);
    return {
      success: true,
      message: 'Contact deleted successfully',
    };
  }
}

