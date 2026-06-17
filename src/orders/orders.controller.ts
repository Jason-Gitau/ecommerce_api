import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Role } from '@prisma/client';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { OrdersService } from './orders.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; email: string; role: Role };
}

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    this.logger.log(`POST /orders — userId: ${req.user.id}, items: ${createOrderDto.items?.length ?? 0}`);
    try {
      const result = await this.ordersService.create(req.user.id, createOrderDto);
      this.logger.log(`Order created — userId: ${req.user.id}`);
      return result;
    } catch (err) {
      this.logger.error(`Create order failed — userId: ${req.user.id}: ${err.message}`);
      throw err;
    }
  }

  @Get()
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() paginationQuery: PaginationQueryDto,
  ) {
    this.logger.log(`GET /orders — userId: ${req.user.id}, page: ${paginationQuery.page}, limit: ${paginationQuery.limit}`);
    try {
      const result = await this.ordersService.findAll(req.user.id, paginationQuery);
      this.logger.log(`Fetched orders — userId: ${req.user.id}`);
      return result;
    } catch (err) {
      this.logger.error(`Fetch orders failed — userId: ${req.user.id}: ${err.message}`);
      throw err;
    }
  }

  @Get(':id')
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    this.logger.log(`GET /orders/${id} — userId: ${req.user.id}`);
    try {
      const result = await this.ordersService.findOne(id, req.user.id);
      this.logger.log(`Fetched order ${id} — userId: ${req.user.id}`);
      return result;
    } catch (err) {
      this.logger.error(`Fetch order ${id} failed — userId: ${req.user.id}: ${err.message}`);
      throw err;
    }
  }
}
