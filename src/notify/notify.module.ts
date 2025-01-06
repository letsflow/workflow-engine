import { Module } from '@nestjs/common';
import { ZeromqModule } from './zeromq/zeromq.module';
import { NotifyService } from './notify.service';
import { ConfigModule } from '@/common/config/config.module';
import { ProcessModule } from '@/process/process.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [ConfigModule, ProcessModule, ZeromqModule, WebhookModule],
  providers: [NotifyService],
  exports: [NotifyService],
})
export class NotifyModule {}
