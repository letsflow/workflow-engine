import { Module } from '@nestjs/common';
import { LTO } from '@ltonetwork/lto';
import { ConfigService } from '../config/config.service';
import { Account } from '@ltonetwork/lto/accounts';
import { Relay } from '@ltonetwork/lto/messages';
import { PublicNode } from '@ltonetwork/lto/node';

@Module({
  providers: [
    {
      provide: LTO,
      useFactory: (config: ConfigService) => {
        const lto = new LTO(config.get('lto.networkId'));

        if (config.get('lto.node')) {
          lto.node = new PublicNode(config.get('lto.node.url'), config.get('lto.node.apiKey') || undefined);
        }
        if (config.get('lto.relay')) {
          lto.relay = new Relay(config.get('lto.relay'));
        }

        return lto;
      },
      inject: [ConfigService],
    },
    {
      provide: Account,
      useFactory: (lto: LTO, config: ConfigService) => {
        return lto.account({
          keyType: config.get('lto.account.keyType'),
          seed: config.get('lto.account.seed') || undefined,
          nonce: config.get('lto.account.nonce'),
        });
      },
      inject: [LTO, ConfigService],
    },
  ],
})
export class LtoModule {}
