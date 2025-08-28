import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from './common/config/config.service';
import Ajv from 'ajv';
import * as path from 'path';
import * as fs from 'fs';

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
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));

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
