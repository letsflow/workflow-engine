import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { ScenarioModule } from './scenario/scenario.module';
import { YamlBodyParserMiddleware } from './middleware/yamlBodyParser.middleware';
import { MongoModule } from './common/mongo/mongo.module';
import { AuthModule } from './common/auth/auth.module';
import { ProcessModule } from './process/process.module';
import { ApikeyModule } from './apikey/apikey.module';
import { NotifyModule } from './notify/notify.module';
import { AjvModule } from './common/ajv/ajv.module';

@Module({
  imports: [ConfigModule, ScenarioModule, MongoModule, AuthModule, ProcessModule, ApikeyModule, NotifyModule, AjvModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(YamlBodyParserMiddleware).forRoutes({ path: '/scenarios', method: RequestMethod.POST });
  }
}
