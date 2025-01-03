import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScenarioModule } from './scenario/scenario.module';
import { YamlBodyParserMiddleware } from './middleware/yamlBodyParser.middleware';
import { ProcessModule } from './process/process.module';
import { ApiKeyModule } from './apikey/apikey.module';
import { ConfigModule } from './common/config/config.module';
import { AuthModule } from './common/auth/auth.module';

@Module({
  imports: [ConfigModule, AuthModule, ScenarioModule, ProcessModule, ApiKeyModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(YamlBodyParserMiddleware).forRoutes({ path: '/scenarios', method: RequestMethod.POST });
  }
}
