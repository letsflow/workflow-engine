import { Module } from '@nestjs/common';
import { ApiKeyService } from './apikey.service';
import { MongoModule } from '../common/mongo/mongo.module';
import { ApiKeyController } from './apikey.controller';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [MongoModule, AuthModule],
  providers: [ApiKeyService],
  controllers: [ApiKeyController],
})
export class ApiKeyModule {}
