import { Logger, Module } from '@nestjs/common';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import { actionSchema, actorSchema, fnSchema, scenarioSchema, schemaSchema } from '@letsflow/core/schemas/v1.0.0';
import fs from 'fs/promises';
import { ConfigModule } from '@/common/config/config.module';
import { ConfigService } from '@/common/config/config.service';
import { yaml } from '@letsflow/core';
import { normalize, Schema } from '@letsflow/core/scenario';
import yamlOptions from '@/common/yaml-options';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: Ajv,
      useFactory: async (config: ConfigService) => {
        const logger = new Logger('Ajv');

        const ajv = new Ajv2020({ allErrors: true });
        ajv.addKeyword('$anchor'); // Workaround for https://github.com/ajv-validator/ajv/issues/1854
        ajv.addSchema([scenarioSchema, actionSchema, actorSchema, fnSchema, schemaSchema]);

        const schemas = await loadSchemas(config.get('schema.path'), logger);
        ajv.addSchema(schemas);

        return ajv;
      },
      inject: [ConfigService],
    },
  ],
  exports: [Ajv],
})
export class AjvModule {}

async function loadSchemas(dir: string, logger: Logger): Promise<Schema[]> {
  const files = await fs.readdir(dir);
  const schemaContent = await Promise.all(
    files
      .filter((file) => file.endsWith('.json') || file.endsWith('.yaml') || file.endsWith('.yml'))
      .map((file) => fs.readFile(`${dir}/${file}`, 'utf8').then((content) => [file, content] as const)),
  );

  return schemaContent
    .map(([file, content]): [string, Schema | undefined] => {
      try {
        const schema = file.endsWith('.json') ? JSON.parse(content) : yaml.parse(content, yamlOptions);
        return [file, schema];
      } catch (e) {
        logger.warn(`Failed to parse schema ${file}`);
        return [file, undefined];
      }
    })
    .filter(([file, schema]) => {
      if (typeof schema === 'undefined') {
        return false;
      }

      if (!schema || !schema.$id) {
        logger.warn(`Skipping schema '${file}': Missing '$id' property`);
        return false;
      }

      if (schema.$schema && typeof schema.$schema !== 'string') {
        logger.warn(`Skipping schema '${file}': '$schema' must be a string`);
        return false;
      }

      if (schema.$schema && schema.$schema !== schemaSchema.id && schema.$schema !== schemaSchema.$schema) {
        logger.warn(`Skipping schema '${file}': Unsupported schema ${schema.$schema}`);
        return false;
      }

      logger.debug(`Loaded schema ${schema.$id}`);
      return true;
    })
    .map(([, schema]) => normalize(schema, { $schema: schemaSchema.$id }));
}
