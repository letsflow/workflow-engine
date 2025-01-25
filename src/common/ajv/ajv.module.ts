import { Logger, Module } from '@nestjs/common';
import Ajv, { Options } from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import * as coreSchemas from '@letsflow/core/schemas/v1.0';
import { ConfigModule } from '@/common/config/config.module';
import { ConfigService } from '@/common/config/config.service';
import { FetchModule } from '@/common/fetch/fetch.module';
import { fetchSchema, loadSchemaFiles } from './load';

type FetchFunction = typeof fetch;

@Module({
  imports: [ConfigModule, FetchModule],
  providers: [
    {
      provide: Ajv,
      useFactory: async (config: ConfigService, fetch: FetchFunction) => {
        const logger = new Logger('Ajv');
        const options: Options = { allErrors: true };

        if (config.get('schema.fetch.enabled')) {
          options.loadSchema = async (uri: string) => fetchSchema(fetch, uri, logger);
        }

        const ajv = new Ajv2020(options);
        ajv.addKeyword('$anchor'); // Workaround for https://github.com/ajv-validator/ajv/issues/1854
        ajv.addSchema(coreSchemas);

        const schemas = await loadSchemaFiles(config.get('schema.path'), logger);
        ajv.addSchema(schemas);

        return ajv;
      },
      inject: [ConfigService, 'FETCH'],
    },
  ],
  exports: [Ajv],
})
export class AjvModule {}
