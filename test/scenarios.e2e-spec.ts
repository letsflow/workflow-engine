// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { Collection, MongoClient } from 'mongodb';
import { normalize, NormalizedScenario, Scenario, uuid, yaml } from '@letsflow/api';
import { from as bsonUUID } from 'uuid-mongodb';
import { ScenarioDocument } from '../src/scenario/scenario.service';
import { ConfigService } from '../src/common/config/config.service';
import { AuthService } from '../src/common/auth/auth.service';

describe('ScenarioController (e2e)', () => {
  let app: INestApplication;
  let mongo: MongoClient;
  let scenariosCollection: Collection<ScenarioDocument>;
  let authHeader: { Authorization: string };
  let userAuthHeader: { Authorization: string };

  function minimalScenario(title: string): Scenario {
    return {
      title,
      description: `Description for ${title}`,
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
  }

  function minimalScenarioDocument(title: string, disabled = false): ScenarioDocument {
    const scenario: Partial<ScenarioDocument> = normalize(minimalScenario(title));
    scenario._id = bsonUUID(uuid(scenario as NormalizedScenario));
    scenario._disabled = disabled;

    return scenario as ScenarioDocument;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Connect to the MongoDB test database
    const config = await app.get<ConfigService>(ConfigService);

    // Get an auth token
    const auth = await app.get<AuthService>(AuthService);
    authHeader = { Authorization: 'Bearer ' + auth.devAccount({ id: 'admin', roles: ['admin'] }).token };
    userAuthHeader = { Authorization: 'Bearer ' + auth.devAccount({ id: 'user' }).token };

    mongo = await MongoClient.connect(config.get('db'));
  });

  afterAll(async () => {
    await mongo.db().dropCollection('scenarios');
    await mongo.close();

    await app.close();
  });

  beforeEach(async () => {
    // Reset the test data before each test
    scenariosCollection = mongo.db().collection('scenarios');
    await scenariosCollection.deleteMany({});

    // Insert a test scenario
    await scenariosCollection.insertMany([
      minimalScenarioDocument('Test Scenario 1'),
      minimalScenarioDocument('Test Scenario 2'),
      minimalScenarioDocument('Test Scenario 3', true),
    ]);
  });

  afterEach(async () => {
    // Reset the test data after each test
    const scenariosCollection = mongo.db().collection('scenarios');
    await scenariosCollection.deleteMany({});
  });

  describe('GET /scenarios', () => {
    it('should return all scenarios', async () => {
      const response = await request(app.getHttpServer()).get('/scenarios').set(authHeader);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          id: minimalScenarioDocument('Test Scenario 1')._id.toString(),
          title: 'Test Scenario 1',
          description: 'Description for Test Scenario 1',
        },
        {
          id: minimalScenarioDocument('Test Scenario 2')._id.toString(),
          title: 'Test Scenario 2',
          description: 'Description for Test Scenario 2',
        },
      ]);
    });

    it('should return a 401 if no auth token is provided', async () => {
      const response = await request(app.getHttpServer()).get('/scenarios');
      expect(response.status).toBe(401);
    });

    it('should return a 403 if the auth token is invalid', async () => {
      const response = await request(app.getHttpServer()).get('/scenarios').set(userAuthHeader);
      expect(response.status).toBe(403);
    });
  });

  describe('POST /scenarios', () => {
    it('should store a scenario', async () => {
      const newScenario = minimalScenario('New Scenario');
      const { _id: bsonId, ...expected } = minimalScenarioDocument('New Scenario');
      const id = bsonId.toString();

      const response = await request(app.getHttpServer()).post('/scenarios').set(authHeader).send(newScenario);

      expect(response.status).toBe(201);
      expect(response.headers.location).toEqual(`/scenarios/${id}`);

      const scenario = await scenariosCollection.findOne({ _id: bsonId }, { projection: { _id: 0 } });
      expect(scenario).toEqual(expected);
    });

    it('enable an existing scenario', async () => {
      const newScenario = minimalScenario('Test Scenario 3');
      const { _id: bsonId, ...expected } = minimalScenarioDocument('Test Scenario 3');
      const id = bsonId.toString();

      const response = await request(app.getHttpServer()).post('/scenarios').set(authHeader).send(newScenario);

      expect(response.status).toBe(201);
      expect(response.headers.location).toEqual(`/scenarios/${id}`);

      const scenario = await scenariosCollection.findOne({ _id: bsonId }, { projection: { _id: 0 } });
      expect(scenario).toEqual(expected);
    });

    it('should return a 401 if no auth token is provided', async () => {
      const newScenario = minimalScenario('Test Scenario 3');
      const response = await request(app.getHttpServer()).post('/scenarios').send(newScenario);
      expect(response.status).toBe(401);
    });

    it('should return a 403 if the auth token is invalid', async () => {
      const newScenario = minimalScenario('Test Scenario 3');
      const response = await request(app.getHttpServer()).post('/scenarios').set(userAuthHeader).send(newScenario);
      expect(response.status).toBe(403);
    });
  });

  describe('GET /scenarios/:id', () => {
    it.each([
      { headers: {}, ext: '' },
      { headers: { accept: 'application/json' }, ext: '' },
      { headers: {}, ext: '.json' },
    ])('should return a scenario as JSON (%o)', async ({ headers, ext }) => {
      const id = minimalScenarioDocument('Test Scenario 1')._id.toString();
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}${ext}`).set(headers).set(authHeader);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toEqual(normalize(minimalScenario('Test Scenario 1')));
    });

    it.each([
      { headers: { accept: 'application/yaml' }, ext: '' },
      { headers: {}, ext: '.yaml' },
    ])('should return a scenario as YAML (%o)', async ({ headers, ext }) => {
      const id = minimalScenarioDocument('Test Scenario 1')._id.toString();
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}${ext}`).set(headers).set(authHeader);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/yaml; charset=utf-8');
      expect(yaml.parse(response.text)).toEqual(normalize(minimalScenario('Test Scenario 1')));
    });

    it('should return a 404 if the scenario does not exist', async () => {
      const id = 'c2800e46-ba36-4fc0-b3e8-c426022f9640';
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`).set(authHeader);

      expect(response.status).toBe(404);
    });

    it('should return a 404 for an invalid id', async () => {
      const id = 'foo';
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`).set(authHeader);

      expect(response.status).toBe(404);
    });

    it('should set the X-Disabled header', async () => {
      const id = minimalScenarioDocument('Test Scenario 3')._id.toString();
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`).set(authHeader);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.body).toEqual(normalize(minimalScenario('Test Scenario 3')));

      expect(response.headers['x-disabled']).toBe('true');
    });

    it('should return a 401 if no auth token is provided', async () => {
      const id = 'c2800e46-ba36-4fc0-b3e8-c426022f9640';
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`);
      expect(response.status).toBe(401);
    });

    it('should return a 403 if the auth token is invalid', async () => {
      const id = 'c2800e46-ba36-4fc0-b3e8-c426022f9640';
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`).set(userAuthHeader);
      expect(response.status).toBe(403);
    });
  });

  describe('DELETE /scenarios/:id', () => {
    it('should disable a scenario', async () => {
      const { _id: bsonId, ...expected } = minimalScenarioDocument('Test Scenario 1', true);
      const id = bsonId.toString();
      const response = await request(app.getHttpServer()).delete(`/scenarios/${id}`).set(authHeader);

      expect(response.status).toBe(204);

      const scenario = await scenariosCollection.findOne({ _id: bsonId }, { projection: { _id: 0 } });
      expect(scenario).toEqual(expected);
    });

    it('should return a 404 if the scenario does not exist', async () => {
      const id = 'c2800e46-ba36-4fc0-b3e8-c426022f9640';
      const response = await request(app.getHttpServer()).delete(`/scenarios/${id}`).set(authHeader);

      expect(response.status).toBe(404);
    });

    it('should return a 404 for an invalid id', async () => {
      const id = 'foo';
      const response = await request(app.getHttpServer()).delete(`/scenarios/${id}`).set(authHeader);

      expect(response.status).toBe(404);
    });

    it('should return a 401 if no auth token is provided', async () => {
      const id = 'c2800e46-ba36-4fc0-b3e8-c426022f9640';
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`);
      expect(response.status).toBe(401);
    });

    it('should return a 403 if the auth token is invalid', async () => {
      const id = 'c2800e46-ba36-4fc0-b3e8-c426022f9640';
      const response = await request(app.getHttpServer()).get(`/scenarios/${id}`).set(userAuthHeader);
      expect(response.status).toBe(403);
    });
  });
});
