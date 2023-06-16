import { Module } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { MongoModule } from '../common/mongo/mongo.module';

@Module({
  imports: [MongoModule],
  providers: [ApikeyService],
})
export class ApikeyModule {}
