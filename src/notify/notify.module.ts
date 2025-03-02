import { Module } from '@nestjs/common';
import { NotifyService } from './notify.service';
import { ConfigModule } from '@/common/config/config.module';
import { ProcessModule } from '@/process/process.module';
import { AmqpModule } from '@/notify/amqp/amqp.module';
import { WebhookModule } from './webhook/webhook.module';
import { ZeromqModule } from './zeromq/zeromq.module';
import { AwsSqsModule } from './aws-sqs/aws-sqs.module';

@Module({
  imports: [ConfigModule, ProcessModule, AmqpModule, WebhookModule, ZeromqModule, AwsSqsModule],
  providers: [NotifyService],
})
export class NotifyModule {}
