import { Controller, Get, UseGuards } from '@nestjs/common';

import { PlatformSettingsService } from './platform-settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Read-only, any authenticated role (advertiser/publisher/admin) - unlike
// AdminController's /admin/settings/* routes, this is what the campaign
// wizard calls to show "this format costs $X" while building a campaign, so
// it deliberately skips RolesGuard/@Roles('ADMIN').
@Controller('api/v1/config')
@UseGuards(JwtAuthGuard)
export class PlatformSettingsController {
  constructor(
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  @Get('ad-format-pricing')
  getAdFormatPricing() {
    return this.platformSettingsService.getAdFormatPricing();
  }
}
