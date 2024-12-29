// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import { Collection, MongoClient, ObjectId } from 'mongodb';
import { ApiKey } from '../src/apikey';
import { AuthService } from '../src/common/auth/auth.service';
import { ConfigService } from '../src/common/config/config.service';

type ApiKeyDocument = Omit<ApiKey, 'id' | 'expirationDays' | 'isActive'>;

describe('ApikeyController (e2e)', () => {
  let app: INestApplication;
  let mongo: MongoClient;
  let apiKeysCollection: Collection<ApiKeyDocument>;
  let authHeader: { Authorization: string };
  let userAuthHeader: { Authorization: string };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Connect to the MongoDB test database
    const config = await app.get<ConfigService>(ConfigService);

    mongo = await MongoClient.connect(config.get('db'));
  });

  beforeAll(async () => {
    // Get an auth token
    const auth = await app.get<AuthService>(AuthService);
    authHeader = { Authorization: 'Bearer ' + auth.devAccount({ id: 'admin', roles: ['admin'] }).token };
    userAuthHeader = { Authorization: 'Bearer ' + auth.devAccount({ id: 'user' }).token };
  });

  afterAll(async () => {
    await mongo.db().dropCollection('apikeys');
    await mongo.close();

    await app.close();
  });

  beforeEach(async () => {
    apiKeysCollection = mongo.db().collection<ApiKeyDocument>('apikeys');
    await apiKeysCollection.deleteMany({});

    // Create some test API keys
    await apiKeysCollection.insertMany([
      {
        _id: new ObjectId('64984a45308dce960a9e6e01'),
        name: 'Key 1',
        description: 'Admin key',
        issued: new Date('2023-01-01T00:00:00.000Z'),
        expiration: new Date('2099-01-01T00:00:00.000Z'),
        lastUsed: new Date('2023-06-01T00:00:00.000Z'),
        token: 'lfl_P68WU6iTAfUGRhS32xdhKFCvrmeDjB1VIKjP',
        privileges: ['scenario:list', 'scenario:add', 'scenario:get', 'scenario:disable'],
      },
      {
        _id: new ObjectId('64984a45308dce960a9e6e02'),
        name: 'Key 2',
        description: 'Process step key',
        issued: new Date('2023-01-01T00:00:00.000Z'),
        token: 'lfl_xb7WnxaKFSUfuT7LLUNDmZwrzrs72W4ObqDJ',
        privileges: ['process:step'],
        processes: [{ scenario: '0ea1fb14-9aa0-4623-b338-02d63cd02fb6' }],
      },
      {
        _id: new ObjectId('64984a45308dce960a9e6e03'),
        name: 'Key 3',
        description: 'Expired key',
        issued: new Date('2023-01-01T00:00:00.000Z'),
        expiration: new Date('2023-06-01T00:00:00.000Z'),
        token: 'lfl_BxJtFPSAcIXzoU4MYhWo3xAO1utrk03lByWn',
        privileges: ['scenario:list'],
      },
      {
        _id: new ObjectId('64984a45308dce960a9e6e04'),
        name: 'Key 4',
        description: 'Revoked key',
        issued: new Date('2023-01-01T00:00:00.000Z'),
        revoked: new Date('2023-06-01T00:00:00.000Z'),
        token: 'lfl_1tFPSAcIXzoU4MYhWo3xAO1utrk03lByWnBxJ',
        privileges: ['scenario:list'],
      },
    ]);
  });

  describe('GET /apikey', () => {
    it('should return an array of API key summaries', async () => {
      // Send GET request to /apikey
      const response = await request(app.getHttpServer()).get('/apikey').set(authHeader);

      // Assert the response
      expect(response.status).toEqual(200);

      expect(response.body).toHaveLength(4);
      expect(response.body).toContainEqual({
        id: '64984a45308dce960a9e6e01',
        name: 'Key 1',
        description: 'Admin key',
        issued: '2023-01-01T00:00:00.000Z',
        expiration: '2099-01-01T00:00:00.000Z',
        lastUsed: '2023-06-01T00:00:00.000Z',
        privileges: ['scenario:list', 'scenario:add', 'scenario:get', 'scenario:disable'],
      });
      expect(response.body).toContainEqual({
        id: '64984a45308dce960a9e6e02',
        name: 'Key 2',
        description: 'Process step key',
        issued: '2023-01-01T00:00:00.000Z',
        privileges: ['process:step'],
        processes: [{ scenario: '0ea1fb14-9aa0-4623-b338-02d63cd02fb6' }],
      });
      expect(response.body).toContainEqual({
        id: '64984a45308dce960a9e6e03',
        name: 'Key 3',
        description: 'Expired key',
        issued: '2023-01-01T00:00:00.000Z',
        expiration: '2023-06-01T00:00:00.000Z',
        privileges: ['scenario:list'],
      });
      expect(response.body).toContainEqual({
        id: '64984a45308dce960a9e6e04',
        name: 'Key 4',
        description: 'Revoked key',
        issued: '2023-01-01T00:00:00.000Z',
        revoked: '2023-06-01T00:00:00.000Z',
        privileges: ['scenario:list'],
      });
    });
  });

  describe('POST /apikey', () => {
    it('should issue a new API key', async () => {
      const requestBody = {
        name: 'New Key',
        description: 'New Test Key',
        expirationDays: 120,
        privileges: ['scenario:list', 'schema:list'],
      };

      // Send POST request to /apikey
      const response = await request(app.getHttpServer()).post('/apikey').set(authHeader).send(requestBody);

      // Assert the response
      expect(response.status).toEqual(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('New Key');
      expect(response.body.description).toBe('New Test Key');
      expect(response.body.privileges).toEqual(['scenario:list', 'schema:list']);
      expect(response.body.token).toMatch(/^lfl_\w{36}$/);
      expect(response.body.issued).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const expectedExpiration = new Date(response.body.issued);
      expectedExpiration.setDate(expectedExpiration.getDate() + 120);
      expect(response.body.expiration).toBe(expectedExpiration.toISOString());

      // Assert that the API key is saved in the database
      const savedKey = await apiKeysCollection.findOne({ _id: new ObjectId(response.body.id) });
      expect(savedKey).toEqual({
        _id: new ObjectId(response.body.id),
        name: 'New Key',
        description: 'New Test Key',
        token: response.body.token,
        issued: new Date(response.body.issued),
        expiration: expectedExpiration,
        privileges: ['scenario:list', 'schema:list'],
      });
    });
  });

  describe('DELETE /apikey/:id', () => {
    it('should revoke an API key', async () => {
      const id = '64984a45308dce960a9e6e02';

      // Send DELETE request to /apikey/:id
      await request(app.getHttpServer()).delete(`/apikey/${id}`).set(authHeader).expect(204);

      // Assert that the API key is revoked in the database
      const deletedKey = await apiKeysCollection.findOne({ _id: new ObjectId(id) });
      expect(deletedKey.revoked).toBeDefined();
      expect(deletedKey.revoked).toBeInstanceOf(Date);
    });
  });
});
