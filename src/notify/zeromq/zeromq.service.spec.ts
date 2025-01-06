import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ZeromqService } from './zeromq.service';
import { ConfigService } from '../../common/config/config.service';
import { Push } from 'zeromq';
import { Notify, Process } from '@letsflow/core/process';

describe('ZeromqService', () => {
  let service: ZeromqService;
  let configService: ConfigService;
  let logger: Logger;
  let createSocket: jest.Mock;

  const process = {
    id: '00000000-0000-0000-0001-000000000001',
    current: {
      actions: [{ key: 'next' }],
    },
    events: [{ hash: '1234' }],
  } as Process;

  beforeEach(async () => {
    createSocket = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZeromqService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ({
              testService: { type: 'push' },
            })),
          },
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: 'CREATE_ZEROMQ_SOCKET',
          useValue: createSocket,
        },
      ],
    }).compile();

    service = module.get<ZeromqService>(ZeromqService);
    configService = module.get<ConfigService>(ConfigService);
    logger = module.get<Logger>(Logger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleDestroy', () => {
    it('should close all sockets', () => {
      const mockSocket = { close: jest.fn() };
      service['sockets'].set('testService', mockSocket as any);

      service.onModuleDestroy();

      expect(mockSocket.close).toHaveBeenCalled();
    });
  });

  describe('getSocket', () => {
    it('should return an existing socket if it exists', () => {
      const mockSocket = {};
      service['sockets'].set('testService', mockSocket as any);

      const result = service.getSocket('testService');

      expect(result).toBe(mockSocket);
    });

    it('should create and return a new socket if it does not exist', () => {
      const mockPushSocket = new Push();
      createSocket.mockReturnValue(mockPushSocket);

      const result = service.getSocket('testService');

      expect(createSocket).toHaveBeenCalledWith({ type: 'push' });
      expect(result).toBe(mockPushSocket);
    });

    it('should throw an error if the service is not configured', () => {
      jest.spyOn(configService, 'get').mockReturnValue({});

      expect(() => service.getSocket('unknownService')).toThrow("Service 'unknownService' not configured for ZeroMQ");
    });
  });

  describe('notify', () => {
    it('should send a message using a Push socket', async () => {
      const mockPushSocket = { send: jest.fn() };
      createSocket.mockReturnValue(mockPushSocket);

      const args = { service: 'testService', trigger: 'next' } as Notify;

      const result = await service.notify(process, args);

      expect(mockPushSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          process: '00000000-0000-0000-0001-000000000001',
          action: { key: 'next' },
          etag: '1234',
        }),
      );

      expect(result).toBeUndefined();
    });

    it('should handle and log errors when sending a message fails', async () => {
      const mockPushSocket = { send: jest.fn().mockRejectedValue({ message: 'Test error' }) };
      createSocket.mockReturnValue(mockPushSocket);

      const args = { service: 'testService', trigger: 'next' } as Notify;

      await service.notify(process, args);

      expect(logger.error).toHaveBeenCalledWith('Failed to send notification to testService: Test error');
    });

    it('should send and receive a response using a Reply socket', async () => {
      const mockReplySocket = {
        send: jest.fn(),
        receive: jest.fn().mockResolvedValue(['response']),
      };
      createSocket.mockReturnValue(mockReplySocket);

      const args = { service: 'testService', trigger: 'next' } as Notify;

      const result = await service.notify(process, args);

      expect(mockReplySocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          process: '00000000-0000-0000-0001-000000000001',
          action: { key: 'next' },
          etag: '1234',
        }),
      );

      expect(mockReplySocket.receive).toHaveBeenCalled();
      expect(result).toEqual('response');
    });

    it('should handle and log errors when receiving a response fails', async () => {
      const mockReplySocket = {
        send: jest.fn(),
        receive: jest.fn().mockRejectedValue({ message: 'Test error' }),
      };

      createSocket.mockReturnValue(mockReplySocket);

      const args = { service: 'testService', trigger: 'next' } as Notify;

      await service.notify(process, args);

      expect(logger.error).toHaveBeenCalledWith('Failed to handle response from testService: Test error');
    });
  });
});
