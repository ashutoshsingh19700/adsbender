import { Test, TestingModule } from '@nestjs/testing';

import { AdvertiserController } from './advertiser.controller';
import { AdvertiserService } from './advertiser.service';
import { CreativeUploadService } from './creative-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

describe('AdvertiserController', () => {
  let controller: AdvertiserController;
  const advertiserService = {
    createCampaign: jest.fn(),
  };
  const creativeUploadService = {
    uploadCreative: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Tests call controller methods directly rather than through HTTP, so
    // the guards never actually run - these stubs exist only so Nest can
    // resolve @UseGuards(JwtAuthGuard, RolesGuard) at module-compile time
    // without needing a real SupabaseService/UsersService/DB connection.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdvertiserController],
      providers: [
        {
          provide: AdvertiserService,
          useValue: advertiserService,
        },
        {
          provide: CreativeUploadService,
          useValue: creativeUploadService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(AdvertiserController);
  });

  it('passes the authenticated advertiser id into campaign creation', async () => {
    const dto = {
      campaignName: 'US Mobile Launch',
      totalBudget: 100,
      dailyBudget: 10,
      maxCpc: 0.5,
      targetCountries: ['US'],
      targetDevices: ['mobile'],
      creativeType: 'image',
      creativeUrl: 'https://cdn.example.com/ad.png',
    };

    advertiserService.createCampaign.mockResolvedValue({
      campaign: { id: 'campaign-1' },
    });

    await controller.createCampaign({ user: { id: 'advertiser-1' } }, dto);

    expect(advertiserService.createCampaign).toHaveBeenCalledWith(
      'advertiser-1',
      dto,
    );
  });
});
