import { Logger, Module } from '@nestjs/common';
import { ZeromqOptions, ZeromqService } from './zeromq.service';
import { ConfigModule } from '@/common/config/config.module';
import { Push, Reply, SocketOptions } from 'zeromq';

@Module({
  imports: [ConfigModule],
  providers: [
    ZeromqService,
    {
      provide: Logger,
      useValue: new Logger(ZeromqService.name),
    },
    {
      provide: 'CREATE_ZEROMQ_SOCKET',
      useValue: (settings: ZeromqOptions) => {
        const { type, address, ...options } = settings;

        if (type === 'reply') {
          (options as SocketOptions<Reply>).receiveTimeout ??= 30;
        }

        const socket = type === 'reply' ? new Reply(options) : new Push(options);
        socket.connect(address);

        return socket;
      },
    },
  ],
})
export class ZeromqModule {}
