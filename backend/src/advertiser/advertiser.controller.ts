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

import type { AuthenticatedRequest } from '../common/authenticated-request';
import { AdvertiserService } from './advertiser.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

@Controller('api/v1/advertiser')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADVERTISER')
export class AdvertiserController {
  constructor(private readonly advertiserService: AdvertiserService) {}

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
