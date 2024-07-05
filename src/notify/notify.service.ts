import { Injectable, Logger } from '@nestjs/common';
import { ZeromqService } from './zeromq/zeromq.service';
import { Process, Notify } from '@letsflow/core/process';
import { ConfigService } from '../common/config/config.service';
import { NotifyProvider } from './interfaces';

@Injectable()
export class NotifyService implements NotifyProvider {
  constructor(
    private logger: Logger,
    private config: ConfigService,
    private zeromq: ZeromqService,
  ) {}

  async invoke(process: Process): Promise<void> {
    for (const args of process.current.notify) {
      if ('if' in args && !args.if) continue;
      await this.notify(process, args);
    }
  }

  async notify(process: Process, args: Notify): Promise<void> {
    try {
      await this.getProvider(args.method).notify(process, args);
    } catch (err) {
      this.logger.error(err.message);
    }
  }

  private getProvider(service: string): NotifyProvider {
    const settings = this.config.get('services')[service];

    if (!settings) throw new Error(`Service '${service}' not configured`);
    if (!settings.provider) throw new Error(`Provider not specified for service '${service}'`);

    switch (settings.provider) {
      case 'zeromq':
        return this.zeromq;
      default:
        throw new Error(`Unsupported provider ${settings.provider} for service '${service}'`);
    }
  }
}
