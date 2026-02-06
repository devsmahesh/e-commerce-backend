import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create order from cart' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Cart is empty or invalid' })
  async create(
    @CurrentUser() user: any,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(user.id, createOrderDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user orders' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async findAll(@CurrentUser() user: any) {
    return this.ordersService.findAll(user.id);
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Get all orders (Admin only)' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async findAllAdmin(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.ordersService.findAll(
      undefined,
      page ? parseInt(page) : undefined,
      limit ? parseInt(limit) : undefined,
      status as any,
    );
  }

  @Get('order-number/:orderNumber')
  @ApiOperation({ summary: 'Get order by order number' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - You don\'t have permission to view this order' })
  async findByOrderNumber(
    @CurrentUser() user: any,
    @Param('orderNumber') orderNumber: string,
  ) {
    return this.ordersService.findByOrderNumber(orderNumber, user);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.id);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancel order' })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        orderNumber: { type: 'string' },
        status: { type: 'string', example: 'cancelled' },
        items: { type: 'array' },
        subtotal: { type: 'number' },
        tax: { type: 'number' },
        shipping: { type: 'number' },
        discount: { type: 'number' },
        total: { type: 'number' },
        shippingAddress: { type: 'object' },
        paymentStatus: { type: 'string' },
        paymentMethod: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Order cannot be cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden - You don\'t have permission to cancel this order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.ordersService.cancelOrder(id, user.id, user.role);
  }

  @Post(':id/refund')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Refund order (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Refund processed successfully',
    schema: {
      type: 'object',
      properties: {
        refundId: { type: 'string' },
        refundAmount: { type: 'number' },
        refundStatus: { type: 'string' },
        order: { type: 'object' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Order is not eligible for refund or refund failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async refundOrder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() refundDto: RefundOrderDto,
  ) {
    return this.ordersService.refundOrder(id, refundDto.amount, refundDto.reason, user.id);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.Admin)
  @ApiOperation({ summary: 'Update order status and tracking number (Admin only)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Order status updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        orderNumber: { type: 'string' },
        status: { type: 'string' },
        trackingNumber: { type: 'string', nullable: true },
        items: { type: 'array' },
        subtotal: { type: 'number' },
        tax: { type: 'number' },
        shipping: { type: 'number' },
        discount: { type: 'number' },
        total: { type: 'number' },
        shippingAddress: { type: 'object' },
        paymentStatus: { type: 'string' },
        createdAt: { type: 'string' },
        updatedAt: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid status or tracking number' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Admin access required' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateDto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, updateDto, true);
  }
}

