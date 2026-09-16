import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AdvertiserService } from './advertiser.service';
import {
  ALLOWED_CREATIVE_MIME_TYPES,
  CreativeUploadService,
  MAX_VIDEO_CREATIVE_UPLOAD_BYTES,
} from './creative-upload.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

@Controller('api/v1/advertiser')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADVERTISER')
export class AdvertiserController {
  constructor(
    private readonly advertiserService: AdvertiserService,
    private readonly creativeUploadService: CreativeUploadService,
  ) {}

  // Lets an advertiser upload the creative file directly instead of having
  // to host it elsewhere first and paste a URL into CreateCampaignDto -
  // returns a public URL suitable for that `creativeUrl` field.
  @Post('creatives/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      // Upper bound covers the largest allowed type (video); the service
      // enforces the tighter per-type limit once it knows the mimetype.
      limits: { fileSize: MAX_VIDEO_CREATIVE_UPLOAD_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!ALLOWED_CREATIVE_MIME_TYPES.includes(file.mimetype)) {
          callback(
            new BadRequestException(
              `Unsupported file type "${file.mimetype}". Allowed: ${ALLOWED_CREATIVE_MIME_TYPES.join(', ')}`,
            ),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  uploadCreative(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.creativeUploadService.uploadCreative(req.user.id, file);
  }

  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.advertiserService.getProfile(req.user.id);
  }

  @Post('campaigns')
  createCampaign(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCampaignDto,
  ) {
    return this.advertiserService.createCampaign(req.user.id, dto);
  }

  @Get('campaigns')
  listCampaigns(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.advertiserService.listCampaigns(req.user.id, query);
  }

  // Autosaved "New Campaign" wizard draft - lets an advertiser resume a
  // half-filled-in campaign after a refresh, a closed tab, a dropped
  // connection, or from a different device entirely. Declared before
  // campaigns/:id below so "draft" is never swallowed as an :id.
  @Get('campaigns/draft')
  getCampaignDraft(@Req() req: AuthenticatedRequest) {
    return this.advertiserService.getCampaignDraft(req.user.id);
  }

  @Put('campaigns/draft')
  saveCampaignDraft(
    @Req() req: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
  ) {
    return this.advertiserService.saveCampaignDraft(req.user.id, body);
  }

  @Delete('campaigns/draft')
  deleteCampaignDraft(@Req() req: AuthenticatedRequest) {
    return this.advertiserService.deleteCampaignDraft(req.user.id);
  }

  // Countries the campaign wizard's targeting picker should offer - see
  // AdvertiserService.getAvailableCountries for how this list is derived.
  // Declared before the campaigns/:id route below so "available-countries"
  // is never swallowed as an :id.
  @Get('campaigns/meta/available-countries')
  async getAvailableCountries() {
    const countries = await this.advertiserService.getAvailableCountries();
    return { countries };
  }

  // Totals for every campaign this advertiser owns in one ClickHouse query,
  // keyed by campaign id - powers the Statistics screen without it looping
  // over campaigns and firing one request each. Declared before
  // campaigns/:id below so "performance" is never swallowed as an :id.
  @Get('campaigns/performance')
  getCampaignsPerformance(
    @Req() req: AuthenticatedRequest,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.advertiserService.getCampaignsPerformance(
      req.user.id,
      startDate,
      endDate,
    );
  }

  @Get('campaigns/:id')
  getCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.getCampaign(req.user.id, id);
  }

  @Patch('campaigns/:id')
  updateCampaign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.advertiserService.updateCampaign(req.user.id, id, dto);
  }

  @Post('campaigns/:id/pause')
  pauseCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.pauseCampaign(req.user.id, id);
  }

  @Post('campaigns/:id/resume')
  resumeCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.resumeCampaign(req.user.id, id);
  }

  @Post('campaigns/:id/archive')
  archiveCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.archiveCampaign(req.user.id, id);
  }

  @Delete('campaigns/:id')
  deleteCampaign(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.deleteCampaign(req.user.id, id);
  }

  @Get('campaigns/:id/creatives')
  listCreatives(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.listCreatives(req.user.id, id);
  }

  @Get('campaigns/:id/performance')
  getCampaignPerformance(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.advertiserService.getCampaignPerformance(
      req.user.id,
      id,
      startDate,
      endDate,
    );
  }

  @Get('traffic-quality')
  getTrafficQuality(
    @Req() req: AuthenticatedRequest,
    @Query()
    query: { startDate: string; endDate: string; campaignId?: string },
  ) {
    return this.advertiserService.getTrafficQuality(req.user.id, query);
  }

  @Get('campaigns/:id/spend')
  getCampaignSpend(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.advertiserService.getCampaignSpend(req.user.id, id);
  }

  @Get('campaigns/:id/budget-status')
  getCampaignBudgetStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.advertiserService.getCampaignBudgetStatus(req.user.id, id);
  }
}
