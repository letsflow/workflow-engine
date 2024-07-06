import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { developmentJwtOptions } from './constants';
import { AuthService } from './auth.service';
import { ConfigModule } from '../config/config.module';
import { NotifyService } from '../../notify/notify.service';

@Module({
  imports: [ConfigModule, JwtModule.register(developmentJwtOptions)],
  providers: [
    AuthService,
    {
      provide: Logger,
      useValue: new Logger(NotifyService.name),
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
