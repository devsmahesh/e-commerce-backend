import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.Admin)
@ApiBearerAuth('JWT-auth')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('revenue')
  @ApiOperation({ summary: 'Get revenue statistics' })
  @ApiResponse({ status: 200, description: 'Revenue stats retrieved' })
  async getRevenueStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.analyticsService.getRevenueStats(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get('daily-revenue')
  @ApiOperation({ summary: 'Get daily revenue for the last N days' })
  @ApiResponse({ status: 200, description: 'Daily revenue retrieved' })
  async getDailyRevenue(@Query('days') days?: string) {
    return this.analyticsService.getDailyRevenue(days ? parseInt(days) : 30);
  }

  @Get('monthly-sales')
  @ApiOperation({ summary: 'Get monthly sales for the last N months' })
  @ApiResponse({ status: 200, description: 'Monthly sales retrieved' })
  async getMonthlySales(@Query('months') months?: string) {
    return this.analyticsService.getMonthlySales(months ? parseInt(months) : 12);
  }

  @Get('best-selling')
  @ApiOperation({ summary: 'Get best selling products' })
  @ApiResponse({ status: 200, description: 'Best sellers retrieved' })
  async getBestSellingProducts(@Query('limit') limit?: string) {
    return this.analyticsService.getBestSellingProducts(limit ? parseInt(limit) : 10);
  }

  @Get('user-growth')
  @ApiOperation({ summary: 'Get user growth statistics' })
  @ApiResponse({ status: 200, description: 'User growth retrieved' })
  async getUserGrowth(@Query('days') days?: string) {
    return this.analyticsService.getUserGrowth(days ? parseInt(days) : 30);
  }

  @Get('top-categories')
  @ApiOperation({ summary: 'Get top selling categories' })
  @ApiResponse({ status: 200, description: 'Top categories retrieved' })
  async getTopCategories(@Query('limit') limit?: string) {
    return this.analyticsService.getTopCategories(limit ? parseInt(limit) : 10);
  }
}

