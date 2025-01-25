import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioDbService } from './scenario-db.service';
import { Db } from 'mongodb';
import { ConfigModule } from '@/common/config/config.module';

describe('ScenarioDbService', () => {
  let service: ScenarioDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        ScenarioDbService,
        {
          provide: Db,
          useValue: {
            collection: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ScenarioDbService>(ScenarioDbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
