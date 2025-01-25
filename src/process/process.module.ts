import { Module } from '@nestjs/common';
import { ProcessService } from './process.service';
import { ProcessController } from './process.controller';
import { ScenarioModule } from '@/scenario/scenario.module';
import { MongoModule } from '@/common/mongo/mongo.module';
import { AuthModule } from '@/auth/auth.module';
import { AjvModule } from '@/common/ajv/ajv.module';
import { ConfigModule } from '@/common/config/config.module';

@Module({
  imports: [ScenarioModule, MongoModule, AuthModule, AjvModule, ConfigModule],
  providers: [ProcessService],
  controllers: [ProcessController],
})
export class ProcessModule {}
