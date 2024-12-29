import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioFsService } from './scenario-fs.service';

describe('ScenarioFsService', () => {
  let service: ScenarioFsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScenarioFsService],
    }).compile();

    service = module.get<ScenarioFsService>(ScenarioFsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
