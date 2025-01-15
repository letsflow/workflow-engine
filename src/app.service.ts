import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from './common/config/config.service';
import Ajv from 'ajv';

@Injectable()
export class AppService implements OnModuleInit {
  info: {
    name: string;
    version: string;
    description: string;
    env: string;
    schemas: string[];
  };

  constructor(
    private readonly config: ConfigService,
    private readonly ajv: Ajv,
  ) {}

  onModuleInit() {
    this.initInfo();
  }

  private initInfo() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const packageInfo = require('../package.json');

    this.info = {
      name: packageInfo.name,
      version: packageInfo.version,
      description: packageInfo.description,
      env: this.config.get('env'),
      schemas: Object.values(this.ajv.schemas)
        .map((env) => (env as any)?.schema?.$id as string | undefined)
        .filter((id) => !!id && !id.match(/^https:\/\/json-schema\.org\/.+\/meta\//)),
    };
  }
}
