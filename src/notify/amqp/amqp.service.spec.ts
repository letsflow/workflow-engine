import { Test, TestingModule } from '@nestjs/testing';
import { AmqpService } from './ampq.service';
import { ConfigService } from '@/common/config/config.service';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { etag, hash, hmac, Process } from '@letsflow/core/process';

describe('AmqpService', () => {
  let service: AmqpService;
  let configService: jest.Mocked<ConfigService>;
  let connectMock: jest.Mock;
  let connectionMock: jest.Mocked<AmqpConnectionManager>;
  let channelMock: jest.Mocked<ChannelWrapper>;

  const process = {
    id: '00000000-0000-0000-0001-000000000001',
    current: {
      actions: [{ key: 'next', actor: ['service:test'] }],
      instructions: { 'service:test': 'Go to next' } as Record<string, string>,
    },
    events: [{ hash: '1234' }],
  } as Process;

  beforeEach(async () => {
    channelMock = {
      publish: jest.fn(),
      assertQueue: jest.fn().mockResolvedValue(undefined),
      consume: jest.fn().mockResolvedValue(undefined),
      ack: jest.fn(),
      nack: jest.fn(),
      close: jest.fn(),
    } as any;

    connectionMock = {
      createChannel: jest.fn(() => channelMock),
      close: jest.fn(),
    } as any;

    connectMock = jest.fn(() => connectionMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmqpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ({
              test: {
                url: 'amqp://localhost',
                exchange: 'test-exchange',
                routingKey: 'test-key',
                replySecret: 'secret!',
              },
            })),
          },
        },
        {
          provide: 'AMQP_CONNECT',
          useValue: connectMock,
        },
      ],
    }).compile();

    service = module.get(AmqpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleDestroy', () => {
    it('should close all channels and connections', () => {
      service['channels'].set('test', channelMock);
      service['connections'].set('amqp://localhost', connectionMock);

      service.onModuleDestroy();

      expect(channelMock.close).toHaveBeenCalled();
      expect(connectionMock.close).toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return an existing channel if it exists', async () => {
      service['channels'].set('test', channelMock);

      const result = await service['getChannel']('test');

      expect(result).toBe(channelMock);
    });

    it('should create and return a new channel if it does not exist', async () => {
      const result = await service['getChannel']('test');

      expect(connectMock).toHaveBeenCalledWith('amqp://localhost');
      expect(connectionMock.createChannel).toHaveBeenCalled();
      expect(result).toBe(channelMock);
    });

    it('should throw an error if the service is not configured', async () => {
      configService.get.mockReturnValueOnce({});

      await expect(service['getChannel']('unknownService')).rejects.toThrow(
        "Service 'unknownService' not configured for AMQP",
      );
    });
  });

  describe('notify', () => {
    it('should publish a message', async () => {
      const messageId = hash({ process: process.id, etag: etag(process), service: 'test' });
      const replyToken = hmac({ process: process.id, etag: etag(process), service: 'test' }, 'secret!');

      const args = { service: 'test', after: 0 };

      await service.notify(process, args);

      expect(channelMock.publish).toHaveBeenCalledWith(
        'test-exchange',
        'test-key',
        JSON.stringify({
          actions: [{ key: 'next', actor: ['service:test'] }],
          instructions: 'Go to next',
        }),
        {
          appId: 'letsflow',
          contentType: 'application/json',
          headers: {
            processId: '00000000-0000-0000-0001-000000000001',
            service: 'test',
            etag: '1234',
            replyToken,
          },
          messageId,
          persistent: true,
          timeout: 10000,
          timestamp: expect.any(Number),
        },
      );
    });
  });
});
