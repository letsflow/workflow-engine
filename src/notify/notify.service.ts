import { Injectable, Logger } from '@nestjs/common';
import { ZeromqService } from './zeromq/zeromq.service';
import { Process } from '@letsflow/core/process';
import { ConfigService } from '../common/config/config.service';
import { NotifyArgs, NotifyProvider } from './interfaces';

@Injectable()
export class NotifyService implements NotifyProvider {
  constructor(
    private logger: Logger,
    private config: ConfigService,
    private zeromq: ZeromqService,
  ) {}

  async invoke(process: Process): Promise<void> {
    for (const args of process.current.notify) {
      await this.notify(process, args);
    }
  }

  async notify(process: Process, args: NotifyArgs): Promise<void> {
    try {
      await this.getProvider(args.method).notify(process, args);
    } catch (err) {
      this.logger.error(err.message);
    }
  }

  private getProvider(method: string): NotifyProvider {
    const settings = this.config.get('notificationMethods')[method];

    if (!settings) throw new Error(`Notification method '${method}' not configured`);
    if (!settings.provider) throw new Error(`Provider not specified for notification method '${method}'`);

    switch (settings.provider) {
      case 'zeromq':
        return this.zeromq;
      default:
        throw new Error(`Unsupported provider ${settings.provider} for notification method '${method}'`);
    }
  }
}
