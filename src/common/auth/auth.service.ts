import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '../config/config.service';
import { Account } from './account.interface';
import jmespath from '@letsflow/jmespath';
import { ApiKey } from '@/apikey';
import { Collection, Db } from 'mongodb';

type ApiKeyDocument = Omit<ApiKey, 'id' | 'expirationDays' | 'isActive'>;

@Injectable()
export class AuthService implements OnModuleInit {
  private _demoAccounts?: Array<Account>;
  private _defaultAccount?: Account;
  private transform?: string;
  private apiKeys: Collection<ApiKeyDocument>;

  constructor(
    private readonly logger: Logger,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly db: Db,
  ) {}

  onModuleInit() {
    this.transform = this.config.get('jwt.transform');
    this.apiKeys = this.db.collection<ApiKeyDocument>('apikeys');

    if (this.config.get('dev.demoAccounts')) {
      this.initDemoAccounts();
    }
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

  public devAccount(account: Omit<Account, 'token'>): Account | null {
    return { ...account, token: this.jwt.sign(account) };
  }

  public verifyJWT(token: string): Account {
    let account: any;

    try {
      account = this.jwt.verify(token);
    } catch {
      return null;
    }

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

  async verifyApiKey(token: string): Promise<Pick<ApiKey, 'privileges' | 'processes'> | null> {
    const doc = await this.apiKeys.findOne(
      { token, expiration: { $gt: new Date() }, revoked: { $exists: false } },
      {
        projection: { _id: 0, privileges: 1, processes: 1 },
      },
    );

    if (doc) {
      await this.apiKeys.updateOne({ token }, { $set: { lastUsed: new Date() } });
    }

    return doc;
  }
}
