import { Module } from '@nestjs/common';
import { ConfigService } from './config.service';

@Module({
  providers: [
    ConfigService,
    {
      provide: 'ENV_VARS',
      useValue: process.env,
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
