import { Test, TestingModule } from '@nestjs/testing';
import { WebhooksController } from './webhooks.controller';
import { PaymentsService } from '../payments.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhooksController],
      providers: [{ provide: PaymentsService, useValue: { handleWebhook: jest.fn() } }],
    }).compile();

    controller = module.get<WebhooksController>(WebhooksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
