import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';
import { ConfigModule } from '../common/config/config.module';
import { MongoModule } from '../common/mongo/mongo.module';

@Module({
  imports: [ConfigModule, MongoModule],
  providers: [ScenarioService],
  controllers: [ScenarioController],
})
export class ScenarioModule {}
