import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScenarioModule } from './scenario/scenario.module';
import { YamlBodyParserMiddleware } from './middleware/yamlBodyParser.middleware';
import { ProcessModule } from './process/process.module';
import { ApiKeyModule } from './apikey/apikey.module';
import { ConfigModule } from './common/config/config.module';
import { AuthModule } from './common/auth/auth.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AjvModule } from '@/common/ajv/ajv.module';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    ScenarioModule,
    ProcessModule,
    ApiKeyModule,
    EventEmitterModule.forRoot(),
    AjvModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(YamlBodyParserMiddleware).forRoutes({ path: '/scenarios', method: RequestMethod.POST });
  }
}
