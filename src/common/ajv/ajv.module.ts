import { Module } from '@nestjs/common';
import { ajvProvider } from './ajv.provider';

@Module({
  providers: [ajvProvider],
  exports: [ajvProvider],
})
export class AjvModule {}
