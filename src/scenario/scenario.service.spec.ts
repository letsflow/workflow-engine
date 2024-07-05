import { Test, TestingModule } from '@nestjs/testing';
import { Collection, Db } from 'mongodb';
import { from as bsonUUID } from 'uuid-mongodb';
import { ScenarioService, ScenarioDocument } from './scenario.service';
import { uuid } from '@letsflow/core';
import { normalize, Scenario } from '@letsflow/core/scenario';
import { ConfigModule } from '../common/config/config.module';

describe('ScenarioService', () => {
  let module: TestingModule;
  let service: ScenarioService;
  let db: Db;
  let collection: Collection<ScenarioDocument>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [ConfigModule],
      providers: [ScenarioService, { provide: Db, useValue: { collection: jest.fn() } }],
    }).compile();

    service = module.get<ScenarioService>(ScenarioService);
    db = module.get<Db>(Db);
    collection = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
    } as any;

    (db.collection as jest.Mock).mockReturnValue(collection);

    jest.spyOn(db, 'collection').mockImplementation(() => collection as Collection<any>);

    await module.init();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await module.close();
  });

  describe('list()', () => {
    const mockScenarios = [
      {
        _id: bsonUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8'),
        title: 'Scenario 1',
        description: 'Description 1',
      },
      {
        _id: bsonUUID('dad815c8-95c8-4f41-bf0d-3d3d41654a22'),
        title: 'Scenario 2',
        description: 'Description 2',
      },
    ];

    it('should retrieve a list of scenarios', async () => {
      jest.spyOn(collection, 'find').mockReturnValue({
        map: jest.fn().mockImplementation((fn) => ({ toArray: () => mockScenarios.map(fn) })),
      } as any);

      const scenarioSummaries = await service.list();

      expect(collection.find).toHaveBeenCalledWith(
        { _disabled: false },
        { sort: { title: 1 }, projection: { _id: 1, title: 1, description: 1, extraScenarioField: 1 } },
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
      const countDocumentsMock = jest.spyOn(collection, 'countDocuments').mockResolvedValueOnce(count);

      const exists = await service.has(id);

      expect(collection.countDocuments).toHaveBeenCalled();
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

      const findOneMock = jest.spyOn(collection, 'findOne').mockResolvedValueOnce(mockScenario);

      const scenario = await service.get(id);

      expect(collection.findOne).toHaveBeenCalled();
      expect(findOneMock.mock.calls[0][0]._id.toString()).toBe(id);

      expect(scenario).toEqual(mockScenario);
    });

    it('should throw an exception for a non-existing scenario', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      jest.spyOn(collection, 'findOne').mockResolvedValueOnce(null);

      await expect(service.get(id)).rejects.toThrowError(new Error(`Scenario not found`));
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
      jest.spyOn(collection, 'countDocuments').mockResolvedValueOnce(0);
      const insertOneMock = jest.spyOn(collection, 'insertOne').mockResolvedValueOnce({} as any);

      const normalized = normalize(scenario);
      const id = uuid(normalized);

      const returnedId = await service.store(scenario);

      expect(returnedId).toBe(id);

      expect(collection.insertOne).toHaveBeenCalled();

      const { _id: insertedId, ...insertedScenario } = insertOneMock.mock.calls[0][0];
      expect(insertedId.toString()).toEqual(id);
      expect(insertedScenario).toEqual({ ...normalized, _disabled: false });
    });

    it('should enable a scenario', async () => {
      jest.spyOn(collection, 'countDocuments').mockResolvedValueOnce(1);
      const updateOneMock = jest.spyOn(collection, 'updateOne').mockResolvedValueOnce({} as any);

      const normalized = normalize(scenario);
      const id = uuid(normalized);

      const returnedId = await service.store(scenario);

      expect(returnedId).toBe(id);

      expect(collection.updateOne).toHaveBeenCalled();
      expect(updateOneMock.mock.calls[0][0]._id.toString()).toEqual(bsonUUID(id).toString());
      expect(updateOneMock.mock.calls[0][1]).toEqual({ $set: { _disabled: false } });
    });
  });

  describe('disable()', () => {
    it('should disable a scenario', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      const updateOneMock = jest.spyOn(collection, 'updateOne').mockResolvedValueOnce({
        matchedCount: 1,
      } as any);

      await service.disable(id);

      expect(collection.updateOne).toHaveBeenCalled();
      expect(updateOneMock.mock.calls[0][0]._id.toString()).toBe(id);
    });

    it('should throw an exception for a non-existing scenario', async () => {
      const id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

      jest.spyOn(collection, 'updateOne').mockResolvedValueOnce({ matchedCount: 0 } as any);

      await expect(service.disable(id)).rejects.toThrowError(new Error(`Scenario not found`));
    });
  });
});
