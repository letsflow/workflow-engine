import { Injectable, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';

interface Account {
  id: string;
  name?: string;
  roles?: Array<string>;
  token: string;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private _demoAccounts?: Array<Account>;
  private _defaultAccount?: Account;

  constructor(private config: ConfigService, private jwt: JwtService) {}

  onModuleInit() {
    if (this.config.get('dev.demoAccounts')) {
      this.initDemoAccounts();
    }
  }

  private initDemoAccounts() {
    this._demoAccounts = [
      {
        id: 'alice',
        name: 'Alice',
        token: this.jwt.sign({ id: 'alice', name: 'Alice' }),
      },
      {
        id: 'bob',
        name: 'Bob',
        token: this.jwt.sign({ id: 'bob', name: 'Bob' }),
      },
      {
        id: 'claire',
        name: 'Claire',
        token: this.jwt.sign({ id: 'claire', name: 'Claire' }),
      },
      {
        id: 'david',
        name: 'David',
        token: this.jwt.sign({ id: 'david', name: 'David' }),
      },
      {
        id: 'admin',
        name: 'Arnold',
        roles: ['admin'],
        token: this.jwt.sign({ id: 'admin', name: 'Arnold', roles: ['admin'] }),
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

  public devAccount(account: Omit<Account, 'token'>): Account {
    return { ...account, token: this.jwt.sign(account) };
  }
}
