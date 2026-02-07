import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { FlashDealsService } from './flash-deals.service';
import { CreateFlashDealDto } from './dto/create-flash-deal.dto';
import { UpdateFlashDealDto } from './dto/update-flash-deal.dto';
import { QueryFlashDealDto } from './dto/query-flash-deal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('flash-deals')
@Controller('flash-deals')
export class FlashDealsController {
  constructor(private readonly flashDealsService: FlashDealsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get active flash deals (Public)' })
  @ApiResponse({
    status: 200,
    description: 'Flash deals retrieved successfully',
  })
  async findActive(@Query() queryDto: QueryFlashDealDto) {
    const deals = await this.flashDealsService.findActive(queryDto);
    return {
      success: true,
      message: 'Flash deals retrieved successfully',
      data: deals,
    };
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all flash deals (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Flash deals retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async findAll(@Query() queryDto: QueryFlashDealDto) {
    const deals = await this.flashDealsService.findAll(queryDto);
    return {
      success: true,
      message: 'Flash deals retrieved successfully',
      data: deals,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get flash deal by ID (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Flash deal retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Flash deal not found' })
  async findOne(@Param('id') id: string) {
    const deal = await this.flashDealsService.findOne(id);
    return {
      success: true,
      message: 'Flash deal retrieved successfully',
      data: deal,
    };
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create flash deal (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Flash deal created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async create(@Body() createFlashDealDto: CreateFlashDealDto) {
    const deal = await this.flashDealsService.create(createFlashDealDto);
    return {
      success: true,
      message: 'Flash deal created successfully',
      data: deal,
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update flash deal (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Flash deal updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Flash deal not found' })
  async update(
    @Param('id') id: string,
    @Body() updateFlashDealDto: UpdateFlashDealDto,
  ) {
    const deal = await this.flashDealsService.update(id, updateFlashDealDto);
    return {
      success: true,
      message: 'Flash deal updated successfully',
      data: deal,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Delete flash deal (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Flash deal deleted successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Flash deal not found' })
  async remove(@Param('id') id: string) {
    await this.flashDealsService.remove(id);
    return {
      success: true,
      message: 'Flash deal deleted successfully',
    };
  }
}

