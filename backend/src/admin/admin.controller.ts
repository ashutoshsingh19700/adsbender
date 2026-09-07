import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { RejectCampaignDto } from './dto/reject-campaign.dto';
import { UpdateAdFormatPricingDto } from './dto/update-ad-format-pricing.dto';
import { UpdatePlatformFeeDto } from './dto/update-platform-fee.dto';
import { AdminUpdateSiteStatusDto } from './dto/update-site-status.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Campaign review ---

  @Get('campaigns')
  listCampaigns(
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.adminService.listCampaigns(query);
  }

  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.adminService.getCampaign(id);
  }

  @Post('campaigns/:id/approve')
  approveCampaign(@Param('id') id: string) {
    return this.adminService.approveCampaign(id);
  }

  @Post('campaigns/:id/reject')
  rejectCampaign(@Param('id') id: string, @Body() dto: RejectCampaignDto) {
    return this.adminService.rejectCampaign(id, dto);
  }

  // --- Revenue ---

  @Get('revenue/summary')
  getRevenueSummary() {
    return this.adminService.getRevenueSummary();
  }

  // --- Traffic quality / fraud protection ---

  @Get('traffic-quality')
  getTrafficQuality(@Query() query: { startDate: string; endDate: string }) {
    return this.adminService.getTrafficQuality(query);
  }

  @Get('blacklist')
  listBlacklistedIps(
    @Query() query: { page?: string; pageSize?: string },
  ) {
    return this.adminService.listBlacklistedIps(query);
  }

  @Post('blacklist')
  addBlacklistedIp(@Body() dto: { ipAddress: string; reason: string }) {
    return this.adminService.addBlacklistedIp(dto.ipAddress, dto.reason);
  }

  @Delete('blacklist/:id')
  removeBlacklistedIp(@Param('id') id: string) {
    return this.adminService.removeBlacklistedIp(id);
  }

  // --- Platform settings ---

  @Get('settings/platform-fee')
  getPlatformFee() {
    return this.adminService.getPlatformFee();
  }

  @Patch('settings/platform-fee')
  updatePlatformFee(@Body() dto: UpdatePlatformFeeDto) {
    return this.adminService.updatePlatformFee(dto.platformFeeBps);
  }

  @Get('settings/ad-format-pricing')
  getAdFormatPricing() {
    return this.adminService.getAdFormatPricing();
  }

  @Patch('settings/ad-format-pricing')
  updateAdFormatPricing(@Body() dto: UpdateAdFormatPricingDto) {
    return this.adminService.updateAdFormatPricing(dto);
  }

  // --- Users ---

  @Get('users')
  listUsers(
    @Query() query: { page?: string; pageSize?: string; role?: string },
  ) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  // --- Publisher sites ---

  @Get('sites')
  listSites(
    @Query()
    query: {
      page?: string;
      pageSize?: string;
      status?: string;
      verified?: string;
    },
  ) {
    return this.adminService.listSites(query);
  }

  @Get('sites/:id')
  getSite(@Param('id') id: string) {
    return this.adminService.getSite(id);
  }

  @Patch('sites/:id/status')
  updateSiteStatus(
    @Param('id') id: string,
    @Body() dto: AdminUpdateSiteStatusDto,
  ) {
    return this.adminService.updateSiteStatus(id, dto.status);
  }
}
