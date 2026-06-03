import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  ParseIntPipe,  
  UseGuards, 
    Header,  
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { QueryUsersDto } from './dto/query-users.dto';     
import { AdminUpdateUserDto } from './dto/update-user.dto';     
import { OrderExportDto } from './dto/order-export.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard) // 🔒 Secure ALL routes in this controller
@Roles(Role.ADMIN)                   // 🔒 Only ADMIN role allowed
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('analytics/overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @Get('analytics/revenue')
  getRevenueTrend(@Query('days', new ParseIntPipe({ optional: true })) days?: number) {
    return this.adminService.getRevenueTrend(days);
  }

  // Placeholder for Low Stock list endpoint
  @Get('analytics/low-stock')
  async getLowStock() {
    // Logic will be added in the service later
    return { message: "Low stock endpoint coming soon" };
  }
  // ==================== USER MANAGEMENT ====================

  @Get('users')
  findAllUsers(@Query() query: QueryUsersDto) {
    return this.adminService.findAllUsers(query);
  }

  @Get('users/:id')
  findUserWithSummary(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.adminService.findUserWithSummary(id);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Get('users/:id/orders')
  findUserOrders(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query() query: QueryUsersDto,
  ) {
    return this.adminService.findUserOrders(id, query);
  }
  
  @Get('orders/export/csv')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="orders-export.csv"')
  exportOrders(@Query() filters: OrderExportDto) {
    return this.adminService.exportOrders(filters);
  }
}