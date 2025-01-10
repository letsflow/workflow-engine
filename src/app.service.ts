import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from './common/config/config.service';

@Injectable()
export class AppService implements OnModuleInit {
  info: {
    name: string;
    version: string;
    description: string;
    env: string;
  };

  constructor(private config: ConfigService) {}

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
    };
  }
}
