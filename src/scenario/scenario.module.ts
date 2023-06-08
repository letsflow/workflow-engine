import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';
import { ConfigModule } from '../common/config/config.module';

@Module({
  imports: [ConfigModule],
  providers: [ScenarioService],
  controllers: [ScenarioController],
})
export class ScenarioModule {}
