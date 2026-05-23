import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { OrdersService } from './orders.service';

// Shape injected by JwtAuthGuard into req.user
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('orders')
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
}