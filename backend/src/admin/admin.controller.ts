import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AdminService } from './admin.service';
import { RejectCampaignDto } from './dto/reject-campaign.dto';
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
  async approveCampaign(@Param('id') id: string) {
    // TEMP DIAGNOSTIC (Claude, 2026-08-21): this route 500s with no detail
    // in production; surfacing the real error message/stack to trace it,
    // since there's no Render log access from here. Revert once fixed.
    try {
      return await this.adminService.approveCampaign(id);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new BadRequestException({
        diagnosticMessage:
          error instanceof Error ? error.message : String(error),
        diagnosticName: error instanceof Error ? error.name : undefined,
        diagnosticStack: error instanceof Error ? error.stack : undefined,
      });
    }
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
