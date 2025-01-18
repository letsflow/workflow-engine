import { Logger } from '@nestjs/common';
import { normalize, Schema } from '@letsflow/core/scenario';
import fs from 'fs/promises';
import { yaml } from '@letsflow/core';
import yamlOptions from '@/common/yaml-options';
import { schemaSchema } from '@letsflow/core/schemas/v1.0.0';

type FetchFunction = typeof fetch;

export async function fetchSchema(fetch: FetchFunction, uri: string, logger: Logger) {
  const response = await fetch(uri);
  if (!response.ok) {
    logger.warn(`Failed to fetch schema at ${uri}: ${response.status} ${response.statusText}`);
    return {};
  }

  try {
    return await response.json();
  } catch (error) {
    logger.warn(`Failed to parse schema at ${uri}: ${error}`);
    return {};
  }
}

export async function loadSchemaFiles(dir: string, logger: Logger): Promise<Schema[]> {
  if (
    !(await fs
      .stat(dir)
      .then((stat) => stat.isDirectory())
      .catch(() => false))
  ) {
    return [];
  }

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
