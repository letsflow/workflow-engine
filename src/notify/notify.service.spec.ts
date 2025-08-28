import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotifyService } from './notify.service';
import { ConfigService } from '@/common/config/config.service';
import { ZeromqService } from './zeromq/zeromq.service';
import { ProcessService } from '@/process/process.service';
import { WebhookService } from '@/notify/webhook/webhook.service';
import { AmqpService } from '@/notify/amqp/ampq.service';

jest.mock('@letsflow/core/process', () => ({
  determineTrigger: jest.fn(),
}));
import { determineTrigger } from '@letsflow/core/process';

describe('NotifyService', () => {
  let service: NotifyService;
  let config: { get: jest.Mock };
  let processes: { step: jest.Mock };
  let amqp: { notify: jest.Mock };
  let webhook: { notify: jest.Mock };
  let zeromq: { notify: jest.Mock };
  let logger: { error: jest.Mock };

  beforeEach(async () => {
    config = { get: jest.fn() } as any;
    processes = { step: jest.fn() } as any;
    amqp = { notify: jest.fn() } as any;
    webhook = { notify: jest.fn() } as any;
    zeromq = { notify: jest.fn() } as any;
    logger = { error: jest.fn() } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyService,
        { provide: ConfigService, useValue: config },
        { provide: ProcessService, useValue: processes },
        { provide: AmqpService, useValue: amqp },
        { provide: WebhookService, useValue: webhook },
        { provide: ZeromqService, useValue: zeromq },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    service = module.get<NotifyService>(NotifyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProvider', () => {
    it('returns provider based on config', () => {
      config.get.mockReturnValue({
        email: { provider: 'amqp' },
        hook: { provider: 'webhook' },
        zmq: { provider: 'zeromq' },
      });
      expect((service as any)['getProvider']('email')).toBe(amqp);
      expect((service as any)['getProvider']('hook')).toBe(webhook);
      expect((service as any)['getProvider']('zmq')).toBe(zeromq);
    });

    it('throws when service not configured', () => {
      config.get.mockReturnValue({});
      expect(() => (service as any)['getProvider']('foo')).toThrow("Service 'foo' not configured");
    });

    it('throws when provider unspecified', () => {
      config.get.mockReturnValue({ foo: {} });
      expect(() => (service as any)['getProvider']('foo')).toThrow("Provider not specified for service 'foo'");
    });

    it('throws on unsupported provider', () => {
      config.get.mockReturnValue({ foo: { provider: 'unknown' } });
      expect(() => (service as any)['getProvider']('foo')).toThrow("Unsupported provider 'unknown' for service 'foo'");
    });
  });

  describe('step', () => {
    it('calls processes.step when action determined', async () => {
      (determineTrigger as unknown as jest.Mock).mockReturnValue('complete');
      const process: any = { current: { key: 'initial' } };
      // Access private for test
      await (service as any)['step'](process, 'email', { ok: true });
      expect(processes.step).toHaveBeenCalledWith(process, 'complete', { key: 'service:email' }, { ok: true });
    });

    it('throws if action cannot be determined', async () => {
      (determineTrigger as unknown as jest.Mock).mockReturnValue(undefined);
      const process: any = { current: { key: 'initial' } };
      await expect(
        // Access private for test
        (service as any)['step'](process, 'email', { ok: true }),
      ).rejects.toThrow("Service 'email' gave a response, but unable to determine which action was executed");
    });
  });

  describe('notify', () => {
    it('logs error if provider throws', async () => {
      config.get.mockReturnValue({ email: { provider: 'amqp' } });
      amqp.notify.mockRejectedValue(new Error('boom'));
      await service.notify({} as any, { service: 'email' } as any);
      expect(logger.error).toHaveBeenCalledWith('boom');
    });

    it('steps when provider returns response', async () => {
      config.get.mockReturnValue({ email: { provider: 'amqp' } });
      amqp.notify.mockResolvedValue({ ok: true });
      (determineTrigger as unknown as jest.Mock).mockReturnValue('complete');
      await service.notify({} as any, { service: 'email' } as any);
      expect(processes.step).toHaveBeenCalled();
    });

    it('does nothing when provider returns undefined', async () => {
      config.get.mockReturnValue({ email: { provider: 'amqp' } });
      amqp.notify.mockResolvedValue(undefined);
      await service.notify({} as any, { service: 'email' } as any);
      expect(processes.step).not.toHaveBeenCalled();
    });
  });
});
