import { Module } from '@nestjs/common';

const providers = [{ provide: 'FETCH', useValue: fetch }];

@Module({
  providers: providers,
  exports: providers,
})
export class FetchModule {}
