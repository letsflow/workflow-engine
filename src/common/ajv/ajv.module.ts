import { Module } from '@nestjs/common';
import Ajv from 'ajv/dist/2020';

@Module({
  providers: [
    {
      provide: Ajv,
      useValue: new Ajv(),
    },
  ],
  exports: [Ajv],
})
export class AjvModule {}
