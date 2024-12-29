import { Module } from '@nestjs/common';
import { ScenarioService } from './scenario.service';
import { ScenarioController } from './scenario.controller';
import { ConfigModule } from '../common/config/config.module';
import { MongoModule } from '../common/mongo/mongo.module';
import { AuthModule } from '../common/auth/auth.module';
import { ScenarioFsService } from './scenario-fs/scenario-fs.service';
import { ScenarioDbService } from './scenario-db/scenario-db.service';
import { ConfigService } from '../common/config/config.service';
import { Db } from 'mongodb';

@Module({
  imports: [ConfigModule, AuthModule, MongoModule],
  providers: [
    {
      provide: ScenarioService,
      useFactory: (config: ConfigService, db: Db) => {
        config.init();
        return config.get('scenario.storage') === 'db'
          ? new ScenarioDbService(db, config)
          : new ScenarioFsService(config);
      },
      inject: [ConfigService],
    },
  ],
  controllers: [ScenarioController],
  exports: [ScenarioService],
})
export class ScenarioModule {}
