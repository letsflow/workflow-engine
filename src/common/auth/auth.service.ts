import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';

interface Account {
  id: string;
  name: string;
  roles?: Array<string>;
  access_token: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private _demoAccounts?: Array<Account>;
  private _defaultAccount?: Account;

  constructor(private config: ConfigService, private jwt: JwtService) {}

  async onModuleInit() {
    if (this.config.get('dev.demoAccounts')) {
      await this.initDemoAccounts();
    }
  }

  private async initDemoAccounts() {
    this._demoAccounts = [
      {
        id: 'alice',
        name: 'Alice',
        access_token: await this.jwt.signAsync({ id: 'alice', name: 'Alice' }),
      },
      {
        id: 'bob',
        name: 'Bob',
        access_token: await this.jwt.signAsync({ id: 'bob', name: 'Bob' }),
      },
      {
        id: 'claire',
        name: 'Claire',
        access_token: await this.jwt.signAsync({ id: 'claire', name: 'Claire' }),
      },
      {
        id: 'david',
        name: 'David',
        access_token: await this.jwt.signAsync({ id: 'david', name: 'David' }),
      },
      {
        id: 'admin',
        name: 'Arnold',
        roles: ['admin'],
        access_token: await this.jwt.signAsync({ id: 'admin', name: 'Arnold', roles: ['admin'] }),
      },
    ];

    const defaultAccountId = this.config.get('dev.defaultAccount');
    this._defaultAccount = this._demoAccounts.find((account) => account.id === defaultAccountId);
  }

  public get demoAccounts(): Array<Account> | undefined {
    return this._demoAccounts;
  }

  public get defaultAccount(): Account | undefined {
    return this._defaultAccount;
  }
}
