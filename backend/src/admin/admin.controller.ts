import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { RejectCampaignDto } from './dto/reject-campaign.dto';
import { UpdateAdFormatPricingDto } from './dto/update-ad-format-pricing.dto';
import { UpdatePlatformFeeDto } from './dto/update-platform-fee.dto';
import { UpdateUsdToInrRateDto } from './dto/update-usd-to-inr-rate.dto';
import { UpdateMinAdvertiserBalanceDto } from './dto/update-min-advertiser-balance.dto';
import { AdminUpdateSiteStatusDto } from './dto/update-site-status.dto';
import { AdminScopes } from '../auth/decorators/admin-scopes.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { AdminScopeGuard } from '../auth/guards/admin-scope/admin-scope.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

// Every route here requires role ADMIN. Routes with no @AdminScopes are open
// to any admin scope (MASTER/PUBLISHER/ADVERTISER); routes tagged
// @AdminScopes('PUBLISHER') or @AdminScopes('ADVERTISER') are restricted to
// that side (MASTER always passes - see AdminScopeGuard). Anything financial
// (platform fee, pricing, FX rate, the revenue/money-flow breakdown) has no
// @AdminScopes override because it's gated at MASTER by AdminScopes('MASTER')
// explicitly below, rather than left open.
@Controller('api/v1/admin')
@UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Campaign review (advertiser side) ---

  @AdminScopes('MASTER', 'ADVERTISER')
  @Get('campaigns')
  listCampaigns(
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.adminService.listCampaigns(query);
  }

  // Declared before campaigns/:id - Nest matches routes in registration
  // order, so this literal segment must come first or campaigns/:id would
  // swallow it (id = "status-counts").
  @AdminScopes('MASTER', 'ADVERTISER')
  @Get('campaigns/status-counts')
  getCampaignStatusCounts() {
    return this.adminService.getCampaignStatusCounts();
  }

  @AdminScopes('MASTER', 'ADVERTISER')
  @Get('campaigns/:id')
  getCampaign(@Param('id') id: string) {
    return this.adminService.getCampaign(id);
  }

  @AdminScopes('MASTER', 'ADVERTISER')
  @Post('campaigns/:id/approve')
  approveCampaign(@Param('id') id: string) {
    return this.adminService.approveCampaign(id);
  }

  @AdminScopes('MASTER', 'ADVERTISER')
  @Post('campaigns/:id/reject')
  rejectCampaign(@Param('id') id: string, @Body() dto: RejectCampaignDto) {
    return this.adminService.rejectCampaign(id, dto);
  }

  // --- Revenue (master only - spans both sides + the platform's own cut) ---

  @AdminScopes('MASTER')
  @Get('revenue/summary')
  getRevenueSummary() {
    return this.adminService.getRevenueSummary();
  }

  // Plain-English explanation of the platform fee + a worked example + real
  // recent AD_SPEND/PUBLISHER_EARNING ledger pairs, so "how exactly the
  // amount is deducted and paid" is answerable from the dashboard instead of
  // reading code.
  @AdminScopes('MASTER')
  @Get('revenue/breakdown')
  getRevenueBreakdown() {
    return this.adminService.getRevenueBreakdown();
  }

  // --- Traffic quality / fraud protection ---
  // Platform-wide, but each side cares about their own half - both scopes
  // can view; only master can manage the blacklist itself.

  @Get('traffic-quality')
  getTrafficQuality(@Query() query: { startDate: string; endDate: string }) {
    return this.adminService.getTrafficQuality(query);
  }

  @AdminScopes('MASTER', 'PUBLISHER')
  @Get('blacklist')
  listBlacklistedIps(
    @Query() query: { page?: string; pageSize?: string },
  ) {
    return this.adminService.listBlacklistedIps(query);
  }

  @AdminScopes('MASTER', 'PUBLISHER')
  @Post('blacklist')
  addBlacklistedIp(@Body() dto: { ipAddress: string; reason: string }) {
    return this.adminService.addBlacklistedIp(dto.ipAddress, dto.reason);
  }

  @AdminScopes('MASTER', 'PUBLISHER')
  @Delete('blacklist/:id')
  removeBlacklistedIp(@Param('id') id: string) {
    return this.adminService.removeBlacklistedIp(id);
  }

  // --- Platform settings (master only - financial configuration) ---

  @AdminScopes('MASTER')
  @Get('settings/platform-fee')
  getPlatformFee() {
    return this.adminService.getPlatformFee();
  }

  @AdminScopes('MASTER')
  @Patch('settings/platform-fee')
  updatePlatformFee(@Body() dto: UpdatePlatformFeeDto) {
    return this.adminService.updatePlatformFee(dto.platformFeeBps);
  }

  @AdminScopes('MASTER')
  @Get('settings/ad-format-pricing')
  getAdFormatPricing() {
    return this.adminService.getAdFormatPricing();
  }

  @AdminScopes('MASTER')
  @Patch('settings/ad-format-pricing')
  updateAdFormatPricing(@Body() dto: UpdateAdFormatPricingDto) {
    return this.adminService.updateAdFormatPricing(dto);
  }

  @AdminScopes('MASTER')
  @Get('settings/usd-to-inr-rate')
  getUsdToInrRate() {
    return this.adminService.getUsdToInrRate();
  }

  @AdminScopes('MASTER')
  @Patch('settings/usd-to-inr-rate')
  updateUsdToInrRate(@Body() dto: UpdateUsdToInrRateDto) {
    return this.adminService.updateUsdToInrRate(dto.usdToInrRate);
  }

  // Floor on an advertiser's free wallet balance - see PlatformSetting.
  // minAdvertiserBalanceUsd in schema.prisma for what this actually gates.
  @AdminScopes('MASTER')
  @Get('settings/min-advertiser-balance')
  getMinAdvertiserBalance() {
    return this.adminService.getMinAdvertiserBalance();
  }

  @AdminScopes('MASTER')
  @Patch('settings/min-advertiser-balance')
  updateMinAdvertiserBalance(@Body() dto: UpdateMinAdvertiserBalanceDto) {
    return this.adminService.updateMinAdvertiserBalance(
      dto.minAdvertiserBalanceUsd,
    );
  }

  // --- Users ---
  // A scoped admin only ever needs to see their own side's accounts -
  // AdminService.listUsers pins the role filter server-side for non-MASTER
  // scopes so a PUBLISHER-scoped admin can't page through advertisers (and
  // vice versa) even by passing a different ?role= query param.

  @Get('users')
  listUsers(
    @Query() query: { page?: string; pageSize?: string; role?: string },
    @Req() req,
  ) {
    return this.adminService.listUsers(query, req.user.adminScope);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string, @Req() req) {
    return this.adminService.getUser(id, req.user.adminScope);
  }

  // --- Advertisers directory ---

  @AdminScopes('MASTER', 'ADVERTISER')
  @Get('advertisers')
  listAdvertisers(
    @Query() query: { page?: string; pageSize?: string; search?: string },
  ) {
    return this.adminService.listAdvertisers(query);
  }

  // Declared before advertisers/:id - same ordering reason as
  // campaigns/status-counts above (literal segment must match first).
  @AdminScopes('MASTER', 'ADVERTISER')
  @Get('advertisers/by-country')
  getAdvertiserCountryBreakdown() {
    return this.adminService.getAdvertiserCountryBreakdown();
  }

  @AdminScopes('MASTER', 'ADVERTISER')
  @Get('advertisers/:id')
  getAdvertiser(
    @Param('id') id: string,
    @Query() query: { startDate?: string; endDate?: string },
  ) {
    return this.adminService.getAdvertiser(id, query);
  }

  // --- Publishers directory ---

  @AdminScopes('MASTER', 'PUBLISHER')
  @Get('publishers')
  listPublishers(
    @Query() query: { page?: string; pageSize?: string; search?: string },
  ) {
    return this.adminService.listPublishers(query);
  }

  // Declared before publishers/:id - same ordering reason as
  // campaigns/status-counts above.
  @AdminScopes('MASTER', 'PUBLISHER')
  @Get('publishers/by-country')
  getPublisherCountryBreakdown() {
    return this.adminService.getPublisherCountryBreakdown();
  }

  @AdminScopes('MASTER', 'PUBLISHER')
  @Get('publishers/:id')
  getPublisher(
    @Param('id') id: string,
    @Query() query: { startDate?: string; endDate?: string },
  ) {
    return this.adminService.getPublisher(id, query);
  }

  // --- Publisher sites ---

  @AdminScopes('MASTER', 'PUBLISHER')
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

  @AdminScopes('MASTER', 'PUBLISHER')
  @Get('sites/:id')
  getSite(@Param('id') id: string) {
    return this.adminService.getSite(id);
  }

  @AdminScopes('MASTER', 'PUBLISHER')
  @Patch('sites/:id/status')
  updateSiteStatus(
    @Param('id') id: string,
    @Body() dto: AdminUpdateSiteStatusDto,
  ) {
    return this.adminService.updateSiteStatus(id, dto.status);
  }
}
