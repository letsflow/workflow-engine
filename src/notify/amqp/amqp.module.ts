import { Module } from '@nestjs/common';
import { AmqpService } from './ampq.service';

@Module({
  providers: [AmqpService],
})
export class AmqpModule {}
