import { Test, TestingModule } from '@nestjs/testing';
import { ScenarioDbService } from './scenario-db.service';
import { Db } from 'mongodb';
import { ConfigService } from '@/common/config/config.service';

let normalizeMock = jest.fn();
let uuidMock = jest.fn();

jest.mock('@letsflow/core/scenario', () => ({
  normalize: (...args: any[]) => normalizeMock(...args),
}));

jest.mock('@letsflow/core', () => ({
  uuid: (...args: any[]) => uuidMock(...args),
}));

describe('ScenarioDbService', () => {
  let service: ScenarioDbService;
  const configGet = jest.fn();

  // Db & collection mocks
  const countDocuments = jest.fn();
  const find = jest.fn();
  const findOne = jest.fn();
  const insertOne = jest.fn();
  const updateOne = jest.fn();
  const collection = jest.fn(() => ({ find, findOne, insertOne, updateOne, countDocuments }));

  beforeEach(async () => {
    jest.clearAllMocks();

    normalizeMock = jest.fn((obj: any) => obj);
    uuidMock = jest.fn((obj: any) => {
      if (obj?.name === 'x') return '550e8400-e29b-41d4-a716-446655440000';
      if (obj?.name === 'y') return '550e8400-e29b-41d4-a716-446655440001';
      return '550e8400-e29b-41d4-a716-446655440002';
    });

    configGet.mockImplementation((key: string) => {
      if (key === 'scenario.readOnly') return false;
      if (key === 'scenario.summeryFields') return ['name'];
      return undefined;
    });

    // default cursor behavior for find
    find.mockImplementation((query: any, options: any) => {
      // default to empty
      const docs: any[] = [];
      return {
        map: (mapper: any) => ({ toArray: async () => docs.map(mapper) }),
      } as any;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScenarioDbService,
        { provide: ConfigService, useValue: { get: configGet } },
        { provide: Db, useValue: { collection } as any },
      ],
    }).compile();

    service = module.get<ScenarioDbService>(ScenarioDbService);
    service.onModuleInit();
  });

  it('onModuleInit sets projection and collection', () => {
    expect(service['isReadOnly']).toBe(false);
    expect(service['summeryProjection']).toEqual({ _id: 1, title: 1, description: 1, tags: 1, name: 1 });
  });

  it('list returns projected summaries sorted by title (mapping _id to id)', async () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001'];
    find.mockImplementation(() => ({
      map: (mapper: any) => ({
        toArray: async () =>
          [
            { _id: { toString: () => ids[0] }, title: 'A', description: 'd1', tags: [], name: 'n1' },
            { _id: { toString: () => ids[1] }, title: 'B', description: 'd2', tags: [], name: 'n2' },
          ].map(mapper),
      }),
    }));

    const res = await service.list();
    expect(res).toEqual([
      { id: ids[0], title: 'A', description: 'd1', tags: [], name: 'n1' },
      { id: ids[1], title: 'B', description: 'd2', tags: [], name: 'n2' },
    ]);
  });

  it('getIds returns IDs for UUIDs and names', async () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440000'];
    find.mockImplementation(() => ({
      map: (mapper: any) => ({ toArray: async () => [{ _id: { toString: () => ids[0] } }].map(mapper) }),
    }));

    const res = await service.getIds(['550e8400-e29b-41d4-a716-446655440000', 'my-scenario']);
    expect(res).toEqual(ids);
  });

  it('has returns false for invalid UUID without querying DB', async () => {
    const calls = (service as any)['db'].collection?.mock?.calls?.length ?? collection.mock.calls.length;
    await expect(service.has('not-a-uuid')).resolves.toBe(false);
    const after = (service as any)['db'].collection?.mock?.calls?.length ?? collection.mock.calls.length;
    expect(after).toBe(calls); // no extra calls for invalid UUID
  });

  it('has queries DB for valid UUID and returns boolean', async () => {
    countDocuments.mockResolvedValueOnce(1);
    await expect(service.has('550e8400-e29b-41d4-a716-446655440000')).resolves.toBe(true);
    countDocuments.mockResolvedValueOnce(0);
    await expect(service.has('550e8400-e29b-41d4-a716-446655440000')).resolves.toBe(false);
  });

  it('getStatus returns not-found for invalid; disabled or available otherwise', async () => {
    await expect(service.getStatus('bad')).resolves.toBe('not-found');
    findOne.mockResolvedValueOnce({ _disabled: true });
    await expect(service.getStatus('550e8400-e29b-41d4-a716-446655440000')).resolves.toBe('disabled');
    findOne.mockResolvedValueOnce({ _disabled: false });
    await expect(service.getStatus('550e8400-e29b-41d4-a716-446655440000')).resolves.toBe('available');
  });

  it('get throws on invalid ID; throws if not found; returns document otherwise', async () => {
    await expect(service.get('oops')).rejects.toThrow('Invalid scenario ID');
    findOne.mockResolvedValueOnce(null);
    await expect(service.get('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow('Scenario not found');
    const doc = { a: 1, _disabled: false } as any;
    findOne.mockResolvedValueOnce(doc);
    await expect(service.get('550e8400-e29b-41d4-a716-446655440000')).resolves.toBe(doc);
  });

  it('store updates existing scenario by enabling it; otherwise inserts new', async () => {
    // existing
    (service as any).has = jest.fn().mockResolvedValueOnce(true);
    updateOne.mockResolvedValueOnce({} as any);
    const id1 = await service.store({ name: 'x' } as any);
    expect(id1).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(updateOne).toHaveBeenCalledWith(expect.any(Object), { $set: { _disabled: false } });

    // new
    (service as any).has = jest.fn().mockResolvedValueOnce(false);
    insertOne.mockResolvedValueOnce({} as any);
    const id2 = await service.store({ name: 'y' } as any);
    expect(id2).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(insertOne).toHaveBeenCalledWith(expect.objectContaining({ _disabled: false }));
  });

  it('disable throws on invalid; throws if not found; otherwise succeeds', async () => {
    await expect(service.disable('nope')).rejects.toThrow('Invalid scenario ID');
    updateOne.mockResolvedValueOnce({ matchedCount: 0 } as any);
    await expect(service.disable('550e8400-e29b-41d4-a716-446655440000')).rejects.toThrow('Scenario not found');
    updateOne.mockResolvedValueOnce({ matchedCount: 1 } as any);
    await expect(service.disable('550e8400-e29b-41d4-a716-446655440000')).resolves.toBeUndefined();
  });
});
