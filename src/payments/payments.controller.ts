import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
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
  constructor(private paymentsService: PaymentsService) {}

  @Post('intent')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a Stripe payment intent for an order' })
  @ApiResponse({ status: 201, description: 'Payment intent created' })
  createPaymentIntent(@Body() dto: CreatePaymentIntentDto) {
    return this.paymentsService.createPaymentIntent(dto.orderId, process.env.STRIPE_CURRENCY || 'usd');
  }

  @Post('refund/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Refund an order (admin only)' })
  @ApiResponse({ status: 201, description: 'Refund issued' })
  refundOrder(@Param('orderId') orderId: string) {
    return this.paymentsService.refundOrder(orderId);
  }
}