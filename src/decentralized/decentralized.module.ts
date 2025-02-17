import { Module } from '@nestjs/common';
import { DecentralizedService } from './decentralized.service';

@Module({
  providers: [DecentralizedService]
})
export class DecentralizedModule {}
