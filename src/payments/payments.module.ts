import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WebhooksController } from './webhooks/webhooks.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController, WebhooksController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
