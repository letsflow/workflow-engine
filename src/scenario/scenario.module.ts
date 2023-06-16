import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';
import { ConfigModule } from '../common/config/config.module';
import { MongoModule } from '../common/mongo/mongo.module';
import { AuthModule } from '../common/auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule, MongoModule],
  providers: [ScenarioService],
  controllers: [ScenarioController],
  exports: [ScenarioService],
})
export class ScenarioModule {}
