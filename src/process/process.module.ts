import { Module } from '@nestjs/common';
import { ProcessService } from './process.service';
import { ProcessController } from './process.controller';
import { ScenarioModule } from '../scenario/scenario.module';
import { ValidationService } from './validation/validation.service';
import { MongoModule } from '../common/mongo/mongo.module';
import { AuthModule } from '../common/auth/auth.module';
import { AjvModule } from '../common/ajv/ajv.module';

@Module({
  imports: [ScenarioModule, MongoModule, AuthModule, AjvModule],
  providers: [ProcessService, ValidationService],
  controllers: [ProcessController],
})
export class ProcessModule {}
