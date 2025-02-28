// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { ProcessService } from './process.service';
import { Collection, Db } from 'mongodb';
import { ScenarioService } from '@/scenario/scenario.service';
import { instantiate, InstantiateEvent, step } from '@letsflow/core/process';
import { normalize } from '@letsflow/core/scenario';
import { uuid } from '@letsflow/core';
import { from as bsonUUID, MUUID } from 'uuid-mongodb';
import { NotifyService } from '@/notify/notify.service';
import { ConfigModule } from '@/common/config/config.module';
import { ScenarioDbService } from '@/scenario/scenario-db/scenario-db.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

function normalizeBsonUUID(process: { _id: MUUID; scenario: MUUID; [_: string]: any }) {
  const { _id: id, scenario, ...rest } = process;

  return {
    _id: id.toString(),
    scenario: scenario.toString(),
    ...rest,
  };
}

describe('ProcessService', () => {
  let module: TestingModule;
  let service: ProcessService;
  let collection: jest.Mocked<Collection>;
  let scenarios: jest.Mocked<ScenarioService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [
        ProcessService,
        { provide: ScenarioService, useClass: ScenarioDbService },
        { provide: Db, useValue: { collection: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: NotifyService, useValue: { apply: jest.fn() } },
      ],
    }).compile();

    service = module.get(ProcessService);
    scenarios = module.get(ScenarioService);
    eventEmitter = module.get(EventEmitter2);

    collection = {
      findOne: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
      countDocuments: jest.fn(),
      replaceOne: jest.fn(),
      updateOne: jest.fn(),
    } as any;
    const db = module.get<Db>(Db);
    db.collection = jest.fn().mockReturnValue(collection);

    await module.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('list', () => {
    const mockProcesses = [
      {
        _id: bsonUUID('096a8bc3-61bd-4eb1-8997-9b72058468b8'),
        title: 'Process 1',
        scenario: {
          _id: bsonUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
          title: 'Scenario 1',
          description: 'Description 1',
        },
        actors: [
          {
            id: 'a001',
            title: 'actor 1',
            name: 'Albert',
          },
          {
            id: 'a002',
            title: 'actor 2',
            name: 'Betty',
          },
        ],
      },
      {
        _id: bsonUUID('107f9982-bf33-4e0b-b627-5b3e0abf551a'),
        title: 'Process 2',
        scenario: {
          _id: bsonUUID('dad815c8-95c8-4f41-bf0d-3d3d41654a22'),
          title: 'Scenario 2',
          description: 'Description 2',
        },
        actors: [
          {
            title: 'actor',
          },
        ],
      },
    ];

    it('should retrieve a list of processes', async () => {
      jest.spyOn(collection, 'aggregate').mockReturnValue({
        map: jest.fn().mockImplementation((fn) => ({ toArray: () => mockProcesses.map(fn) })),
      } as any);

      const scenarioSummaries = await service.list();

      expect(collection.aggregate).toHaveBeenCalled();
      expect(scenarioSummaries).toEqual([
        {
          id: '096a8bc3-61bd-4eb1-8997-9b72058468b8',
          title: 'Process 1',
          scenario: {
            id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
            title: 'Scenario 1',
            description: 'Description 1',
          },
          actors: [
            {
              id: 'a001',
              title: 'actor 1',
              name: 'Albert',
            },
            {
              id: 'a002',
              title: 'actor 2',
              name: 'Betty',
            },
          ],
        },
        {
          id: '107f9982-bf33-4e0b-b627-5b3e0abf551a',
          title: 'Process 2',
          scenario: {
            id: 'dad815c8-95c8-4f41-bf0d-3d3d41654a22',
            title: 'Scenario 2',
            description: 'Description 2',
          },
          actors: [
            {
              title: 'actor',
            },
          ],
        },
      ]);
    });
  });

  describe('save', () => {
    const scenario = normalize({
      actions: {
        start: {
          update: [
            { set: 'vars.foo', value: 'bar' },
            { set: 'vars.amount', value: 100 },
            { set: 'actors.actor.title', value: 'Participant' },
          ],
        },
      },
      states: {
        initial: {
          on: 'start',
          goto: 'main',
        },
        main: {
          on: 'complete',
          goto: '(done)',
        },
      },
      vars: {
        foo: 'string',
        amount: 'number',
      },
    });
    const process = step(instantiate(scenario), 'start');

    it('should save a process', async () => {
      await service.save(process);

      expect(collection.replaceOne).toHaveBeenCalled();
      expect(collection.replaceOne.mock.calls[0][0]._id.toString()).toEqual(process.id);
      const stored = collection.replaceOne.mock.calls[0][1];

      expect(stored._id.toString()).toEqual(process.id);
      expect(stored.scenario.toString()).toEqual(process.scenario.id);
      expect(stored.actors).toEqual([
        {
          _key: 'actor',
          title: 'Participant',
        },
      ]);
      expect(stored.current).toEqual(process.current);
      expect(stored.vars).toEqual(process.vars);
      expect(stored.result).toEqual(process.result);
    });
  });

  describe('instantiate', () => {
    const scenario = normalize({
      title: 'simple workflow',
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });
    const scenarioId = uuid(scenario);

    it('should instantiate a process', async () => {
      jest.spyOn(scenarios, 'get').mockResolvedValue({ id: scenarioId, ...scenario, _disabled: false });
      const process = await service.instantiate(scenario);

      expect(process.id).toMatch(
        /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/,
      );
      expect(process.title).toEqual('simple workflow');
      expect(process.scenario).toEqual({ id: scenarioId, ...scenario });
      expect(process.current.response).toBeUndefined();

      expect(process.current.key).toEqual('initial');
      expect(process.current.actions).toEqual([
        {
          $schema: 'https://schemas.letsflow.io/v1.0/action',
          actor: ['actor'],
          description: '',
          title: 'complete',
          key: 'complete',
          if: true,
          response: {},
        },
      ]);
      expect(process.current.timestamp).toBeInstanceOf(Date);

      expect(process.events).toHaveLength(1);
      const event = process.events[0] as InstantiateEvent;
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.timestamp.toISOString()).toEqual(process.current.timestamp.toISOString());
      expect(event.scenario).toEqual(scenarioId);
      expect(event.id).toEqual(process.id);
    });
  });

  describe('has', () => {
    it('should return true is the process exists', async () => {
      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';
      collection.countDocuments.mockResolvedValue(1);

      const exists = await service.has(processId);
      expect(exists).toBe(true);

      expect(collection.countDocuments).toHaveBeenCalled();
      expect(collection.countDocuments.mock.calls[0][0]._id.toString()).toEqual(processId);
    });

    it("should return false is the process doesn't exist", async () => {
      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';

      const exists = await service.has(processId);
      expect(exists).toBe(false);

      expect(collection.countDocuments).toHaveBeenCalled();
      expect(collection.countDocuments.mock.calls[0][0]._id.toString()).toEqual(processId);
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
        tags: ['important'],
        actors: [
          {
            _key: 'actor',
            id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
            title: 'actor',
          },
        ],
        response: {
          foo: 'bar',
        },
        current: {
          key: 'initial',
          actions: {
            complete: {
              $schema: 'https://schemas.letsflow.io/v1.0/action',
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
      const processDocument = { _id: bsonUUID(processId), scenario: bsonUUID(scenarioId), ...processData };

      jest.spyOn(scenarios, 'get').mockResolvedValue({ ...scenario, _disabled: false });
      collection.findOne.mockResolvedValue(processDocument);

      const process = await service.get(processId);

      expect(process.id).toEqual(processId);
      expect(process.scenario).toEqual({ id: scenarioId, ...scenario });
      expect(process.actors).toEqual({
        actor: {
          id: '76361a70-2bbe-4d11-b2b8-8aecbc5f0224',
          title: 'actor',
        },
      });
      expect(process.vars).toEqual({
        foo: 'bar',
        amount: 100,
      });
      expect(process.current).toEqual({
        key: 'initial',
        actions: {
          complete: {
            $schema: 'https://schemas.letsflow.io/v1.0/action',
            actor: ['actor'],
            description: '',
            title: 'complete',
          },
        },
        timestamp: new Date('2020-01-01T00:00:00.000Z'),
      });

      expect(scenarios.get).toHaveBeenCalledWith(scenarioId);
      expect(collection.findOne).toHaveBeenCalled();
      expect(collection.findOne.mock.calls[0][0]._id.toString()).toEqual(processId);
    });

    it("should throw an error if the process doesn't exist", async () => {
      const processId = 'b2d39a1f-88bb-450e-95c5-feeffe95abe6';

      await expect(service.get(processId)).rejects.toThrow('Process not found');

      expect(collection.findOne).toHaveBeenCalled();
      expect(collection.findOne.mock.calls[0][0]._id.toString()).toEqual(processId);
    });
  });

  describe('save', () => {
    const scenario = normalize({
      title: 'simple workflow',
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
      },
    });
    const scenarioId = uuid(scenario);

    const process = instantiate(scenario);
    const { id: processId, scenario: _, actors, ...rest } = process;

    const doc = {
      _id: bsonUUID(processId),
      scenario: bsonUUID(scenarioId),
      actors: Object.entries(actors).map(([key, actor]) => ({ _key: key, ...actor })),
      ...rest,
    };

    it('should save a process', async () => {
      await service.save(process);

      expect(collection.replaceOne).toHaveBeenCalled();
      expect(collection.replaceOne.mock.calls[0][0]._id.toString()).toEqual(processId);
      expect(normalizeBsonUUID(collection.replaceOne.mock.calls[0][1] as any)).toEqual(normalizeBsonUUID(doc));
    });
  });

  describe('step', () => {
    const scenario = normalize({
      title: 'simple workflow',
      states: {
        initial: {
          on: 'complete',
          goto: '(done)',
        },
        done: {},
      },
    });

    it('should step through a process', async () => {
      const save = jest.spyOn(service, 'save');
      const process = instantiate(scenario);

      const updatedProcess = await service.step(process, 'complete', { key: 'actor' });

      expect(updatedProcess.id).toEqual(process.id);
      expect(updatedProcess.current.key).toEqual('(done)');

      expect(save).toHaveBeenCalledWith(updatedProcess);
      expect(eventEmitter.emit).toBeCalledWith('process.stepped', updatedProcess);
    });
  });
});
