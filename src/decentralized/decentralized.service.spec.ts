import { Test, TestingModule } from '@nestjs/testing';
import { DecentralizedService } from './decentralized.service';

describe('DecentralizedService', () => {
  let service: DecentralizedService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DecentralizedService],
    }).compile();

    service = module.get<DecentralizedService>(DecentralizedService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
