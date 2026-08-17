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
import { CreateAdZoneDto } from './dto/create-ad-zone.dto';
import { UpdateAdZoneDto } from './dto/update-ad-zone.dto';
import { UpdateAdZoneStatusDto } from './dto/update-ad-zone-status.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { ValidateDomainDto } from './dto/validate-domain.dto';
import { PublisherService } from './publisher.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';

@Controller('api/v1/publisher')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('PUBLISHER')
export class PublisherController {
  constructor(private readonly publisherService: PublisherService) {}

  @Get('me')
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.publisherService.getProfile(req.user.id);
  }

  @Post('domains/validate')
  validateDomain(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ValidateDomainDto,
  ) {
    return this.publisherService.validateDomain(req.user.id, dto);
  }

  @Get('sites')
  listSites(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; pageSize?: string },
  ) {
    return this.publisherService.listSites(req.user.id, query);
  }

  @Get('sites/:id')
  getSite(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publisherService.getSite(req.user.id, id);
  }

  @Patch('sites/:id')
  updateSite(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSiteDto,
  ) {
    return this.publisherService.updateSite(req.user.id, id, dto);
  }

  @Delete('sites/:id')
  deactivateSite(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publisherService.deactivateSite(req.user.id, id);
  }

  @Post('ad-zones')
  createAdZone(@Req() req: AuthenticatedRequest, @Body() dto: CreateAdZoneDto) {
    return this.publisherService.createAdZone(req.user.id, dto);
  }

  @Get('ad-zones')
  listAdZones(
    @Req() req: AuthenticatedRequest,
    @Query() query: { page?: string; pageSize?: string; status?: string },
  ) {
    return this.publisherService.listAdZones(req.user.id, query);
  }

  @Get('ad-zones/:id')
  getAdZone(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publisherService.getAdZone(req.user.id, id);
  }

  @Patch('ad-zones/:id')
  updateAdZone(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAdZoneDto,
  ) {
    return this.publisherService.updateAdZone(req.user.id, id, dto);
  }

  @Patch('ad-zones/:id/status')
  updateAdZoneStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAdZoneStatusDto,
  ) {
    return this.publisherService.updateAdZoneStatus(req.user.id, id, dto);
  }

  @Delete('ad-zones/:id')
  archiveAdZone(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publisherService.archiveAdZone(req.user.id, id);
  }

  @Get('ad-zones/:id/snippet')
  getAdZoneSnippet(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.publisherService.getAdZoneSnippet(req.user.id, id);
  }

  @Get('ad-zones/:id/performance')
  getAdZonePerformance(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.publisherService.getAdZonePerformance(
      req.user.id,
      id,
      startDate,
      endDate,
    );
  }
}
