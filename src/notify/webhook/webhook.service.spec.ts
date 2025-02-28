import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { ConfigService } from '@/common/config/config.service';
import { Notify, Process } from '@letsflow/core/process';

describe('WebhookService', () => {
  let service: WebhookService;
  let configService: ConfigService;
  let fetchMock: jest.Mock;

  const process = {
    id: '00000000-0000-0000-0001-000000000001',
    current: {
      actions: [{ key: 'next', actor: ['service:test'] }],
      instructions: { 'service:test': 'Go to next' } as Record<string, string>,
    },
    events: [{ hash: '1234' }],
  } as Process;

  beforeEach(async () => {
    fetchMock = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => ({
              test: {
                url: 'https://example.com/webhook',
                timeout: 10000,
              },
            })),
          },
        },
        {
          provide: 'FETCH',
          useValue: fetchMock,
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('notify', () => {
    it('should throw an error if the service is not configured', async () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce({});

      await expect(service.notify(process, { service: 'unknownService' } as Notify)).rejects.toThrow(
        "Service 'unknownService' not configured for Webhook",
      );
    });

    it('should throw an error if the url is missing in settings', async () => {
      jest.spyOn(configService, 'get').mockReturnValueOnce({
        test: {},
      });

      await expect(service.notify(process, { service: 'test' } as Notify)).rejects.toThrow(
        "Service 'test' is missing url setting",
      );
    });

    it('should send a message with correct headers and body', async () => {
      fetchMock.mockResolvedValue({ ok: true, status: 202 });

      const args = { service: 'test', after: 0 };
      const result = await service.notify(process, args);

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/webhook', {
        url: 'https://example.com/webhook',
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          process: '00000000-0000-0000-0001-000000000001',
          actions: [{ key: 'next', actor: ['service:test'] }],
          instructions: 'Go to next',
          etag: '1234',
        }),
        signal: expect.any(AbortSignal),
      });

      expect(result).toBeUndefined();
    });

    it('should throw an error if the response is not ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server error'),
      });

      const args = { service: 'test', after: 0 };

      await expect(service.notify(process, args)).rejects.toThrow(
        'Webhook failed with status 500 Internal Server Error: Server error',
      );
    });

    it('should return the response text for non-202 successful responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn(() => 'text/plain') },
        text: jest.fn().mockResolvedValue('Success'),
      });

      const args = { service: 'test', after: 0 };
      const result = await service.notify(process, args);

      expect(result).toBe('Success');
    });

    it('should return parsed JSON for application/json responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn(() => 'application/json') },
        json: jest.fn().mockResolvedValue({ success: true }),
      });

      const args = { service: 'test', after: 0 };
      const result = await service.notify(process, args);

      expect(result).toEqual({ success: true });
    });
  });
});
