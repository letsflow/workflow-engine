import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyService } from './apikey.service';
import { Collection, Db, Document, ObjectId, UpdateFilter } from 'mongodb';
import { ApiKey } from './apikey.dto';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let collection: jest.Mocked<Collection>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiKeyService, { provide: Db, useValue: { collection: jest.fn() } }],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);

    collection = {
      findOne: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      insertOne: jest.fn(),
      updateOne: jest.fn(),
    } as any;

    const db = module.get<jest.Mocked<Db>>(Db);
    db.collection.mockReturnValue(collection);

    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('issue()', () => {
    it('should issue a new api key', async () => {
      const apiKey: Partial<ApiKey> = {
        name: 'Test key',
        description: 'Test description',
        expirationDays: 1,
        privileges: ['process:start', 'process:step'],
        service: 'test',
      };

      const insertOne = collection.insertOne.mockResolvedValue({
        insertedId: new ObjectId('123456789012345678901234'),
      } as any);

      const issuedKey = await service.issue(apiKey);

      expect(issuedKey.issued).toBeInstanceOf(Date);
      expect(issuedKey.expiration).toBeInstanceOf(Date);
      expect(issuedKey.token.slice(0, 4)).toEqual('lfl_');
      expect(issuedKey.token).toHaveLength(40);

      expect(collection.insertOne).toHaveBeenCalled();

      const insertedDoc = insertOne.mock.calls[0][0] as ApiKey;
      expect(insertedDoc).toHaveProperty('name', 'Test key');
      expect(insertedDoc).toHaveProperty('description', 'Test description');
      expect(insertedDoc.issued).toBeInstanceOf(Date);

      const expiration = new Date(insertedDoc.issued);
      expiration.setDate(expiration.getDate() + 1);
      expect(insertedDoc.expiration.toISOString()).toEqual(expiration.toISOString());

      expect(insertedDoc).toHaveProperty('privileges', ['process:start', 'process:step']);
      expect(insertedDoc).toHaveProperty('service', 'test');
    });
  });

  describe('list', () => {
    it('should list all api keys', async () => {
      const docs: any = {
        map: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([
          {
            id: '123456789012345678901234',
            name: 'Test key',
            description: 'Test description',
            issued: new Date(),
            expiration: new Date(),
            lastUsed: new Date(),
          },
        ]),
      };

      const find = collection.find.mockReturnThis();
      find.mockImplementation(() => docs);

      const keys = await service.list();

      expect(keys).toHaveLength(1);
      expect(keys[0].id).toEqual('123456789012345678901234');
      expect(keys[0].name).toEqual('Test key');
      expect(keys[0].description).toEqual('Test description');
      expect(keys[0].issued).toBeInstanceOf(Date);
      expect(keys[0].expiration).toBeInstanceOf(Date);
      expect(keys[0].lastUsed).toBeInstanceOf(Date);
    });
  });

  describe('get', () => {
    it('should get an api key', async () => {
      const findOne = collection.findOne.mockResolvedValue({
        _id: new ObjectId('123456789012345678901234'),
        name: 'Test key',
        description: 'Test description',
        issued: new Date('2023-01-01'),
        expiration: new Date('2024-01-01'),
        privileges: ['process:step'],
        service: 'test',
      });

      const apiKey = await service.get('123456789012345678901234');

      expect(findOne).toHaveBeenCalledWith(
        { _id: new ObjectId('123456789012345678901234') },
        { projection: { token: 0 } },
      );

      expect(apiKey.id).toEqual('123456789012345678901234');
      expect(apiKey.name).toEqual('Test key');
      expect(apiKey.description).toEqual('Test description');
      expect(apiKey.issued.toISOString()).toEqual(new Date('2023-01-01').toISOString());
      expect(apiKey.expiration.toISOString()).toEqual(new Date('2024-01-01').toISOString());
      expect(apiKey.privileges).toEqual(['process:step']);
      expect(apiKey.service).toEqual('test');
    });
  });

  describe('revoke', () => {
    it('should revoke an api key', async () => {
      collection.updateOne.mockResolvedValue({ matchedCount: 1 } as any);

      await service.revoke('123456789012345678901234');

      expect(collection.updateOne).toHaveBeenCalled();

      const doc = collection.updateOne.mock.calls[0][0];
      expect(doc._id).toEqual(new ObjectId('123456789012345678901234'));

      const update: UpdateFilter<Document> = collection.updateOne.mock.calls[0][1];
      expect(update).toHaveProperty('$set.revoked');
      expect(update.$set.revoked).toBeInstanceOf(Date);
    });

    it('should throw error when revoking a non-existing api key', async () => {
      collection.updateOne.mockResolvedValue({ matchedCount: 0 } as any);

      await expect(service.revoke('123456789012345678901234')).rejects.toThrow("API Key doesn't exist");
    });
  });
});
