import { Injectable, Logger } from '@nestjs/common';
import { ZeromqService } from './zeromq/zeromq.service';
import { determineTrigger, Notify, Process } from '@letsflow/core/process';
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

  @OnEvent('process.stepped')
  async onStepped(process: Process) {
    for (const args of process.current.notify) {
      await this.notify(process, args);
    }
  }

  @OnEvent('process.retry')
  async onRetry({ process, services }: { process: Process; services?: string[] }) {
    for (const args of process.current.notify) {
      if (!services && !services.includes(args.service)) continue;
      await this.notify(process, args);
    }
  }

  async notify(process: Process, args: Notify): Promise<void> {
    try {
      const response = await this.getProvider(args.service).notify(process, args);

      if (typeof response !== 'undefined') {
        await this.step(process, args.service, response);
      }
    } catch (err) {
      this.logger.error(err.message);
    }
  }

  private async step(process: Process, service: string, response: any): Promise<void> {
    const action = determineTrigger(process, service, response);

    if (!action) {
      throw new Error(`Service '${service}' gave a response, but unable to determine which action was executed`);
    }

    await this.processes.step(process, action, { key: `service:${service}` }, response);
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
