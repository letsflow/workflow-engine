import { Test, TestingModule } from '@nestjs/testing';
import { ZeromqService } from './zeromq.service';
import { ConfigService } from '../../common/config/config.service';
import { NotifyMessageService } from '../notify-message/notify-message.service';

describe('ZmqService', () => {
  let service: ZeromqService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZeromqService,
        NotifyMessageService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ZeromqService>(ZeromqService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
