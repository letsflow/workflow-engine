import { Test, TestingModule } from '@nestjs/testing';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';
import { ValidationService } from './validation/validation.service';
import { Response } from 'express';
import { StartInstructions } from './process.dto';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from '../common/auth/auth.service';
import Ajv from 'ajv/dist/2020';
import { ScenarioService } from '../scenario/scenario.service';
import { Account } from '../common/auth';
import { ApiKey } from '../apikey';

describe('ProcessController', () => {
  let controller: ProcessController;
  let service: ProcessService;
  let validation: ValidationService;

  let mockResponse: Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessController],
      providers: [
        {
          provide: ProcessService,
          useValue: {
            list: jest.fn(),
            instantiate: jest.fn(),
            has: jest.fn(),
            get: jest.fn(),
            save: jest.fn(),
            step: jest.fn(),
          },
        },
        {
          provide: ScenarioService,
          useValue: {
            list: jest.fn(),
            getIds: jest.fn(),
            has: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: Ajv,
          useValue: new Ajv(),
        },
        ValidationService,
        {
          provide: AuthService,
          useValue: {
            validateJwt: jest.fn(),
            validateApiKey: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProcessController>(ProcessController);
    service = module.get<ProcessService>(ProcessService);
    validation = module.get<ValidationService>(ValidationService);
  });

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      send: jest.fn(),
      json: jest.fn(),
    } as unknown as Response;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('list', () => {
    const mockProcesses = [
      {
        id: '00000000-0000-0000-0001-000000000001',
        title: 'Test Process',
        scenario: { id: '00000000-0000-0000-0002-000000000001', name: 'test' },
        actors: {
          client: { id: '3' },
          assistant: { role: 'assistant' },
        },
        created: new Date(),
        lastUpdated: new Date(),
      },
    ];

    const user = { id: '2', roles: ['admin', 'team', 'assistant'] } as Account;
    const apiKey = {
      processes: [{ scenario: 'test' }, { scenario: 'test2', actors: ['system'] }],
    } as ApiKey;

    it('should return a list of processes', async () => {
      jest.spyOn(service, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, undefined, undefined, mockResponse);

      expect(service.list).toHaveBeenCalledWith({ limit: 100, page: 1 });
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcesses);
    });

    it('should return page 2', async () => {
      jest.spyOn(service, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(2, undefined, undefined, undefined, mockResponse);

      expect(service.list).toHaveBeenCalledWith({ limit: 100, page: 2 });
    });

    it('should filter processes by actor for user', async () => {
      jest.spyOn(service, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, user, undefined, mockResponse);

      expect(service.list).toHaveBeenCalledWith({
        limit: 100,
        page: 1,
        actors: [{ id: '2' }, { role: 'admin' }, { role: 'team' }, { role: 'assistant' }],
      });
    });

    it('should not filter processes by actor for admin user requesting all processes', async () => {
      jest.spyOn(service, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, true, user, undefined, mockResponse);

      expect(service.list).toHaveBeenCalledWith({ limit: 100, page: 1 });
    });

    it('should not allow non-admin users to list all processes', async () => {
      await controller.list(undefined, true, { id: '2', roles: ['team'] } as Account, undefined, mockResponse);

      expect(service.list).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.send).toHaveBeenCalledWith('Not allowed to list all processes');
    });

    it('should filter processes by scenario for API key', async () => {
      jest.spyOn(service, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, undefined, apiKey, mockResponse);

      expect(service.list).toHaveBeenCalledWith({
        limit: 100,
        page: 1,
        scenarios: ['test', 'test2'],
      });
    });

    it('should not filter processes for an API key without process limitations', async () => {
      jest.spyOn(service, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, true, undefined, {} as ApiKey, mockResponse);

      expect(service.list).toHaveBeenCalledWith({ limit: 100, page: 1 });
    });
  });

  describe('get', () => {
    const mockProcess = {
      id: '00000000-0000-0000-0001-000000000001',
      title: 'Test Process',
      scenario: { id: '00000000-0000-0000-0002-000000000001', name: 'test' },
      actors: {
        client: { id: '3' },
        assistant: { role: 'assistant' },
      },
      created: new Date(),
      lastUpdated: new Date(),
    };

    it.each([
      ['admin user', { id: '1', roles: ['admin'], token: '' }, undefined],
      ['user by role', { id: '2', roles: ['assistant'], token: '' }, undefined],
      ['user by id', { id: '3', roles: [], token: '' }, undefined],
      ['API key', undefined, { privileges: ['process:read'] }],
      ['API key with scenario', undefined, { privileges: ['process:read'], processes: [{ scenario: 'test' }] }],
    ])('should return a process for %s', async (_, user, apiKey) => {
      jest.spyOn(service, 'has').mockResolvedValue(true);
      jest.spyOn(service, 'get').mockResolvedValue(mockProcess as any);

      await controller.get('00000000-0000-0000-0001-000000000001', user, apiKey, mockResponse);

      expect(service.has).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(service.get).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcess);
    });

    it('should return 404 if process not found', async () => {
      jest.spyOn(service, 'has').mockResolvedValue(false);

      await controller.get('00000000-0000-0000-0001-000000000001', undefined, undefined, mockResponse);

      expect(service.has).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.send).toHaveBeenCalledWith('Process not found');
    });

    it('should return 403 if user does not have access to process', async () => {
      jest.spyOn(service, 'has').mockResolvedValue(true);
      jest.spyOn(service, 'get').mockResolvedValue(mockProcess as any);

      const user = { id: '99', roles: [], token: '' };

      await controller.get('00000000-0000-0000-0001-000000000001', user, undefined, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });

    it('should return 403 if API key does not have access to process', async () => {
      jest.spyOn(service, 'has').mockResolvedValue(true);
      jest.spyOn(service, 'get').mockResolvedValue(mockProcess as any);

      const apiKey = { processes: [{ scenario: 'foo' }] };

      await controller.get('00000000-0000-0000-0001-000000000001', undefined, apiKey, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });
  });

  describe('start', () => {
    const mockProcess = {
      id: '00000000-0000-0000-0001-000000000001',
      title: 'Test Process',
      scenario: {
        actions: {
          complete: {},
        },
      },
      actors: {
        client: { id: '3' },
      },
      created: new Date(),
      lastUpdated: new Date(),
      current: {
        key: 'initial',
        actions: [
          {
            key: 'complete',
            actor: ['client'],
            responseSchema: {},
          },
        ],
      },
    };

    it('should start a new process', async () => {
      const mockInstructions: StartInstructions = {
        scenario: 'test-scenario',
        actors: {},
      };

      jest.spyOn(validation, 'canInstantiate').mockResolvedValue([]);
      jest.spyOn(service, 'instantiate').mockResolvedValue(mockProcess as any);

      await controller.start(undefined, undefined, undefined, mockInstructions, mockResponse);

      expect(validation.canInstantiate).toHaveBeenCalledWith(mockInstructions);
      expect(service.instantiate).toHaveBeenCalledWith(mockInstructions);
      expect(service.save).toHaveBeenCalledWith(mockProcess);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.header).toHaveBeenCalledWith('Location', `/processes/${mockProcess.id}`);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcess);
    });

    it('should return errors if validation fails', async () => {
      const mockInstructions: StartInstructions = {
        scenario: 'test-scenario',
        actors: {},
      };

      const validationErrors = ['Invalid scenario'];

      jest.spyOn(validation, 'canInstantiate').mockResolvedValue(validationErrors);

      await controller.start(undefined, undefined, undefined, mockInstructions, mockResponse);

      expect(validation.canInstantiate).toHaveBeenCalledWith(mockInstructions);
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(validationErrors);
    });

    it('should start a new process and perform the initial action', async () => {
      const user = { id: '3', roles: [] } as Account;
      const mockInstructions: StartInstructions = {
        scenario: 'test-scenario',
        actors: {
          client: { id: '3' },
        },
        action: 'complete',
      };

      jest.spyOn(validation, 'canInstantiate').mockResolvedValue([]);
      jest.spyOn(service, 'instantiate').mockResolvedValue(mockProcess as any);
      jest.spyOn(service, 'step').mockResolvedValue(mockProcess as any);

      await controller.start(undefined, user, undefined, mockInstructions, mockResponse);

      expect(validation.canInstantiate).toHaveBeenCalledWith(mockInstructions);
      expect(service.instantiate).toHaveBeenCalledWith(mockInstructions);
      expect(service.step).toHaveBeenCalledWith(mockProcess, 'complete', 'client', {});
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.header).toHaveBeenCalledWith('Location', `/processes/${mockProcess.id}`);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcess);
    });
  });
});
