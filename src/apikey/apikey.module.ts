import { Module } from '@nestjs/common';
import { ApikeyService } from './apikey.service';
import { MongoModule } from '../common/mongo/mongo.module';
import { ApikeyController } from './apikey.controller';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [MongoModule, AuthModule],
  providers: [ApikeyService],
  controllers: [ApikeyController],
})
export class ApikeyModule {}
