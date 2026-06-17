import { Controller, Logger, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe payment intent for an order' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  async createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    this.logger.log(`POST /payments/intent — orderId: ${dto.orderId}`);
    try {
      const result = await this.paymentsService.createPaymentIntent(dto.orderId, process.env.STRIPE_CURRENCY || 'usd');
      this.logger.log(`Payment intent created — orderId: ${dto.orderId}`);
      return result;
    } catch (err) {
      this.logger.error(`Create payment intent failed — orderId: ${dto.orderId}: ${err.message}`);
      throw err;
    }
  }

  @Post('refund/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Refund an order (admin only)' })
  @ApiResponse({ status: 201, description: 'Refund issued' })
  async refundOrder(@Param('orderId') orderId: string) {
    this.logger.log(`POST /payments/refund/${orderId}`);
    try {
      const result = await this.paymentsService.refundOrder(orderId);
      this.logger.log(`Refund issued — orderId: ${orderId}`);
      return result;
    } catch (err) {
      this.logger.error(`Refund failed — orderId: ${orderId}: ${err.message}`);
      throw err;
    }
  }
}