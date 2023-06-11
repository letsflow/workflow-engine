import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { ScenarioModule } from './scenario/scenario.module';
import { YamlBodyParserMiddleware } from './middleware/yamlBodyParser.middleware';
import { mongoProvider } from './mongo.provider';

@Module({
  imports: [ConfigModule, ScenarioModule],
  controllers: [AppController],
  providers: [AppService, mongoProvider],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(YamlBodyParserMiddleware).forRoutes({ path: '/scenarios', method: RequestMethod.POST });
  }
}
