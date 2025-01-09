import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { Db, MongoClient } from 'mongodb';
import { ConfigService } from '../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: Db,
      useFactory: async (config: ConfigService): Promise<Db> => {
        config.onModuleInit();

        const client = new MongoClient(config.get('db'), { connectTimeoutMS: 3000 });
        await client.connect();

        return client.db();
      },
      inject: [ConfigService],
    },
  ],
  exports: [Db],
})
export class MongoModule {}
