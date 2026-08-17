import { Test, TestingModule } from '@nestjs/testing';

import { PublisherController } from './publisher.controller';
import { PublisherService } from './publisher.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

describe('PublisherController', () => {
  let controller: PublisherController;
  const publisherService = {
    validateDomain: jest.fn(),
    createAdZone: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Tests call controller methods directly rather than through HTTP, so
    // the guards never actually run - these stubs exist only so Nest can
    // resolve @UseGuards(JwtAuthGuard, RolesGuard) at module-compile time
    // without needing a real SupabaseService/UsersService/DB connection.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublisherController],
      providers: [
        {
          provide: PublisherService,
          useValue: publisherService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(PublisherController);
  });

  it('passes the authenticated publisher id into domain validation', async () => {
    publisherService.validateDomain.mockResolvedValue({
      id: 'site-1',
    });

    await controller.validateDomain(
      { user: { id: 'publisher-1' } },
      { domain: 'publisher-site.com' },
    );

    expect(publisherService.validateDomain).toHaveBeenCalledWith(
      'publisher-1',
      { domain: 'publisher-site.com' },
    );
  });

  it('passes the authenticated publisher id into ad-zone creation', async () => {
    publisherService.createAdZone.mockResolvedValue({
      zone: { id: 'zone-42' },
      snippet: 'snippet',
    });

    await controller.createAdZone(
      { user: { id: 'publisher-1' } },
      {
        zoneName: 'Homepage',
        width: 300,
        height: 250,
        layoutType: 'rectangle',
      },
    );

    expect(publisherService.createAdZone).toHaveBeenCalledWith('publisher-1', {
      zoneName: 'Homepage',
      width: 300,
      height: 250,
      layoutType: 'rectangle',
    });
  });
});
