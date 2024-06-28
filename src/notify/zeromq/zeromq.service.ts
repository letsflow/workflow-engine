import { Logger, Injectable, OnModuleDestroy } from '@nestjs/common';
import { NotifyArgs, NotifyProvider } from '../interfaces';
import { Process } from '@letsflow/core/process';
import { Push } from 'zeromq';
import { ConfigService } from '../../common/config/config.service';
import { NotifyMessageService } from '../notify-message/notify-message.service';

@Injectable()
export class ZeromqService implements NotifyProvider, OnModuleDestroy {
  private sockets: Map<string, Push> = new Map();

  constructor(
    private message: NotifyMessageService,
    private config: ConfigService,
  ) {}

  onModuleDestroy() {
    this.sockets.forEach((socket) => {
      socket.close();
    });
  }

  getSocket(address: string): Push {
    if (this.sockets.has(address)) {
      return this.sockets[address];
    }

    const socket = new Push();
    socket.connect(address);

    this.sockets[address] = socket;
    return socket;
  }

  async notify(process: Process, args: NotifyArgs): Promise<void> {
    if (!args.action) {
      return; // No action to notify
    }

    const settings = this.config.get('notificationMethods')[args.method];
    if (!settings.address) throw new Error(`ZeroMQ address not configured notification method ${args.method}`);

    const message = this.message.create(process, args.action);
    const socket = this.getSocket(settings.address);

    await socket.send(message);
  }
}
