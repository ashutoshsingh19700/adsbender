import { Test, TestingModule } from '@nestjs/testing';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  const analyticsService = {
    getDailyMetrics: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Tests call controller methods directly rather than through HTTP, so
    // the guards never actually run - these stubs exist only so Nest can
    // resolve @UseGuards(JwtAuthGuard, RolesGuard) at module-compile time
    // without needing a real SupabaseService/UsersService/DB connection.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: analyticsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AnalyticsController);
  });

  it('passes date range filters into the analytics service', async () => {
    analyticsService.getDailyMetrics.mockResolvedValue({
      rows: [],
      totals: {},
    });

    await controller.getDailyMetrics('2026-07-01', '2026-07-21');

    expect(analyticsService.getDailyMetrics).toHaveBeenCalledWith(
      '2026-07-01',
      '2026-07-21',
    );
  });
});
