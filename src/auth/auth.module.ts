import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ConfigModule } from '@/common/config/config.module';
import { ConfigService } from '@/common/config/config.service';
import { MongoModule } from '@/common/mongo/mongo.module';

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
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
