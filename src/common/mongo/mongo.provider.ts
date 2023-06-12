import { Provider } from '@nestjs/common';
import { MongoClient, Db } from 'mongodb';
import { ConfigService } from '../config/config.service';

export const mongoProvider: Provider = {
  provide: Db,
  useFactory: async (config: ConfigService): Promise<Db> => {
    await config.onModuleInit();

    const client = new MongoClient(config.get('db'));
    await client.connect();

    return client.db();
  },
  inject: [ConfigService],
};
