import { Test, TestingModule } from '@nestjs/testing';
import { ValidationService } from './validation.service';
import { ScenarioService } from '../../scenario/scenario.service';

describe('ValidationService', () => {
  let service: ValidationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService, { provide: ScenarioService, useValue: {} }],
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
