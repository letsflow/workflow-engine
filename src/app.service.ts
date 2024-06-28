import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from './common/config/config.service';
import { AuthService } from './common/auth/auth.service';

@Injectable()
export class AppService implements OnModuleInit {
  info: {
    name: string;
    version: string;
    description: string;
    env: string;
    accounts?: Array<{ id: string; name?: string; roles?: string[]; token: string }>;
  };

  constructor(
    private config: ConfigService,
    private auth: AuthService,
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
      accounts: this.auth.demoAccounts,
    };
  }
}
