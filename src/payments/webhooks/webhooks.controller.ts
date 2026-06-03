import { Controller, Post, Headers, Req } from '@nestjs/common';
import { PaymentsService } from '../payments.service';
import { Public } from '../../common/decorators/public.decorator';

@Controller('payments/webhooks')
export class WebhooksController {
  constructor(private paymentsService: PaymentsService) {}

  @Public()
  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: any, // Raw body injected by middleware
  ) {
    return this.paymentsService.handleWebhook(req.body, signature);
  }
}
