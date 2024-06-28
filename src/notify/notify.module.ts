import { Module, Logger } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { ZeromqService } from './zeromq/zeromq.service';
import { ConfigModule } from '../common/config/config.module';
import { NotifyMessageService } from './notify-message/notify-message.service';

@Module({
  providers: [
    NotifyService,
    NotifyMessageService,
    {
      provide: Logger,
      useValue: new Logger(NotifyService.name),
    },
    ZeromqService,
  ],
  exports: [NotifyService],
  imports: [ConfigModule],
})
export class NotifyModule {}
