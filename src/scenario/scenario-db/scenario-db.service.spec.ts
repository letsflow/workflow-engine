import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioDbService } from './scenario-db.service';

describe('ScenarioDbService', () => {
  let service: ScenarioDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScenarioDbService],
    }).compile();

    service = module.get<ScenarioDbService>(ScenarioDbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
