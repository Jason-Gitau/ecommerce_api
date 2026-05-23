import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PrismaModule,      // Provides PrismaService via DI
    ProductsModule,    // Provides ProductsService via DI (requires export — see note below)
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}