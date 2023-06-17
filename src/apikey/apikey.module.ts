import { Module } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { MongoModule } from '../common/mongo/mongo.module';
import { ApikeyController } from './apikey.controller';

@Module({
  imports: [MongoModule],
  providers: [ApikeyService],
  controllers: [ApikeyController],
})
export class ApikeyModule {}
