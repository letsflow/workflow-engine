import { Module } from '@nestjs/common';
import { ProcessService } from './process.service';
import { ProcessController } from './process.controller';
import { ScenarioModule } from '@/scenario/scenario.module';
import { MongoModule } from '@/common/mongo/mongo.module';
import { AuthModule } from '@/auth/auth.module';
import { AjvModule } from '@/common/ajv/ajv.module';
import { ConfigModule } from '@/common/config/config.module';
import { ConfigService } from '@/common/config/config.service';
import { LtoModule } from '@/common/lto/lto.module';
import { Account as LtoAccount } from '@ltonetwork/lto/accounts';
import { HashFn, instantiate, withHash } from '@letsflow/core/process';
import { getHashFn, getInstantiateFn } from '@/decentralized/convert';

type InstantiateFn = typeof instantiate;

@Module({
  imports: [ScenarioModule, MongoModule, AuthModule, AjvModule, ConfigModule, LtoModule],
  providers: [
    ProcessService,
    {
      provide: 'HASH_FN',
      useFactory: (config: ConfigService, account: LtoAccount): HashFn => {
        return config.get('decentralized.enabled') ? getHashFn(account) : withHash;
      },
    },
    {
      provide: 'INSTANTIATE_FN',
      useFactory: (config: ConfigService, account: LtoAccount): InstantiateFn => {
        return config.get('decentralized.enabled') ? getInstantiateFn(account) : instantiate;
      },
    },
  ],
  controllers: [ProcessController],
})
export class ProcessModule {}
