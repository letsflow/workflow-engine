import { Module } from '@nestjs/common';
import { AwsSqsService } from './aws-sqs.service';
import { SQSClient } from '@aws-sdk/client-sqs';
import { ConfigModule } from '@/common/config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [SQSClient, AwsSqsService, { provide: 'POLL_WAIT', useValue: 1000 }],
})
export class AwsSqsModule {}
