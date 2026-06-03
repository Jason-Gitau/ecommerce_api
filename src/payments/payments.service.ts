import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import Stripe = require('stripe');

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: unknown;
  };
}

interface StripePaymentIntent {
  id: string;
  metadata: Record<string, string>;
  receipt_url: string | null;
}

@Injectable()
export class PaymentsService {
  private stripe: Stripe.Stripe | null = null;

  constructor(private prisma: PrismaService) {}

  private getStripeClient() {
    if (this.stripe) {
      return this.stripe;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new BadRequestException('STRIPE_SECRET_KEY is not set');
    }

    this.stripe = new Stripe(secretKey);
    return this.stripe;
  }

  async createPaymentIntent(orderId: string, currency: string) {
    const stripe = this.getStripeClient();
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { total: true, status: true },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not in PENDING status');
    }

    // Stripe uses cents (integers). Convert Decimal safely.
    const amount = Math.round(order.total.toNumber() * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata: { orderId },
      automatic_payment_methods: { enabled: true },
    });

    // Track pending payment
    await this.prisma.payment.create({
      data: {
        orderId,
        stripeIntentId: paymentIntent.id,
        amount: order.total,
        currency,
        status: 'pending',
      },
    });

    return { clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!endpointSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET is not set');
    }

    let event: StripeEvent;

    try {
      event = Stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown webhook error';
      throw new BadRequestException(`Webhook Error: ${message}`);
    }

    // 🔒 Idempotency: prevent duplicate processing
    const existing = await this.prisma.paymentEvent.findUnique({
      where: { stripeEventId: event.id },
    });
    if (existing) return { received: true };

    await this.prisma.paymentEvent.create({ data: { stripeEventId: event.id } });

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.processSuccess(event.data.object as StripePaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await this.processFailure(event.data.object as StripePaymentIntent);
        break;
    }

    return { received: true };
  }

  private async processSuccess(intent: StripePaymentIntent) {
    const { orderId } = intent.metadata;
    if (!orderId) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PAID },
      });
      await tx.payment.update({
        where: { stripeIntentId: intent.id },
        data: {
          status: 'succeeded',
          receiptUrl: intent.receipt_url,
        },
      });
    });
  }

  private async processFailure(intent: StripePaymentIntent) {
    const { orderId } = intent.metadata;
    if (!orderId) return;

    await this.prisma.payment.update({
      where: { stripeIntentId: intent.id },
      data: { status: 'failed' },
    });
  }

  async refundOrder(orderId: string) {
    const stripe = this.getStripeClient();
    const payment = await this.prisma.payment.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!payment || payment.status !== 'succeeded') {
      throw new BadRequestException('No successful payment found for this order');
    }

    const refund = await stripe.refunds.create({
      payment_intent: payment.stripeIntentId,
    });

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.REFUNDED },
    });

    return refund;
  }
}
