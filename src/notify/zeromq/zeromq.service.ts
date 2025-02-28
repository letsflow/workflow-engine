import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createMessage, Notify, Process } from '@letsflow/core/process';
import { Push, Reply, SocketOptions } from 'zeromq';
import { ConfigService } from '@/common/config/config.service';
import { NotifyProvider } from '../notify-provider.interface';

export type ZeromqOptions =
  | ({ type: 'push'; address: string } & SocketOptions<Push>)
  | ({ type: 'reply'; address: string } & SocketOptions<Reply>);

@Injectable()
export class ZeromqService implements NotifyProvider, OnModuleDestroy {
  private sockets: Map<string, Push | Reply> = new Map();

  constructor(
    private readonly config: ConfigService,
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
    const message = args.message ?? createMessage(process, args.service);

    await socket.send(typeof message === 'string' ? message : JSON.stringify(message));

    // Use `in` and not `instanceof` for compatibility with Jest mocks
    if ('receive' in socket) {
      const [response] = await socket.receive();
      return response;
    }
  }
}
