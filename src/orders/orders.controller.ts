import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { Role } from '@prisma/client'; // 👈 Import Prisma Role enum
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto'; // 👈 Create this next
import { OrdersService } from './orders.service';
import { Roles } from '../common/decorators/roles.decorator'; // 👈 Import decorator
import { RolesGuard } from '../common/guards/roles.guard'; // 👈 Import guard

// Updated interface: role is now typed as Prisma Role enum
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: Role; // 👈 Changed from string to Role enum
  };
}

@Controller('')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders
   * Creates a new order for the authenticated user.
   * Returns 400 if any item is out of stock.
   */
  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.ordersService.create(req.user.id, createOrderDto);
  }

  /**
   * GET /orders?page=1&limit=10
   * Returns paginated orders belonging to the authenticated user only.
   */
  @Get()
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    return this.ordersService.findAll(req.user.id, paginationQuery);
  }

  /**
   * GET /orders/:id
   * Returns a single order with nested items and products.
   * Returns 404 if the order does not exist or does not belong to req.user.
   */
  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.ordersService.findOne(id, req.user.id);
  }
  // ==================== ADMIN ENDPOINTS ====================

  /**
   * GET /admin/orders?page=1&limit=10
   * Admin-only: List ALL orders across all users (with pagination).
   */
  @Get('admin/orders')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findAllAdmin(@Query() paginationQuery: PaginationQueryDto) {
    return this.ordersService.findAllAdmin(paginationQuery);
  }

  /**
   * GET /admin/orders/:id
   * Admin-only: View any order by ID (bypasses ownership check).
   */
  @Get('admin/orders/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  findOneAdmin(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.ordersService.findOneAdmin(id);
  }

  /**
   * PATCH /admin/orders/:id/status
   * Admin-only: Update order status (e.g., PENDING → SHIPPED).
   */
  @Patch('admin/orders/:id/status')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto.status);
  }


}