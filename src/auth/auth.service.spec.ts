import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigModule } from '@/common/config/config.module';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Db } from 'mongodb';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@/common/config/config.service';

const developmentJwtOptions = {
  global: true,
  secret: 'development only!',
  signOptions: { expiresIn: '24h' },
};

describe('AuthService', () => {
  let service: AuthService;
  let module: TestingModule;
  let apiKeysCollection: { findOne: jest.Mock; updateOne: jest.Mock };

  beforeEach(async () => {
    apiKeysCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    module = await Test.createTestingModule({
      imports: [ConfigModule, JwtModule.register(developmentJwtOptions)],
      providers: [
        AuthService,
        {
          provide: Db,
          useValue: {
            collection: jest.fn().mockReturnValue(apiKeysCollection),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    // Default init
    const config = module.get(ConfigService);
    jest.spyOn(config, 'get').mockImplementation((key: any) => {
      if (key === 'jwt.transform') return '';
      if (key === 'dev.demoAccounts') return false;
      return undefined as any;
    });
    service.onModuleInit();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('onModuleInit initializes demo accounts when enabled', () => {
    const config = module.get(ConfigService);
    jest
      .spyOn(config, 'get')
      .mockImplementation((key: any) =>
        key === 'jwt.transform'
          ? ''
          : key === 'dev.demoAccounts'
            ? true
            : key === 'dev.defaultAccount'
              ? 'alice'
              : (config as any).get(key),
      );

    service.onModuleInit();

    expect(service.demoAccounts).toBeDefined();
    expect(service.defaultAccount?.id).toBe('alice');
  });

  it('devAccount creates token for provided account', () => {
    const account = service.devAccount({ id: 'x', info: { name: 'X' }, roles: ['r'] });
    expect(account?.token).toBeDefined();
    expect(account?.id).toBe('x');
  });

  it('hasPrivilege checks privileges correctly', () => {
    const config = module.get(ConfigService);
    jest.spyOn(config, 'get').mockImplementation((key: any) => {
      if (key === 'auth.roles') return { admin: ['*'], user: ['process:start'], viewer: [] } as any;
      if (key === 'jwt.transform') return '';
      return undefined as any;
    });

    service.onModuleInit();

    expect(service.hasPrivilege({ id: '1', roles: ['user'], token: '', info: {} }, 'process:start')).toBe(true);
    expect(service.hasPrivilege({ id: '1', roles: ['viewer'], token: '', info: {} }, 'process:start')).toBe(false);
    expect(service.hasPrivilege({ id: '1', roles: ['admin'], token: '', info: {} }, 'process:super')).toBe(true);
    expect(service.hasPrivilege({ id: '1', roles: ['user'], token: '', info: {} }, ['process:start'])).toBe(true);
  });

  it('verifyJWT returns null on invalid token', () => {
    expect(service.verifyJWT('invalid.token.value')).toBeNull();
  });

  it('verifyJWT uses transform and throws when id missing', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const config = module.get(ConfigService);
    jest.spyOn(config, 'get').mockImplementation((key: any) => {
      if (key === 'jwt.transform') return '{roles: roles, info: info}';
      return undefined as any;
    });

    service.onModuleInit();

    const token = module.get(JwtService).sign({ name: 'No id' } as any);

    expect(() => service.verifyJWT(token)).toThrow('Invalid JWT payload');
    expect(warn).toHaveBeenCalled();
  });

  it('verifyJWT returns account when token valid', () => {
    const token = module.get(JwtService).sign({ id: 'abc', roles: ['x'], info: { a: 1 } } as any);
    const acc = service.verifyJWT(token);
    expect(acc).toEqual({ id: 'abc', roles: ['x'], info: { a: 1 }, token });
  });

  it('verifyApiKey returns data and updates lastUsed when found', async () => {
    apiKeysCollection.findOne.mockResolvedValue({ privileges: ['p'], service: 'svc' });
    const res = await service.verifyApiKey('t');
    expect(res).toEqual({ privileges: ['p'], service: 'svc' });
    expect(apiKeysCollection.updateOne).toHaveBeenCalled();
  });

  it('verifyApiKey returns null when not found', async () => {
    apiKeysCollection.findOne.mockResolvedValue(null);
    const res = await service.verifyApiKey('t');
    expect(res).toBeNull();
  });
});
