import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

// var (not let) so the declaration is hoisted above the jest.mock() factory
// eslint-disable-next-line no-var
var mockConstructEvent: jest.Mock;

jest.mock('stripe', () => {
  mockConstructEvent = jest.fn();
  const Ctor: any = jest.fn(() => ({}));
  Ctor.webhooks = { constructEvent: (...args: any[]) => mockConstructEvent(...args) };
  return Ctor;
});

const makePrisma = () => ({
  paymentEvent: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  order: { update: jest.fn() },
  payment: { update: jest.fn() },
  $transaction: jest.fn(),
});

describe('PaymentsService.handleWebhook', () => {
  let service: PaymentsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    prisma = makePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  afterEach(() => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it('throws BadRequestException when STRIPE_WEBHOOK_SECRET is not set', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws BadRequestException when Stripe rejects the signature', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });
    await expect(service.handleWebhook(Buffer.from('{}'), 'bad_sig')).rejects.toThrow(
      new BadRequestException(
        'Webhook Error: No signatures found matching the expected signature for payload',
      ),
    );
  });

  it('returns { received: true } without re-processing a duplicate event (idempotency)', async () => {
    const event = { id: 'evt_dup', type: 'payment_intent.succeeded', data: { object: {} } };
    mockConstructEvent.mockReturnValue(event);
    prisma.paymentEvent.findUnique.mockResolvedValue({ id: 'existing', stripeEventId: 'evt_dup', createdAt: new Date() });

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({ received: true });
    expect(prisma.paymentEvent.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('updates order to PAID and payment to succeeded on payment_intent.succeeded', async () => {
    const intent = { id: 'pi_ok', metadata: { orderId: 'order-uuid' }, receipt_url: 'https://stripe.com/receipt' };
    const event = { id: 'evt_ok', type: 'payment_intent.succeeded', data: { object: intent } };
    mockConstructEvent.mockReturnValue(event);
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({});
    // Execute the $transaction callback inline so inner updates are called
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));
    prisma.order.update.mockResolvedValue({});
    prisma.payment.update.mockResolvedValue({});

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({ received: true });
    expect(prisma.order.update).toHaveBeenCalledWith({
      where: { id: 'order-uuid' },
      data: { status: OrderStatus.PAID },
    });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { stripeIntentId: 'pi_ok' },
      data: { status: 'succeeded', receiptUrl: 'https://stripe.com/receipt' },
    });
  });

  it('skips DB updates when orderId is missing from intent metadata', async () => {
    const intent = { id: 'pi_nometa', metadata: {}, receipt_url: null };
    const event = { id: 'evt_nometa', type: 'payment_intent.succeeded', data: { object: intent } };
    mockConstructEvent.mockReturnValue(event);
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({});
    prisma.$transaction.mockImplementation((cb: any) => cb(prisma));

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({ received: true });
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('marks payment as failed on payment_intent.payment_failed', async () => {
    const intent = { id: 'pi_fail', metadata: { orderId: 'order-uuid' }, receipt_url: null };
    const event = { id: 'evt_fail', type: 'payment_intent.payment_failed', data: { object: intent } };
    mockConstructEvent.mockReturnValue(event);
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({});
    prisma.payment.update.mockResolvedValue({});

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({ received: true });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { stripeIntentId: 'pi_fail' },
      data: { status: 'failed' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns { received: true } and records unknown event types without crashing', async () => {
    const event = { id: 'evt_unknown', type: 'customer.created', data: { object: {} } };
    mockConstructEvent.mockReturnValue(event);
    prisma.paymentEvent.findUnique.mockResolvedValue(null);
    prisma.paymentEvent.create.mockResolvedValue({});

    const result = await service.handleWebhook(Buffer.from('{}'), 'sig');

    expect(result).toEqual({ received: true });
    expect(prisma.order.update).not.toHaveBeenCalled();
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});
