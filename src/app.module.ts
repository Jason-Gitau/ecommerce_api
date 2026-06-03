import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'; // Use the smart guard
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { AdminModule } from './admin/admin.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { HealthController } from './health/health.controller';
import { PaymentsModule } from './payments/payments.module';


@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]), 
    PrismaModule,
    UsersModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    AdminModule,
    PaymentsModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Apply JWT guard globally
    },
  ],
})
export class AppModule {}