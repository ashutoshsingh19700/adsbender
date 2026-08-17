import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns platform metadata instead of the starter placeholder', () => {
      expect(appController.getPlatform()).toEqual({
        name: 'Ad Network',
        status: 'online',
        dashboard: 'http://localhost:3001/analytics',
        publisherPortal: 'http://localhost:3001/publisher',
        advertiserStudio: 'http://localhost:3001/advertiser',
      });
    });

    it('returns health status for runtime checks', () => {
      expect(appController.getHealth()).toEqual(
        expect.objectContaining({
          status: 'ok',
          uptime: expect.any(Number),
          timestamp: expect.any(String),
        }),
      );
    });
  });
});
