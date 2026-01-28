import { Controller, Get, Put, Delete, Post, Param, Query, UseGuards, Body, Patch } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateBannerDto } from './dto/create-banner.dto';
import { UpdateBannerDto } from './dto/update-banner.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@ApiBearerAuth('JWT-auth')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard stats retrieved' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/revenue')
  @ApiOperation({ summary: 'Get revenue data for charts' })
  @ApiResponse({ status: 200, description: 'Revenue data retrieved' })
  async getDashboardRevenue(@Query('period') period?: string) {
    return this.adminService.getDashboardRevenue(period);
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
    @Query('isApproved') isApproved?: string,
  ) {
    return this.adminService.getAllReviews(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      productId,
      isApproved === 'true' ? true : isApproved === 'false' ? false : undefined,
    );
  }

  @Put('reviews/:id/status')
  @ApiOperation({ summary: 'Update review approval status' })
  @ApiResponse({ status: 200, description: 'Review status updated' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async updateReviewStatus(
    @Param('id') id: string,
    @Body('isApproved') isApproved: boolean,
  ) {
    return this.adminService.updateReviewStatus(id, isApproved);
  }

  @Delete('reviews/:id')
  @ApiOperation({ summary: 'Delete a review' })
  @ApiResponse({ status: 200, description: 'Review deleted successfully' })
  @ApiResponse({ status: 404, description: 'Review not found' })
  async deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }
}

