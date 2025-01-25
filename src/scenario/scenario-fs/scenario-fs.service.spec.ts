import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioFsService } from './scenario-fs.service';
import { ConfigModule } from '@/common/config/config.module';

describe('ScenarioFsService', () => {
  let service: ScenarioFsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [ScenarioFsService],
    }).compile();

    service = module.get<ScenarioFsService>(ScenarioFsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
