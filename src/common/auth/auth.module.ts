import { Logger, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ConfigModule } from '../config/config.module';
import { NotifyService } from '@/notify/notify.service';
import { ConfigService } from '../config/config.service';
import { MongoModule } from '../mongo/mongo.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      global: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        config.onModuleInit();
        return config.get('jwt');
      },
    }),
    MongoModule,
  ],
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
