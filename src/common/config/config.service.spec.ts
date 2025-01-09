import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from './config.service';

describe('ConfigService', () => {
  let service: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfigService,
        {
          provide: 'ENV_VARS',
          useValue: {
            SERVICE_FOO_BAR_KEY: 'value1',
            SERVICE_FOO_BAR_SECOND: 'value2',
            SERVICE_OTHER_API_KEY: 'value3',
            SERVICE_NONE_KEY: 'value4',
          },
        },
      ],
    }).compile();

    service = module.get<ConfigService>(ConfigService);
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should give the correct environment', () => {
    expect(service.get('env')).toBe('test');
  });

  it('should correctly load services from environment variables', () => {
    const services = {
      fooBar: { provider: 'test' },
      other: {},
    };

    const updatedServices = service['loadServicesFromEnv'](services);

    expect(updatedServices.fooBar).toEqual({
      provider: 'test',
      key: 'value1',
      second: 'value2',
    });

    expect(updatedServices.other).toEqual({
      apiKey: 'value3',
    });

    expect(updatedServices.none).toBeUndefined();
  });
});
