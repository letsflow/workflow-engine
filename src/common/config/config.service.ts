import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import convict from 'convict';
import schema from '../../config/schema';
import * as fs from 'node:fs';
import * as path from 'node:path';

type SchemaOf<T extends convict.Schema<any>> = T extends convict.Schema<infer R> ? R : any;
type Schema = SchemaOf<typeof schema>;
type Path = convict.Path<SchemaOf<typeof schema>>;
type PathValue<K extends Path> = K extends null | undefined
  ? Schema
  : K extends convict.Path<Schema>
    ? convict.PathValue<Schema, K>
    : never;

const CONFIG_PATH = path.normalize(__dirname + '/../../config');

@Injectable()
export class ConfigService implements OnModuleInit, OnModuleDestroy {
  private config: convict.Config<Schema>;
  private readonly ttl: number = 300000; // 5 minutes in milliseconds
  private reloadInterval: ReturnType<typeof setInterval>;

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

    const configFiles = [`${env}.json`, 'local.json', `${env}.local.json`]
      .map((file) => path.join(CONFIG_PATH, file))
      .filter(fs.existsSync);

    config.loadFile(configFiles);
    config.set('notificationMethods', this.loadNotificationMethodsFromEnv(config.get('notificationMethods')));

    config.validate({ allowed: 'warn' });

    this.config = config;
  }

  private loadNotificationMethodsFromEnv(methods: Record<string, Record<string, any>>) {
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith('NOTIFICATION_')) {
        const [_, id, envProp] = key.split('_', 3);
        const prop = envProp.toLowerCase().replace(/_([a-z])/g, (_, group1) => group1.toUpperCase());

        methods[id] ??= {};
        methods[id][prop] = process.env[key];
      }
    });

    return methods;
  }

  get<K extends Path>(key: K): PathValue<K> {
    return this.config.get(key);
  }

  has(key: Path): boolean {
    return this.config.has(key);
  }
}
