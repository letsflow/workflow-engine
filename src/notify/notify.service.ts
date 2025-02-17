import { Injectable, Logger } from '@nestjs/common';
import { ZeromqService } from './zeromq/zeromq.service';
import { Notify, Process } from '@letsflow/core/process';
import { ConfigService } from '@/common/config/config.service';
import { NotifyProvider } from './notify-provider.interface';
import { OnEvent } from '@nestjs/event-emitter';
import { ProcessService } from '@/process/process.service';
import { WebhookService } from '@/notify/webhook/webhook.service';
import { AmqpService } from '@/notify/amqp/ampq.service';

@Injectable()
export class NotifyService implements NotifyProvider {
  constructor(
    private logger: Logger,
    private config: ConfigService,
    private readonly processes: ProcessService,
    private amqp: AmqpService,
    private webhook: WebhookService,
    private zeromq: ZeromqService,
  ) {}

  @OnEvent('process.stepped', { async: true })
  async onStepped(process: Process) {
    await Promise.all(process.current.notify.map((args) => this.notify(process, args)));
  }

  @OnEvent('process.retry', { async: true })
  async onRetry({ process, services }: { process: Process; services?: string[] }) {
    await Promise.all(
      process.current.notify
        .filter((args) => !services || services.includes(args.service))
        .map((args) => this.notify(process, args)),
    );
  }

  async notify(process: Process, args: Notify): Promise<void> {
    try {
      const response = await this.getProvider(args.service).notify(process, args);

      if (args.trigger && typeof response !== 'undefined') {
        await this.processes.step(process, args.trigger, { key: `service:${args.service}` }, response);
      }
    } catch (err) {
      this.logger.error(err.message);
    }
  }

  private getProvider(service: string): NotifyProvider {
    const settings = this.config.get('services')[service];

    if (!settings) throw new Error(`Service '${service}' not configured`);
    if (!settings.provider) throw new Error(`Provider not specified for service '${service}'`);

    switch (settings.provider) {
      case 'amqp':
        return this.amqp;
      case 'webhook':
        return this.webhook;
      case 'zeromq':
        return this.zeromq;
      default:
        throw new Error(`Unsupported provider '${settings.provider}' for service '${service}'`);
    }
  }
}
