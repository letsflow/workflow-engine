import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import convict from 'convict';
import schema from '../../config/schema';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';

type SchemaOf<T extends convict.Schema<any>> = T extends convict.Schema<infer R> ? R : any;
type Schema = SchemaOf<typeof schema>;
type Path = convict.Path<SchemaOf<typeof schema>>;
type PathValue<K extends Path> = K extends null | undefined
  ? Schema
  : K extends convict.Path<Schema>
    ? convict.PathValue<Schema, K>
    : never;

const CONFIG_PATH = path.normalize(__dirname + '/../../config');
const LOCAL_CONFIG_PATH = process.env.CONFIG_PATH;

@Injectable()
export class ConfigService implements OnModuleInit, OnModuleDestroy {
  private config: convict.Config<Schema>;
  private readonly ttl: number = 300000; // 5 minutes in milliseconds
  private reloadInterval: ReturnType<typeof setInterval>;

  constructor(@Inject('ENV_VARS') private readonly env: NodeJS.ProcessEnv) {}

  onModuleInit() {
    if (!this.config) {
      this.load();
    }
    this.reloadInterval ??= setInterval(() => this.load(), this.ttl);
  }

  async onModuleDestroy() {
    if (this.reloadInterval) {
      clearInterval(this.reloadInterval);
    }
  }

  public load(): void {
    const config = convict(schema);
    const env = config.get('env');

    const configFiles = [
      `${env}.json`,
      `local.json`,
      `${env}.local.json`,
      ...(LOCAL_CONFIG_PATH ? [`${LOCAL_CONFIG_PATH}/settings.json`, `${LOCAL_CONFIG_PATH}/${env}.json`] : []),
    ]
      .map((file) => path.join(CONFIG_PATH, file))
      .filter(fs.existsSync);

    config.loadFile(configFiles);
    config.set('services', this.loadServicesFromEnv(config.get('services')));

    config.validate({ allowed: 'warn' });

    this.config = config;
  }

  private loadServicesFromEnv(services: Record<string, Record<string, any>>) {
    const keys = Object.keys(this.env).filter((key) => key.startsWith('SERVICE_'));

    const keyToProp = (key: string) => key.toLowerCase().replace(/_([a-z])/g, (_, group1) => group1.toUpperCase());

    for (const key of keys) {
      const [, ...parts] = key.split('_');
      let service: Record<string, any>;
      let prop: string;

      for (let i = parts.length - 1; i > 0; i--) {
        service = services[keyToProp(parts.slice(0, i).join('_'))];
        if (service) {
          prop = keyToProp(parts.slice(i).join('_'));
          break;
        }
      }

      if (service && prop) {
        service[prop] = this.env[key];
      }
    }

    return services;
  }

  get<K extends Path>(key: K): PathValue<K> {
    return this.config.get(key);
  }
}
