// noinspection DuplicatedCode

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /info', () => {
    it('should return the correct info', () => {
      return request(app.getHttpServer())
        .get('/info')
        .expect(200)
        .expect((res) => {
          expect(res.body).toEqual({
            name: '@letsflow/workflow-engine',
            version: '0.0.0',
            description: 'LetsFlow workflow engine',
            env: 'test',
          });
        });
    });
  });
});
