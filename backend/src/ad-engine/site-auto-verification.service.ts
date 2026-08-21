import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { domainFromHeaderUrl, normalizeDomain } from '../common/domain.util';

// Auto-verifies domain ownership from a real ad request instead of making
// publishers edit an ads.txt file: once a publisher's zone snippet has
// served (or attempted to serve) an ad from a given domain, and that
// request passed fraud detection, we trust it enough to mark the domain
// verified. See PublisherService.validateDomain for the ads.txt path this
// supplements (both still write to the same PublisherSite table).
//
// Trust boundary: the domain comes from the request's Referer/Origin HTTP
// header, which the browser sets from the page's actual location - page JS
// cannot forge it to a different origin. Never derive this from a
// client-suppliable query param (see AdEngineController.serve).
@Injectable()
export class SiteAutoVerificationService {
  private readonly logger = new Logger(SiteAutoVerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async verifyFromRequestHeader(params: {
    zoneId: string;
    refererHeader?: string;
    originHeader?: string;
  }) {
    try {
      const domain =
        domainFromHeaderUrl(params.refererHeader) ??
        domainFromHeaderUrl(params.originHeader);

      if (!domain) {
        return;
      }

      const zone = await this.prisma.adZone.findUnique({
        where: { id: params.zoneId },
        select: { publisherId: true },
      });

      if (!zone) {
        return;
      }

      const normalized = normalizeDomain(domain);

      const existing = await this.prisma.publisherSite.findUnique({
        where: {
          publisherId_domain: {
            publisherId: zone.publisherId,
            domain: normalized,
          },
        },
      });

      // Already verified (by either method) - nothing to do. Also don't
      // downgrade/overwrite an ads.txt verification's metadata.
      if (existing?.verified) {
        return;
      }

      await this.prisma.publisherSite.upsert({
        where: {
          publisherId_domain: {
            publisherId: zone.publisherId,
            domain: normalized,
          },
        },
        update: {
          verified: true,
          verifiedAt: new Date(),
          verificationMethod: 'AD_SNIPPET',
        },
        create: {
          publisherId: zone.publisherId,
          domain: normalized,
          verified: true,
          verifiedAt: new Date(),
          verificationMethod: 'AD_SNIPPET',
        },
      });
    } catch (error) {
      // Best-effort side effect of serving an ad - never let it fail or
      // slow down the actual ad response.
      this.logger.warn(
        `Auto-verification failed for zone ${params.zoneId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
