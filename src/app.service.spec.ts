import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { ConfigService } from '@/common/config/config.service';
import Ajv, { AnySchema } from 'ajv';

describe('AppService', () => {
  let service: AppService;
  let config: { get: jest.Mock };
  let ajv: Ajv;

  beforeEach(async () => {
    config = { get: jest.fn().mockReturnValue('test') } as any;

    ajv = new Ajv({ allErrors: true });
    // Register a few schemas so that schemas listing is covered
    ajv.addSchema({ $id: 'https://schemas.letsflow.io/example-1', type: 'object' } as AnySchema);
    ajv.addSchema({ $id: 'https://json-schema.org/draft/2020-12/schema', type: 'object' } as AnySchema);

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService, { provide: ConfigService, useValue: config }, { provide: Ajv, useValue: ajv }],
    }).compile();

    service = module.get(AppService);
  });

  it('initializes info on module init', () => {
    service.onModuleInit();

    expect(service.info).toBeDefined();
    expect(typeof service.info.name).toBe('string');
    expect(typeof service.info.version).toBe('string');
    expect(typeof service.info.description).toBe('string');
    expect(service.info.env).toEqual('test');
    // Should include our custom schema id
    expect(service.info.schemas).toContain('https://schemas.letsflow.io/example-1');
    expect(Array.isArray(service.info.schemas)).toBe(true);
  });
});
