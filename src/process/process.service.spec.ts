// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { ProcessService } from './process.service';
import { Collection, Db } from 'mongodb';
import { ScenarioService } from '../scenario/scenario.service';
import { StartInstructions } from './process.dto';
import { InstantiateEvent } from '@letsflow/core/process';
import { normalize } from '@letsflow/core/scenario';
import { uuid } from '@letsflow/core';
import { from as bsonUUID } from 'uuid-mongodb';
import { NotifyService } from '../notify/notify.service';

describe('ProcessService', () => {
  let service: ProcessService;
  let collection: Collection;
  let scenarios: ScenarioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProcessService,
        ScenarioService,
        { provide: Db, useValue: { collection: jest.fn() } },
        { provide: NotifyService, useValue: { apply: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProcessService>(ProcessService);
    scenarios = module.get<ScenarioService>(ScenarioService);

    collection = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      replaceOne: jest.fn(),
      updateOne: jest.fn(),
    } as any;
    const db = module.get<Db>(Db);
    db.collection = jest.fn().mockReturnValue(collection);

    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('start', () => {
    const scenario = normalize({
      title: 'minimal scenario',
      actions: {
        complete: {},
      },
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });
    const scenarioId = uuid(scenario);

    const instructions: StartInstructions = {
      scenario: scenarioId,
      actors: {
        actor: {
          id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
        },
      },
    };

    it('should start a process', async () => {
      jest.spyOn(scenarios, 'get').mockResolvedValue({ ...scenario, _disabled: false });
      const replaceOne = jest.spyOn(collection, 'replaceOne').mockResolvedValue({} as any);

      const process = await service.start(instructions);

      expect(process.id).toMatch(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
      );
      expect(process.title).toEqual('minimal scenario');
      expect(process.scenario).toEqual(scenario);
      expect(process.actors).toEqual({
        actor: {
          id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
          title: 'actor',
        },
      });
      expect(process.response).toBeUndefined();

      expect(process.current.key).toEqual('initial');
      expect(process.current.actions).toEqual([
        {
          $schema: 'https://specs.letsflow.io/v1.0.0/action',
          actor: ['actor'],
          description: '',
          title: 'complete',
          key: 'complete',
          responseSchema: {},
        },
      ]);
      expect(process.current.timestamp).toBeInstanceOf(Date);

      expect(process.events).toHaveLength(1);
      const event = process.events[0] as InstantiateEvent;
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.timestamp.toISOString()).toEqual(process.current.timestamp.toISOString());
      expect(event.actors).toEqual({
        actor: {
          id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
        },
      });
      expect(event.scenario).toEqual(scenarioId);
      expect(event.id).toEqual(process.id);

      expect(collection.replaceOne).toHaveBeenCalled();

      const { id, scenario: _ignore, ...expected } = process;
      const { _id, scenario: storedScenario, ...stored } = replaceOne.mock.calls[0][1];
      expect(_id).toBeDefined();
      expect(_id.toString()).toEqual(id);
      expect(storedScenario).toBeDefined();
      expect(storedScenario.toString()).toEqual(scenarioId);
      expect(stored).toEqual(expected);
    });

    it('should throw an error if the scenario is disabled', async () => {
      jest.spyOn(scenarios, 'get').mockResolvedValue({ ...scenario, _disabled: true });
      await expect(service.start(instructions)).rejects.toThrowError('Scenario is disabled');
    });
  });

  describe('has', () => {
    it('should return true is the process exists', async () => {
      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';
      const countDocuments = jest.spyOn(collection, 'countDocuments').mockResolvedValue(1);

      const exists = await service.has(processId);
      expect(exists).toBe(true);

      expect(countDocuments).toHaveBeenCalled();
      expect(countDocuments.mock.calls[0][0]._id.toString()).toEqual(processId);
    });

    it("should return false is the process doesn't exist", async () => {
      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';
      const countDocuments = jest.spyOn(collection, 'countDocuments').mockResolvedValue(0);

      const exists = await service.has(processId);
      expect(exists).toBe(false);

      expect(countDocuments).toHaveBeenCalled();
      expect(countDocuments.mock.calls[0][0]._id.toString()).toEqual(processId);
    });
  });

  describe('get', () => {
    it('should return a process', async () => {
      const scenario = normalize({
        title: 'minimal scenario',
        actions: {
          complete: {},
        },
        states: {
          initial: {
            on: 'complete',
            goto: '(done)',
          },
        },
      });
      const scenarioId = uuid(scenario);

      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';
      const processData = {
        title: 'minimal scenario',
        actors: {
          actor: {
            id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
            title: 'actor',
          },
        },
        response: {
          foo: 'bar',
        },
        current: {
          key: 'initial',
          actions: {
            complete: {
              $schema: 'https://specs.letsflow.io/v1.0.0/action',
              actor: ['actor'],
              description: '',
              title: 'complete',
            },
          },
          timestamp: new Date('2020-01-01T00:00:00.000Z'),
        },
        events: [
          {
            id: processId,
            scenario: scenarioId,
            actors: {
              actor: {
                id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
              },
            },
            timestamp: new Date('2020-01-01T00:00:00.000Z'),
          },
        ],
        vars: {
          foo: 'bar',
          amount: 100,
        },
      };
      const processDocument = { _id: bsonUUID(processId), scenario: scenarioId, ...processData };

      jest.spyOn(scenarios, 'get').mockResolvedValue({ ...scenario, _disabled: false });
      const findOne = jest.spyOn(collection, 'findOne').mockResolvedValue(processDocument);

      const process = await service.get(processId);

      expect(process).toEqual({ id: processId, scenario, ...processData });

      expect(scenarios.get).toHaveBeenCalledWith(scenarioId);
      expect(collection.findOne).toHaveBeenCalled();
      expect(findOne.mock.calls[0][0]._id.toString()).toEqual(processId);
    });

    it("should throw an error if the process doesn't exist", async () => {
      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';
      const findOne = jest.spyOn(collection, 'findOne').mockResolvedValue(null);

      await expect(service.get(processId)).rejects.toThrow('Process not found');

      expect(findOne).toHaveBeenCalled();
      expect(findOne.mock.calls[0][0]._id.toString()).toEqual(processId);
    });
  });
});
