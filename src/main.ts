import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from './common/config/config.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';

async function swagger(app: INestApplication, config: ConfigService) {
  const packagePath = path.join(process.cwd(), 'package.json');
  const { description, version } = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

  const options = new DocumentBuilder()
    .setTitle('LetsFlow')
    .setDescription(description)
    .setVersion(version !== '0.0.0' ? version : config.get('env'))
    .addBearerAuth({ type: 'http', bearerFormat: 'jwt' })
    .build();

  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('api-docs', app, document);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.disable('x-powered-by');

  const config = app.get<ConfigService>(ConfigService);
  config.onModuleInit();

  app.enableShutdownHooks();

  await swagger(app, config);
  await app.listen(process.env.PORT || 3000);
}

bootstrap().then();
