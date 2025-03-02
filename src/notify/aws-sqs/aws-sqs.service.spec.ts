import { Test, TestingModule } from '@nestjs/testing';
import { AwsSqsService } from './aws-sqs.service';
import { ConfigService } from '@/common/config/config.service';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { etag, hmac, Process } from '@letsflow/core/process';

describe('AwsSqsService', () => {
  let service: AwsSqsService;
  let configService: jest.Mocked<ConfigService>;
  let sqsClient: jest.Mocked<SQSClient>;

  const process = {
    id: '00000000-0000-0000-0001-000000000001',
    current: {
      actions: [{ key: 'next', actor: ['service:test'] }],
      instructions: { 'service:test': 'Go to next' } as Record<string, string>,
    },
    events: [{ hash: '1234' }],
  } as Process;

  beforeEach(async () => {
    sqsClient = {
      send: jest.fn().mockResolvedValue(undefined as any),
    } as any;

    configService = {
      get: jest.fn(() => ({
        test: {
          queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test',
          messageAttributes: { Foo: 'bar' },
          replySecret: 'secret!',
        },
      })),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AwsSqsService,
        { provide: ConfigService, useValue: configService },
        { provide: SQSClient, useValue: sqsClient },
      ],
    }).compile();

    service = module.get<AwsSqsService>(AwsSqsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notify', () => {
    it('should publish a message', async () => {
      const token = hmac({ process: process.id, etag: etag(process), service: 'test' }, 'secret!');

      await service.notify(process, { service: 'test', after: 0 });

      expect(sqsClient.send).toHaveBeenCalledWith(expect.any(SendMessageCommand));
      expect(sqsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test',
            MessageBody: JSON.stringify({
              actions: [{ key: 'next', actor: ['service:test'] }],
              instructions: 'Go to next',
            }),
            MessageAttributes: {
              Foo: { DataType: 'string', StringValue: 'bar' },
              ProcessId: { DataType: 'string', StringValue: process.id },
              Service: { DataType: 'string', StringValue: 'test' },
              Etag: { DataType: 'string', StringValue: etag(process) },
              ReplyToken: { DataType: 'string', StringValue: token },
            },
          },
        }),
      );
    });

    it('should publish a custom message', async () => {
      const message = { custom: 'message' };
      const token = hmac({ process: process.id, etag: etag(process), service: 'test' }, 'secret!');

      await service.notify(process, { service: 'test', after: 0, message });

      expect(sqsClient.send).toHaveBeenCalledWith(expect.any(SendMessageCommand));
      expect(sqsClient.send).toHaveBeenCalledWith(
        expect.objectContaining({
          input: {
            QueueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/test',
            MessageBody: JSON.stringify(message),
            MessageAttributes: {
              Foo: { DataType: 'string', StringValue: 'bar' },
              ProcessId: { DataType: 'string', StringValue: process.id },
              Service: { DataType: 'string', StringValue: 'test' },
              Etag: { DataType: 'string', StringValue: etag(process) },
              ReplyToken: { DataType: 'string', StringValue: token },
            },
          },
        }),
      );
    });
  });
});
