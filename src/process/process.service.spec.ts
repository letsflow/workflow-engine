import { Test, TestingModule } from '@nestjs/testing';
import { ProcessService } from './process.service';
import { Collection, Db } from 'mongodb';
import { ScenarioService } from '../scenario/scenario.service';
import { StartInstructions } from './process.dto';
import { InstantiateEvent } from '@letsflow/api/process';
import { normalize } from '@letsflow/api/scenario';
import { uuid } from '@letsflow/api';

describe('ProcessService', () => {
  let service: ProcessService;
  let collection: Collection;
  let scenarios: ScenarioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProcessService, ScenarioService, { provide: Db, useValue: { collection: jest.fn() } }],
    }).compile();

    service = module.get<ProcessService>(ProcessService);
    scenarios = module.get<ScenarioService>(ScenarioService);

    collection = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
    } as any;
    const db = module.get<Db>(Db);
    db.collection = jest.fn().mockResolvedValue(collection);

    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should start a process', async () => {
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

    jest.spyOn(scenarios, 'get').mockResolvedValue({ ...scenario, _disabled: false });
    const insertOne = jest.spyOn(collection, 'insertOne').mockResolvedValue({} as any);

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
    expect(process.current.actions).toEqual({
      complete: {
        $schema: 'https://specs.letsflow.io/v1.0.0/action',
        actor: ['actor'],
        description: '',
        title: 'complete',
      },
    });
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

    expect(collection.insertOne).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, scenario: _ignore, ...expected } = process;
    const { _id, scenario: storedScenario, ...stored } = insertOne.mock.calls[0][0];
    expect(_id.toString()).toEqual(id);
    expect(storedScenario.toString()).toEqual(scenarioId);
    expect(stored).toEqual(expected);
  });

  /*
  it('should return process existence', async () => {
    const processId = '12345';

    jest.spyOn(collection, 'countDocuments').mockResolvedValue(1);

    const exists = await service.has(processId);

    expect(exists).toBe(true);
  });

  it('should return a process', async () => {
    const processId = '12345';

    const processDocument = { /* mock process document data  };

    jest.spyOn(collection, 'findOne').mockResolvedValue(processDocument);

    const normalizedScenario: NormalizedScenario = { /* mock normalized scenario data  };

    jest.spyOn(scenarios, 'get').mockResolvedValue(normalizedScenario);

    const process = await service.get(processId);

    expect(process).toEqual({ id: processId, scenario: normalizedScenario, ...processDocument });
  });*/

  // Continue writing tests for other methods as per your requirements.
});
