import { Test, TestingModule } from '@nestjs/testing';
import { Collection, Db } from 'mongodb';
import { from as bsonUUID } from 'uuid-mongodb';
import { ScenarioService, ScenarioDocument } from './scenario.service';
import { normalize, Scenario, uuid } from '@letsflow/api';

describe('ScenarioService', () => {
  let scenarioService: ScenarioService;
  let db: Db;
  let scenariosCollection: Collection<ScenarioDocument>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScenarioService, { provide: Db, useValue: { collection: jest.fn() } }],
    }).compile();

    scenarioService = module.get<ScenarioService>(ScenarioService);
    db = module.get<Db>(Db);
    scenariosCollection = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
    } as any;

    (db.collection as jest.Mock).mockReturnValue(scenariosCollection);

    jest.spyOn(db, 'collection').mockImplementation(() => scenariosCollection as Collection<any>);

    await module.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('list()', () => {
    const mockScenarios = [
      {
        _id: bsonUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: 'Scenario 1',
        description: 'Description 1',
      },
      {
        _id: bsonUUID('dad815c8-95c8-4f41-bf0d-3d3d41654a22'),
        $schema: 'https://schemas.letsflow.io/v1.0.0/scenario',
        title: 'Scenario 2',
        description: 'Description 2',
      },
    ];

    it('should retrieve a list of scenarios', async () => {
      jest
        .spyOn(scenariosCollection, 'find')
        .mockReturnValue({ toArray: jest.fn().mockResolvedValue(mockScenarios) } as any);

      const scenarioSummaries = await scenarioService.list();

      expect(scenariosCollection.find).toHaveBeenCalledWith(
        { _disabled: false },
        { sort: { title: 1 }, projection: { _id: 1, title: 1, description: 1 } },
      );
      expect(scenarioSummaries).toEqual([
        {
          id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          title: 'Scenario 1',
          description: 'Description 1',
        },
        {
          id: 'dad815c8-95c8-4f41-bf0d-3d3d41654a22',
          title: 'Scenario 2',
          description: 'Description 2',
        },
      ]);
    });
  });

  describe('has()', () => {
    it.each([0, 1])('should check if a scenario exists', async (count) => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const countDocumentsMock = jest.spyOn(scenariosCollection, 'countDocuments').mockResolvedValueOnce(count);

      const exists = await scenarioService.has(id);

      expect(scenariosCollection.countDocuments).toHaveBeenCalled();
      expect(countDocumentsMock.mock.calls[0][0]._id.toString()).toBe(id);

      expect(exists).toBe(count > 0);
    });
  });

  describe('get()', () => {
    it('should retrieve a scenario by ID', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      const mockScenario = {
        _id: bsonUUID(id),
        title: 'Scenario 1',
        description: 'Description 1',
      };

      const findOneMock = jest.spyOn(scenariosCollection, 'findOne').mockResolvedValueOnce(mockScenario);

      const scenario = await scenarioService.get(id);

      expect(scenariosCollection.findOne).toHaveBeenCalled();
      expect(findOneMock.mock.calls[0][0]._id.toString()).toBe(id);

      expect(scenario).toEqual(mockScenario);
    });

    it('should throw an exception for a non-existing scenario', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      jest.spyOn(scenariosCollection, 'findOne').mockResolvedValueOnce(null);

      await expect(scenarioService.get(id)).rejects.toThrowError(new Error(`Scenario not found`));
    });
  });

  describe('store()', () => {
    const scenario: Scenario = {
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
    };

    it('should store a scenario', async () => {
      jest.spyOn(scenariosCollection, 'countDocuments').mockResolvedValueOnce(0);
      const insertOneMock = jest.spyOn(scenariosCollection, 'insertOne').mockResolvedValueOnce({} as any);

      const normalized = normalize(scenario);
      const id = uuid(normalized);

      const returnedId = await scenarioService.store(scenario);

      expect(returnedId).toBe(id);

      expect(scenariosCollection.insertOne).toHaveBeenCalled();

      const { _id: insertedId, ...insertedScenario } = insertOneMock.mock.calls[0][0];
      expect(insertedId.toString()).toEqual(id);
      expect(insertedScenario).toEqual({ ...normalized, _disabled: false });
    });

    it('should enable a scenario', async () => {
      jest.spyOn(scenariosCollection, 'countDocuments').mockResolvedValueOnce(1);
      const updateOneMock = jest.spyOn(scenariosCollection, 'updateOne').mockResolvedValueOnce({} as any);

      const normalized = normalize(scenario);
      const id = uuid(normalized);

      const returnedId = await scenarioService.store(scenario);

      expect(returnedId).toBe(id);

      expect(scenariosCollection.updateOne).toHaveBeenCalled();
      expect(updateOneMock.mock.calls[0][0]._id.toString()).toEqual(bsonUUID(id).toString());
      expect(updateOneMock.mock.calls[0][1]).toEqual({ $set: { _disabled: false } });
    });
  });

  describe('disable()', () => {
    it('should disable a scenario', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      const updateOneMock = jest.spyOn(scenariosCollection, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
      } as any);

      await scenarioService.disable(id);

      expect(scenariosCollection.updateOne).toHaveBeenCalled();
      expect(updateOneMock.mock.calls[0][0]._id.toString()).toBe(id);
    });

    it('should throw an exception for a non-existing scenario', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      jest.spyOn(scenariosCollection, 'updateOne').mockResolvedValueOnce({ matchedCount: 0 } as any);

      await expect(scenarioService.disable(id)).rejects.toThrowError(new Error(`Scenario not found`));
    });
  });
});
