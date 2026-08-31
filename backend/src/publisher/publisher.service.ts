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
import type { GroupDimension } from '../analytics/analytics-query.types';
import { assertTransition } from '../common/status-transition.util';
import { parsePagination } from '../common/pagination.util';
import { normalizeDomain, normalizeStatsDomain } from '../common/domain.util';

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
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.adultAds !== undefined ? { adultAds: dto.adultAds } : {}),
      },
      create: {
        publisherId,
        domain,
        adsTxtUrl,
        expectedText,
        verified: true,
        verifiedAt: new Date(),
        verificationMethod: 'ADS_TXT',
        category: dto.category,
        adultAds: dto.adultAds ?? false,
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
      data: {
        status: dto.status,
        category: dto.category,
        adultAds: dto.adultAds,
      },
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

  // Powers the publisher-facing Statistics screen: totals across every zone
  // this publisher owns (or just one, via `zoneId`), grouped by whichever
  // dimension the "Group by" tabs select. Domain/placement/country/device
  // are all real columns on the ClickHouse events (see
  // ClickHouseAnalyticsEventStore.ensureSchema); there's no "browser" or "OS"
  // dimension because the raw user_agent is stored but never parsed into
  // either.
  async getStatistics(
    publisherId: string,
    query: {
      startDate: string;
      endDate: string;
      country?: string;
      domain?: string;
      zoneId?: string;
      groupBy?: GroupDimension;
    },
  ) {
    const zones = await this.prisma.adZone.findMany({
      where: { publisherId },
      select: { id: true, zoneName: true },
    });

    let zoneIds = zones.map((zone) => zone.id);
    if (query.zoneId) {
      const zone = await this.findOwnedZoneOrThrow(publisherId, query.zoneId);
      zoneIds = [zone.id];
    }

    const groupBy = query.groupBy ?? 'date';

    const result = await this.analyticsService.getGroupedMetrics({
      startDate: query.startDate,
      endDate: query.endDate,
      zoneIds,
      groupBy,
      country: query.country || undefined,
      // Normalized the same way the ClickHouse query store groups "domain"
      // rows (see NORMALIZED_DOMAIN_EXPR there), so "example.com" and
      // "https://example.com/" both match.
      domain: query.domain ? normalizeStatsDomain(query.domain) : undefined,
    });

    // ClickHouse only knows zone ids, not the human-readable name a
    // publisher gave that zone - fill it in here for the "Placement" view.
    // Every other dimension's key is already display-ready.
    const zoneNameById = new Map(zones.map((zone) => [zone.id, zone.zoneName]));

    return {
      groupBy,
      totals: result.totals,
      rows: result.rows.map((row) => ({
        ...row,
        label: this.labelStatisticsRow(groupBy, row.key, zoneNameById),
      })),
    };
  }

  // "placement" rows come back as `${domain}\x01${zoneId}` (see
  // GROUP_EXPRESSIONS.placement in the ClickHouse query store) so a
  // publisher can tell one "Homepage banner" from another - matches
  // Adsterra's "domain - placement name" convention. Every other dimension's
  // key is already the label.
  private labelStatisticsRow(
    groupBy: GroupDimension,
    key: string,
    zoneNameById: Map<string, string>,
  ) {
    if (groupBy !== 'placement') {
      return key;
    }

    const separator = String.fromCharCode(1);
    const [domain, zoneId] = key.split(separator);
    const zoneName = zoneNameById.get(zoneId) ?? zoneId;
    return domain ? `${domain} - ${zoneName}` : zoneName;
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
