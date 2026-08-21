import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdZoneStatus } from '@prisma/client';

import { AD_ZONE_TRANSITIONS } from './ad-zone-status.util';
import { CreateAdZoneDto } from './dto/create-ad-zone.dto';
import { UpdateAdZoneDto } from './dto/update-ad-zone.dto';
import { UpdateAdZoneStatusDto } from './dto/update-ad-zone-status.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { ValidateDomainDto } from './dto/validate-domain.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { assertTransition } from '../common/status-transition.util';
import { parsePagination } from '../common/pagination.util';
import { normalizeDomain } from '../common/domain.util';

@Injectable()
export class PublisherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // --- Profile ---

  async getProfile(publisherId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: publisherId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        balance_usd: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Publisher not found');
    }

    return user;
  }

  // --- Domain validation (unchanged) ---

  async validateDomain(publisherId: string, dto: ValidateDomainDto) {
    const domain = normalizeDomain(dto.domain);
    const adsTxtUrl = `https://${domain}/ads.txt`;
    const expectedText =
      dto.expectedText?.trim() || `adnetwork-verify=${publisherId}`;

    let response: Response;
    try {
      response = await fetch(adsTxtUrl);
    } catch {
      throw new BadRequestException('DOMAIN_UNREACHABLE');
    }

    if (!response.ok) {
      throw new BadRequestException('ADS_TXT_NOT_FOUND');
    }

    const adsTxt = await response.text();
    const verified = adsTxt.includes(expectedText);

    if (!verified) {
      throw new BadRequestException('ADS_TXT_VERIFICATION_TEXT_MISSING');
    }

    return this.prisma.publisherSite.upsert({
      where: {
        publisherId_domain: {
          publisherId,
          domain,
        },
      },
      update: {
        adsTxtUrl,
        expectedText,
        verified: true,
        verifiedAt: new Date(),
        verificationMethod: 'ADS_TXT',
      },
      create: {
        publisherId,
        domain,
        adsTxtUrl,
        expectedText,
        verified: true,
        verifiedAt: new Date(),
        verificationMethod: 'ADS_TXT',
      },
    });
  }

  // --- Sites ---

  async listSites(
    publisherId: string,
    query: { page?: string; pageSize?: string },
  ) {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [sites, total] = await Promise.all([
      this.prisma.publisherSite.findMany({
        where: { publisherId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.publisherSite.count({ where: { publisherId } }),
    ]);

    return { sites, page, pageSize, total };
  }

  async getSite(publisherId: string, siteId: string) {
    return this.findOwnedSiteOrThrow(publisherId, siteId);
  }

  async updateSite(publisherId: string, siteId: string, dto: UpdateSiteDto) {
    await this.findOwnedSiteOrThrow(publisherId, siteId);

    return this.prisma.publisherSite.update({
      where: { id: siteId },
      data: { status: dto.status },
    });
  }

  async deactivateSite(publisherId: string, siteId: string) {
    await this.findOwnedSiteOrThrow(publisherId, siteId);

    // Soft delete: sites can have ad zones and history tied to them, so we
    // deactivate instead of hard-deleting the row.
    return this.prisma.publisherSite.update({
      where: { id: siteId },
      data: { status: 'INACTIVE' },
    });
  }

  // --- Ad zones ---

  async createAdZone(publisherId: string, dto: CreateAdZoneDto) {
    const zone = await this.prisma.adZone.create({
      data: {
        publisherId,
        zoneName: dto.zoneName,
        width: dto.width,
        height: dto.height,
        layoutType: dto.layoutType,
      },
    });

    return {
      zone,
      snippet: this.buildSnippet(zone.id),
    };
  }

  async listAdZones(
    publisherId: string,
    query: { page?: string; pageSize?: string; status?: string },
  ) {
    const { skip, take, page, pageSize } = parsePagination(query);
    const status = this.parseAdZoneStatusFilter(query.status);

    const where = { publisherId, ...(status ? { status } : {}) };

    const [zones, total] = await Promise.all([
      this.prisma.adZone.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.adZone.count({ where }),
    ]);

    return { zones, page, pageSize, total };
  }

  async getAdZone(publisherId: string, zoneId: string) {
    return this.findOwnedZoneOrThrow(publisherId, zoneId);
  }

  async updateAdZone(
    publisherId: string,
    zoneId: string,
    dto: UpdateAdZoneDto,
  ) {
    const zone = await this.findOwnedZoneOrThrow(publisherId, zoneId);

    if (zone.status === 'ARCHIVED') {
      throw new BadRequestException('Cannot edit an archived ad zone');
    }

    return this.prisma.adZone.update({
      where: { id: zoneId },
      data: dto,
    });
  }

  async updateAdZoneStatus(
    publisherId: string,
    zoneId: string,
    dto: UpdateAdZoneStatusDto,
  ) {
    const zone = await this.findOwnedZoneOrThrow(publisherId, zoneId);

    assertTransition(zone.status, dto.status, AD_ZONE_TRANSITIONS);

    return this.prisma.adZone.update({
      where: { id: zoneId },
      data: { status: dto.status },
    });
  }

  async archiveAdZone(publisherId: string, zoneId: string) {
    return this.updateAdZoneStatus(publisherId, zoneId, {
      status: AdZoneStatus.ARCHIVED,
    });
  }

  async getAdZoneSnippet(publisherId: string, zoneId: string) {
    const zone = await this.findOwnedZoneOrThrow(publisherId, zoneId);

    return { zoneId: zone.id, snippet: this.buildSnippet(zone.id) };
  }

  async getAdZonePerformance(
    publisherId: string,
    zoneId: string,
    startDate: string,
    endDate: string,
  ) {
    await this.findOwnedZoneOrThrow(publisherId, zoneId);

    return this.analyticsService.getDailyMetrics(startDate, endDate, {
      zoneId,
    });
  }

  buildSnippet(zoneId: string) {
    const tagUrl =
      process.env.PUBLIC_TAG_URL ??
      'http://localhost:3000/assets/publisher_tag.js';

    return `<section data-zone-id="${zoneId}"></section>\n<script async src="${tagUrl}"></script>`;
  }

  // --- Ownership helpers ---
  // We throw NotFound (not Forbidden) when the resource belongs to someone
  // else, so a publisher can't even tell whether another publisher's
  // site/zone id exists.

  private async findOwnedSiteOrThrow(publisherId: string, siteId: string) {
    const site = await this.prisma.publisherSite.findUnique({
      where: { id: siteId },
    });

    if (!site || site.publisherId !== publisherId) {
      throw new NotFoundException('Site not found');
    }

    return site;
  }

  private async findOwnedZoneOrThrow(publisherId: string, zoneId: string) {
    const zone = await this.prisma.adZone.findUnique({
      where: { id: zoneId },
    });

    if (!zone || zone.publisherId !== publisherId) {
      throw new NotFoundException('Ad zone not found');
    }

    return zone;
  }

  private parseAdZoneStatusFilter(status?: string) {
    if (!status) {
      return undefined;
    }

    if (!Object.values(AdZoneStatus).includes(status as AdZoneStatus)) {
      throw new BadRequestException('Invalid status filter');
    }

    return status as AdZoneStatus;
  }
}
