import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { ScenarioService } from '@/scenario/scenario.service';
import { AjvModule } from '@/common/ajv/ajv.module';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AjvModule],
      providers: [ValidationService, { provide: ScenarioService, useValue: {} }],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
