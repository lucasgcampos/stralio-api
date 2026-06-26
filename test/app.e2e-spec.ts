import dotenv from 'dotenv';
import { Test, TestingModule } from '@nestjs/testing';
// Mock Stellar SDK to avoid ESM import issues in e2e tests
jest.mock('@stellar/stellar-sdk', () => ({
  Server: jest.fn().mockImplementation(() => ({
    getEvents: jest.fn().mockResolvedValue({}),
    getLatestLedger: jest.fn().mockResolvedValue(12345),
  })),
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getEvents: jest.fn().mockResolvedValue({}),
      getLatestLedger: jest.fn().mockResolvedValue(12345),
    })),
  },
}));

dotenv.config({ path: './.env.test' });
process.env.NODE_ENV = 'test';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
