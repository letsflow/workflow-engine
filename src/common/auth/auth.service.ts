import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { Account } from './interfaces';
import jmespath from '@letsflow/jmespath';

@Injectable()
export class AuthService implements OnModuleInit {
  private _demoAccounts?: Array<Account>;
  private _defaultAccount?: Account;
  private transform?: string;

  constructor(
    private logger: Logger,
    private config: ConfigService,
    private jwt: JwtService,
  ) {}

  onModuleInit() {
    this.transform = this.config.get('jwt.transform');

    if (this.config.get('dev.demoAccounts')) {
      this.initDemoAccounts();
    }
  }

  public get adminRole(): string {
    return this.config.get('auth.adminRole');
  }

  private initDemoAccounts() {
    this._demoAccounts = [
      {
        id: 'alice',
        name: 'Alice',
        roles: [],
        token: this.jwt.sign({ id: 'alice', name: 'Alice' }),
      },
      {
        id: 'bob',
        name: 'Bob',
        roles: [],
        token: this.jwt.sign({ id: 'bob', name: 'Bob' }),
      },
      {
        id: 'claire',
        name: 'Claire',
        roles: [],
        token: this.jwt.sign({ id: 'claire', name: 'Claire' }),
      },
      {
        id: 'david',
        name: 'David',
        roles: [],
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

  public jwtToAccount(token: string): Account {
    let account = this.jwt.decode(token);
    if (this.transform) {
      account = jmespath.search(account, this.transform);
    }
    account.token = token;

    if (!('id' in account)) {
      this.logger.warn('Invalid JWT payload: missing "id" field', { token });
      throw new Error('Invalid JWT payload');
    }

    return account as Account;
  }
}
