import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { developmentJwtOptions } from './constants';
import { AuthService } from './auth.service';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [ConfigModule, JwtModule.register(developmentJwtOptions)],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
