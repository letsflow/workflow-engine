import { Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { ConfigModule } from '@/common/config/config.module';
import { FetchModule } from '@/common/fetch/fetch.module';

@Module({
  imports: [ConfigModule, FetchModule],
  providers: [WebhookService],
})
export class WebhookModule {}
