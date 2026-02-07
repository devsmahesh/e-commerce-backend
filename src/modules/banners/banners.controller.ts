import {
  Controller,
  Get,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { BannersService } from './banners.service';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('banners')
@Controller('banners')
export class BannersController {
  constructor(private readonly bannersService: BannersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get active banners for public display' })
  @ApiQuery({ name: 'position', required: false, enum: ['hero', 'sidebar', 'footer'], description: 'Filter by position' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'Banners retrieved successfully' })
  async findAll(
    @Query('position') position?: string,
    @Query('active') active?: string,
  ) {
    return this.bannersService.findAll({
      position,
      active: active !== undefined ? active === 'true' : undefined,
    });
  }
}

