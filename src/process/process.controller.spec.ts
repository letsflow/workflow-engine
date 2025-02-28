import { Test, TestingModule } from '@nestjs/testing';
import { ProcessController } from './process.controller';
import { ProcessService } from './process.service';
import { Response } from 'express';
import { StartInstructions } from './process.dto';
import { HttpStatus } from '@nestjs/common';
import { AuthService } from '@/auth/auth.service';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020';
import { ScenarioService } from '@/scenario/scenario.service';
import { Account } from '@/auth';
import { ApiKey } from '@/apikey';
import { instantiate, step } from '@letsflow/core/process';
import { normalize } from '@letsflow/core/scenario';

describe('ProcessController', () => {
  let controller: ProcessController;
  let processService: jest.Mocked<ProcessService>;
  let scenarioService: jest.Mocked<ScenarioService>;
  let authService: jest.Mocked<AuthService>;

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
            isActor: jest.fn(),
            determineActor: jest.fn(),
          },
        },
        {
          provide: ScenarioService,
          useValue: {
            list: jest.fn(),
            getIds: jest.fn(),
            has: jest.fn(),
            get: jest.fn(),
            getStatus: jest.fn(),
          },
        },
        {
          provide: Ajv,
          useValue: new Ajv2020(),
        },
        {
          provide: AuthService,
          useValue: {
            validateJwt: jest.fn(),
            validateApiKey: jest.fn(),
            hasPrivilege: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    controller = module.get(ProcessController);
    processService = module.get<jest.Mocked<ProcessService>>(ProcessService);
    scenarioService = module.get<jest.Mocked<ScenarioService>>(ScenarioService);
    authService = module.get<jest.Mocked<AuthService>>(AuthService);
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
    const apiKey = { service: 'system' } as ApiKey;

    it('should return a list of processes', async () => {
      jest.spyOn(processService, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, undefined, undefined, undefined, mockResponse);

      expect(processService.list).toHaveBeenCalledWith({}, { limit: 100, page: 1 });
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcesses);
    });

    it('should return page 2', async () => {
      jest.spyOn(processService, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(2, undefined, undefined, undefined, undefined, mockResponse);

      expect(processService.list).toHaveBeenCalledWith({}, { limit: 100, page: 2 });
    });

    it('should filter processes by actor for user', async () => {
      jest.spyOn(processService, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, undefined, user, undefined, mockResponse);

      expect(processService.list).toHaveBeenCalledWith(
        { actors: [{ id: '2' }, { role: 'admin' }, { role: 'team' }, { role: 'assistant' }] },
        { limit: 100, page: 1 },
      );
    });

    it('should not filter processes by actor for admin user requesting all processes', async () => {
      jest.spyOn(processService, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, true, user, undefined, mockResponse);

      expect(processService.list).toHaveBeenCalledWith({}, { limit: 100, page: 1 });
    });

    it('should not allow user with super privileges to list all processes', async () => {
      authService.hasPrivilege.mockReturnValue(false);

      await controller.list(
        undefined,
        undefined,
        true,
        {
          id: '2',
          roles: ['team'],
        } as Account,
        undefined,
        mockResponse,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
      expect(mockResponse.send).toHaveBeenCalledWith('Not allowed to list all processes');

      expect(authService.hasPrivilege).toBeCalledWith({ id: '2', roles: ['team'] }, 'process:super');
      expect(processService.list).not.toHaveBeenCalled();
    });

    it('should filter processes by scenario for API key', async () => {
      jest.spyOn(processService, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, undefined, undefined, apiKey, mockResponse);

      expect(processService.list).toHaveBeenCalledWith({ service: 'system' }, { limit: 100, page: 1 });
    });

    it('should not filter processes for an API key without process limitations', async () => {
      jest.spyOn(processService, 'list').mockResolvedValue(mockProcesses as any);

      await controller.list(undefined, undefined, true, undefined, {} as ApiKey, mockResponse);

      expect(processService.list).toHaveBeenCalledWith({}, { limit: 100, page: 1 });
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
      current: {
        key: 'foo',
        actions: [
          {
            key: 'generate',
            actor: ['service:system'],
          },
        ],
      },
      created: new Date(),
      lastUpdated: new Date(),
    };

    it.each([
      ['admin user', { id: '1', roles: ['admin'], token: '' }, undefined],
      ['user by role', { id: '2', roles: ['assistant'], token: '' }, undefined],
      ['user by id', { id: '3', roles: [], token: '' }, undefined],
      ['API key of service', undefined, { privileges: ['process:read'], service: 'system' }],
      ['API key with super privs', undefined, { privileges: ['process:read', 'process:super'] }],
    ])('should return a process for %s', async (_, user, apiKey) => {
      processService.has.mockResolvedValue(true);
      processService.get.mockResolvedValue(mockProcess as any);

      await controller.get('00000000-0000-0000-0001-000000000001', user, apiKey, false, mockResponse);

      expect(processService.has).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(processService.get).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProcess);
    });

    it('should return 404 if process not found', async () => {
      processService.has.mockResolvedValue(false);

      await controller.get('00000000-0000-0000-0001-000000000001', undefined, undefined, false, mockResponse);

      expect(processService.has).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.send).toHaveBeenCalledWith('Process not found');
    });

    it('should return 403 if user does not have access to process', async () => {
      processService.has.mockResolvedValue(true);
      processService.get.mockResolvedValue(mockProcess as any);
      processService.isActor.mockReturnValue(false);
      authService.hasPrivilege.mockReturnValue(false);

      const user = { id: '99', roles: [], token: '', info: {} };
      await controller.get('00000000-0000-0000-0001-000000000001', user, undefined, false, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);

      expect(processService.has).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');
      expect(processService.get).toHaveBeenCalledWith('00000000-0000-0000-0001-000000000001');

      expect(authService.hasPrivilege).toHaveBeenCalledWith(user, 'process:super');
      expect(processService.isActor).toHaveBeenCalledWith(mockProcess, user);
    });

    it('should return 403 if API key does not have access to process', async () => {
      processService.has.mockResolvedValue(true);
      processService.get.mockResolvedValue(mockProcess as any);

      const apiKey = { processes: [{ scenario: 'foo' }], privileges: [] };

      await controller.get('00000000-0000-0000-0001-000000000001', undefined, apiKey, false, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    });
  });

  describe('start', () => {
    const scenario = normalize({
      id: '00000000-0000-0000-0002-000000000001',
      name: 'test',
      actors: {
        client: { role: 'client' },
      },
      actions: {
        init: {
          update: 'result',
        },
      },
      states: {
        initial: {
          on: 'init',
          goto: 'main',
        },
        main: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });

    const process = instantiate(scenario);

    const user: Account = { id: '3', roles: ['client'], info: { name: 'John Doe' }, token: '' };
    const actor = { key: 'client', id: '3', roles: ['client'], name: 'John Doe' };

    beforeEach(() => {
      scenarioService.getStatus.mockResolvedValue('available');
      scenarioService.get.mockResolvedValue(scenario);
      processService.determineActor.mockReturnValue(actor);
      processService.instantiate.mockReturnValue(process);
    });

    it('should start a new process', async () => {
      const mockInstructions: StartInstructions = {
        scenario: 'test-scenario',
        action: 'init',
      };

      const steppedProcess = step(process, 'init', actor);
      processService.step.mockResolvedValue(steppedProcess);

      await controller.start(undefined, user, undefined, false, mockInstructions, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.header).toHaveBeenCalledWith('Location', `/processes/${process.id}`);
      expect(mockResponse.json).toHaveBeenCalledWith(steppedProcess);

      expect(processService.instantiate).toHaveBeenCalledWith(scenario);
      expect(processService.step).toBeCalledWith(process, 'init', actor, undefined);
    });

    it('should start a new process with initial response', async () => {
      const user = { id: '3', roles: [] } as Account;
      const mockInstructions: StartInstructions = {
        scenario: 'test-scenario',
        action: {
          key: 'init',
          response: 'hello',
        },
      };

      const steppedProcess = step(process, 'init', actor, 'hello');
      processService.step.mockResolvedValue(steppedProcess);

      await controller.start(undefined, user, undefined, false, mockInstructions, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(mockResponse.header).toHaveBeenCalledWith('Location', `/processes/${process.id}`);
      expect(mockResponse.json).toHaveBeenCalledWith(steppedProcess);

      expect(processService.instantiate).toHaveBeenCalledWith(scenario);
      expect(processService.step).toBeCalledWith(process, 'init', actor, 'hello');
    });

    it('should return errors if validation fails', async () => {
      const mockInstructions: StartInstructions = {
        scenario: 'test-scenario',
        action: 'wrongAction',
      };

      const steppedProcess = step(process, 'wrongAction', actor, {});
      processService.step.mockResolvedValue(steppedProcess);

      await controller.start(undefined, user, undefined, false, mockInstructions, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: { message: 'Failed to execute action', reason: (steppedProcess.events[1] as any).errors },
      });
    });
  });
});
