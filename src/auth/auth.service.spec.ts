import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { ConfigModule } from '@/common/config/config.module';
import { JwtModule } from '@nestjs/jwt';
import { Db } from 'mongodb';

const developmentJwtOptions = {
  global: true,
  secret: 'development only!',
  signOptions: { expiresIn: '24h' },
};

describe('AuthService', () => {
  let service: AuthService;
  let apiKeysCollection: { findOne: jest.Mock; updateOne: jest.Mock };

  beforeEach(async () => {
    apiKeysCollection = {
      findOne: jest.fn(),
      updateOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
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
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
