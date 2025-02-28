import { Test, TestingModule } from '@nestjs/testing';
import { AmqpService } from './ampq.service';
import { ConfigService } from '@/common/config/config.service';
import { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import { Process } from '@letsflow/core/process';

describe('AmqpService', () => {
  let service: AmqpService;
  let configService: ConfigService;
  let connectMock: jest.Mock;
  let connectionMock: AmqpConnectionManager;
  let channelMock: ChannelWrapper;

  const process = {
    id: '00000000-0000-0000-0001-000000000001',
    current: {
      actions: [{ key: 'next', actor: ['service:pushService', 'service:replyService'] }],
      instructions: { 'service:pushService': 'Go to next' } as Record<string, string>,
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
    } as unknown as ChannelWrapper;

    connectionMock = {
      createChannel: jest.fn(() => channelMock),
      close: jest.fn(),
    } as unknown as AmqpConnectionManager;

    connectMock = jest.fn(() => connectionMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmqpService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ({
              pushService: {
                url: 'amqp://localhost',
                exchange: 'test-exchange',
                routingKey: 'test-key',
              },
              replyService: {
                url: 'amqp://localhost',
                reply: true,
                responseTimeout: 0.1, // seconds
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

    service = module.get<AmqpService>(AmqpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleDestroy', () => {
    it('should close all channels and connections', () => {
      service['channels'].set('pushService', channelMock);
      service['connections'].set('amqp://localhost', connectionMock);

      service.onModuleDestroy();

      expect(channelMock.close).toHaveBeenCalled();
      expect(connectionMock.close).toHaveBeenCalled();
    });
  });

  describe('getChannel', () => {
    it('should return an existing channel if it exists', async () => {
      service['channels'].set('pushService', channelMock);

      const result = await service['getChannel']('pushService');

      expect(result).toBe(channelMock);
    });

    it('should create and return a new channel if it does not exist', async () => {
      const result = await service['getChannel']('pushService');

      expect(connectMock).toHaveBeenCalledWith('amqp://localhost');
      expect(connectionMock.createChannel).toHaveBeenCalled();
      expect(result).toBe(channelMock);
    });

    it('should throw an error if the service is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce({});

      await expect(service['getChannel']('unknownService')).rejects.toThrow(
        "Service 'unknownService' not configured for AMQP",
      );
    });
  });

  describe('notify', () => {
    it('should publish a message without replyTo', async () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce({
        pushService: {
          url: 'amqp://localhost',
          exchange: 'test-exchange',
          routingKey: 'test-key',
        },
      });

      const args = { service: 'pushService', after: 0 };

      await service.notify(process, args);

      expect(channelMock.publish).toHaveBeenCalledWith(
        'test-exchange',
        'test-key',
        JSON.stringify({
          process: '00000000-0000-0000-0001-000000000001',
          actions: [{ key: 'next', actor: ['service:pushService', 'service:replyService'] }],
          instructions: 'Go to next',
          etag: '1234',
        }),
        {
          appId: 'letsflow',
          contentType: 'application/json',
          messageId: '1234',
          persistent: true,
          timeout: 10000,
          timestamp: expect.any(Number),
        },
      );
    });

    it('should publish and wait for a response when replyTo is set', async () => {
      const replyTo = service['defaultReplyQueue'];

      await service['consume']('replyService', channelMock, replyTo);
      expect(channelMock.assertQueue).toHaveBeenCalledWith(replyTo, {
        autoDelete: true,
        exclusive: true,
        messageTtl: 3600,
      });
      expect(channelMock.consume).toHaveBeenCalled();
      const consumeCallback = (channelMock.consume as jest.Mock).mock.calls[0][1];

      (channelMock.publish as jest.Mock).mockImplementationOnce((_, __, ___, options) => {
        consumeCallback({
          properties: { correlationId: options.messageId, contentType: 'application/json' },
          content: Buffer.from(JSON.stringify({ result: 42 })),
        });
      });

      const args = { service: 'replyService', after: 0 };

      const result = await service.notify(process, args);

      expect(result).toEqual({ result: 42 });

      expect(channelMock.publish).toHaveBeenCalledWith(
        '',
        '',
        JSON.stringify({
          process: '00000000-0000-0000-0001-000000000001',
          actions: [{ key: 'next', actor: ['service:pushService', 'service:replyService'] }],
          etag: '1234',
        }),
        {
          appId: 'letsflow',
          contentType: 'application/json',
          messageId: '1234',
          replyTo,
          persistent: true,
          timeout: 10000,
          timestamp: expect.any(Number),
        },
      );
    });

    it('should throw an error if the response timeout is exceeded', async () => {
      const args = { service: 'replyService', after: 0 };

      await expect(service.notify(process, args)).rejects.toThrow('Response timeout exceeded');
    });
  });
});
