import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@/common/config/config.service';
import { Account } from './types';
import jmespath from '@letsflow/jmespath';
import { ApiKey } from '@/apikey';
import { Collection, Db } from 'mongodb';
import { Privilege } from './privileges';

type ApiKeyDocument = Omit<ApiKey, 'id' | 'expirationDays' | 'isActive'>;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  private _demoAccounts?: Array<Account>;
  private _defaultAccount?: Account;
  private transform?: string;
  private apiKeys: Collection<ApiKeyDocument>;

  constructor(
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
        info: { name: 'Alice' },
        roles: ['support'],
        token: this.jwt.sign({ id: 'alice', info: { name: 'Alice' } }),
      },
      {
        id: 'bob',
        info: { name: 'Bob' },
        roles: ['management'],
        token: this.jwt.sign({ id: 'bob', info: { name: 'Bob' } }),
      },
      {
        id: 'claire',
        info: { name: 'Claire' },
        roles: ['client'],
        token: this.jwt.sign({ id: 'claire', info: { name: 'Claire' } }),
      },
      {
        id: 'david',
        info: { name: 'David' },
        roles: [],
        token: this.jwt.sign({ id: 'david', info: { name: 'David' } }),
      },
      {
        id: 'admin',
        info: { name: 'Arnold' },
        roles: ['admin'],
        token: this.jwt.sign({ id: 'admin', info: { name: 'Arnold' }, roles: ['admin'] }),
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

  public hasPrivilege(account: Account, allow: Privilege | Privilege[]): boolean {
    const map = this.config.get('auth.roles');
    const list = ['*', ...(Array.isArray(allow) ? allow : [allow])];

    return account.roles.some((role) => map[role].some((p: Privilege) => list.includes(p)));
  }

  public verifyJWT(token: string): Account {
    let user: any;

    try {
      user = this.jwt.verify(token);
    } catch {
      return null;
    }

    if (this.transform) {
      user = jmespath.search(user, this.transform);
    }

    if (!('id' in user)) {
      this.logger.warn('Invalid JWT payload: missing "id" field', { token });
      throw new Error('Invalid JWT payload');
    }

    return {
      id: user.id,
      roles: user.roles ?? [],
      token,
      info: user.info ?? {},
    };
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
