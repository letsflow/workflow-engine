import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotifyService } from './notify.service';
import { ConfigService } from '@/common/config/config.service';
import { ZeromqService } from './zeromq/zeromq.service';
import { ProcessService } from '@/process/process.service';
import { WebhookService } from '@/notify/webhook/webhook.service';
import { AmqpService } from '@/notify/amqp/ampq.service';

describe('NotifyService', () => {
  let service: NotifyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ProcessService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: AmqpService,
          useValue: {
            notify: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            notify: jest.fn(),
          },
        },
        {
          provide: ZeromqService,
          useValue: {
            notify: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotifyService>(NotifyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
