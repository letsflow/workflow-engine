import { Test, TestingModule } from '@nestjs/testing';
import { NotifyMessageService } from './notify-message.service';

describe('NotifyMessageService', () => {
  let service: NotifyMessageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotifyMessageService],
    }).compile();

    service = module.get<NotifyMessageService>(NotifyMessageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
