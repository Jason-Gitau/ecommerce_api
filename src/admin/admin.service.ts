import { Injectable, NotFoundException } from '@nestjs/common'; 
import { PrismaService } from '../prisma/prisma.service';
import { QueryUsersDto } from './dto/query-users.dto';        
import { UpdateUserDto } from './dto/update-user.dto';
import Decimal from 'decimal.js';     
import { OrderExportDto } from './dto/order-export.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // GET /admin/analytics/overview
  async getOverview() {
    // Run 3 queries in parallel for performance
    const [totalRevenueResult, totalOrders, totalUsers, lowStockProducts] = await Promise.all([
      // 1. Calculate Total Revenue (excluding cancelled orders)
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: {
          status: { not: 'CANCELLED' },
        },
      }),
      // 2. Count Total Orders
      this.prisma.order.count(),
      // 3. Count Total Users
      this.prisma.user.count(),
      // 4. Find products with low stock (threshold: 5)
      this.prisma.product.count({
        where: { stock: { lte: 5 } },
      }),
    ]);

    return {
      totalRevenue: totalRevenueResult._sum.total || 0,
      totalOrders,
      totalUsers,
      lowStockAlerts: lowStockProducts,
    };
  }

  // GET /admin/analytics/revenue?days=7
  async getRevenueTrend(days: number = 7) {
    const dateLimit = new Date();
    dateLimit.setDate(dateLimit.getDate() - days);

    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: dateLimit },
        status: { not: 'CANCELLED' },
      },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    // Format for charts (e.g., Chart.js)
    // Group by date and sum revenue
    const revenueByDate = orders.reduce((acc, order) => {
      const date = order.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD
      if (!acc[date]) acc[date] = 0;
      acc[date] += order.total.toNumber();
      return acc;
    }, {} as Record<string, number>);

    return {
      labels: Object.keys(revenueByDate),
      data: Object.values(revenueByDate),
    };
  }

    // GET /admin/users - List all users with filters
  async findAllUsers(query: QueryUsersDto) {
    const { page = 1, limit = 10, search, role, status } = query;
    const skip = (page - 1) * limit;

    // Build dynamic where clause
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status === 'banned') where.isBanned = true;
    if (status === 'active') where.isBanned = false;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isBanned: true,
          createdAt: true,
          // 🔒 Never return password or sensitive fields
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /admin/users/:id - Full profile + order summary
  async findUserWithSummary(id: string) {
  const user = await this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBanned: true,        // 👈 Now exists in schema
      adminNotes: true,      // 👈 Now exists in schema
      createdAt: true,
      updatedAt: true,
      // 👇 Include relations for aggregation
      _count: {
        select: { orders: true },
      },
      orders: {
        select: {
          total: true,
          createdAt: true,
          status: true, // Needed to filter cancelled orders
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }

  // Calculate total spent (excluding cancelled orders)
  const totalSpent = user.orders
    .filter((o) => o.status !== 'CANCELLED')
    .reduce((sum, o) => sum.plus(o.total), new Decimal(0));

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isBanned: user.isBanned,
    adminNotes: user.adminNotes,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    orderCount: user._count.orders,
    totalSpent: totalSpent.toDecimalPlaces(2).toNumber(),
    lastOrderDate: user.orders[0]?.createdAt || null,
  };
}

  // GET /admin/users/:id/orders - List all orders by user
  async findUserOrders(id: string, query: QueryUsersDto) {
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    // Verify user exists
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { userId: id },
        include: {
          items: {
            include: { product: { select: { id: true, name: true, price: true } } },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where: { userId: id } }),
    ]);

    return {
      data: orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateUser(id: string, dto: UpdateUserDto) {
  const existing = await this.prisma.user.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }

  return this.prisma.user.update({
    where: { id },
    data: {
      name: dto.name,
      email: dto.email,
      role: dto.role,
      isBanned: dto.isBanned,      // 👈 Now valid
      adminNotes: dto.adminNotes,  // 👈 Now valid
      updatedAt: new Date(),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isBanned: true,
      adminNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

  // GET /admin/orders/export?startDate=...&endDate=...&status=...
  async exportOrders(filters: OrderExportDto) {
    const { startDate, endDate, status } = filters;
    const where: any = {};

    if (startDate) where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
    if (endDate) where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    if (status) where.status = status;

    // Fetch orders with customer info
    const orders = await this.prisma.order.findMany({
      where,
      include: {
        user: { select: { email: true, name: true } },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // CSV Headers
    const headers = [
      'Order ID',
      'Date',
      'Customer Email',
      'Customer Name',
      'Status',
      'Total',
      'Item Count',
    ];

    // CSV Rows
    const rows = orders.map((o) => [
      o.id,
      o.createdAt.toISOString().split('T')[0],
      o.user?.email || 'Unknown',
      o.user?.name || 'Unknown',
      o.status,
      o.total.toString(), // .toString() prevents floating-point drift
      o.items.reduce((sum, item) => sum + item.quantity, 0),
    ]);

    // Escape CSV values (wrap in quotes, double any internal quotes)
    const escapeCsv = (val: unknown) => {
      const str = String(val ?? '');
      return `"${str.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((r) => r.map(escapeCsv).join(',')),
    ].join('\r\n'); // Use \r\n for Excel compatibility

    return csvContent;
  }

}