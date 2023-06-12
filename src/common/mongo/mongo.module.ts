import { Module } from '@nestjs/common';
import { mongoProvider } from './mongo.provider';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [mongoProvider],
  exports: [mongoProvider],
})
export class MongoModule {}
