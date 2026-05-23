import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
  ) {}

  // ─── POST /orders ─────────────────────────────────────────────────────────

  async create(userId: string, createOrderDto: CreateOrderDto) {
    const { items } = createOrderDto;

    // ── Step 1: Validate every product exists and has sufficient stock ──────
    // We resolve all products first so we can fail fast before opening a
    // transaction. findOne throws NotFoundException for unknown IDs.
    const resolvedItems = await Promise.all(
      items.map(async (item) => {
        const product = await this.productsService.findOne(item.productId);

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product "${product.name}". ` +
              `Requested: ${item.quantity}, available: ${product.stock}.`,
          );
        }

        return { product, quantity: item.quantity };
      }),
    );

    // ── Step 2: Calculate order total using safe Decimal math ───────────────
    const total = resolvedItems.reduce((sum, { product, quantity }) => {
      // product.price is a Decimal.js object from Prisma
      const lineTotal = new Decimal(product.price.toString()).mul(quantity);
      return sum.plus(lineTotal);
    }, new Decimal(0));

    // ── Step 3: Persist everything inside a single transaction ──────────────
    const order = await this.prisma.$transaction(async (tx) => {
      // 3a. Create the Order record
      const newOrder = await tx.order.create({
        data: {
          userId,
          total: total.toDecimalPlaces(2).toNumber(),
          status: 'PENDING',
        },
      });

      // 3b. Create all OrderItem records
      await tx.orderItem.createMany({
        data: resolvedItems.map(({ product, quantity }) => ({
          orderId: newOrder.id,
          productId: product.id,
          quantity,
          // Capture the price at the moment of purchase
          priceAtTime: new Decimal(product.price.toString())
            .toDecimalPlaces(2)
            .toNumber(),
        })),
      });

      // 3c. Decrement stock for each product atomically
      await Promise.all(
        resolvedItems.map(({ product, quantity }) =>
          tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: quantity } },
          }),
        ),
      );

      // 3d. Return the full order with nested items + product details
      return tx.order.findUnique({
        where: { id: newOrder.id },
        include: {
          items: {
            include: { product: true },
          },
        },
      });
    });

    return order;
  }

  // ─── GET /orders ──────────────────────────────────────────────────────────

  async findAll(userId: string, { page, limit }: PaginationQueryDto) {
    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { product: true },
          },
        },
      }),
      this.prisma.order.count({ where: { userId } }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── GET /orders/:id ──────────────────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }

    // Ownership check — a user must only see their own orders
    if (order.userId !== userId) {
      // Return 404 rather than 403 to avoid leaking order existence
      throw new NotFoundException(`Order with ID ${id} not found.`);
    }

    return order;
  }
}