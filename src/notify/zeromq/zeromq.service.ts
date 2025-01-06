import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Notify, Process } from '@letsflow/core/process';
import { Push, Reply, SocketOptions } from 'zeromq';
import { ConfigService } from '@/common/config/config.service';
import { createMessage } from '../utils/message';
import { NotifyProvider } from '../notify-provider.interface';

export type ZeromqOptions =
  | ({ type: 'push'; address: string } & SocketOptions<Push>)
  | ({ type: 'reply'; address: string } & SocketOptions<Reply>);

@Injectable()
export class ZeromqService implements NotifyProvider, OnModuleDestroy {
  private sockets: Map<string, Push | Reply> = new Map();

  constructor(
    private readonly config: ConfigService,
    private readonly logger: Logger,
    @Inject('CREATE_ZEROMQ_SOCKET') private readonly createSocket: (settings: ZeromqOptions) => Push | Reply,
  ) {}

  onModuleDestroy() {
    this.sockets.forEach((socket) => {
      socket.close();
    });
  }

  getSocket(service: string): Push | Reply {
    if (this.sockets.has(service)) {
      return this.sockets.get(service);
    }

    const settings = this.config.get('services')[service] as ZeromqOptions | undefined;
    if (!settings) {
      throw new Error(`Service '${service}' not configured for ZeroMQ`);
    }

    const socket = this.createSocket(settings);

    this.sockets[service] = socket;
    return socket;
  }

  async notify(process: Process, args: Notify): Promise<any> {
    const socket = this.getSocket(args.service);
    const message = args.message ?? createMessage(process, args.trigger);

    try {
      await socket.send(typeof message === 'string' ? message : JSON.stringify(message));
      this.logger.debug(`Sent notification to ${args.service}: ${message}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to ${args.service}: ${error.message}`);
      return;
    }

    if ('receive' in socket) {
      // Don't use instanceof for compatibility with Jest mocks
      try {
        const [response] = await socket.receive();
        this.logger.debug(`Received response from ${args.service}: ${response}`);

        return response;
      } catch (error) {
        this.logger.error(`Failed to handle response from ${args.service}: ${error.message}`);
      }
    }
  }
}
