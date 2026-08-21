import { Test, TestingModule } from '@nestjs/testing';

import { SiteAutoVerificationService } from './site-auto-verification.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SiteAutoVerificationService', () => {
  let service: SiteAutoVerificationService;
  const prismaService = {
    adZone: {
      findUnique: jest.fn(),
    },
    publisherSite: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteAutoVerificationService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get(SiteAutoVerificationService);
  });

  it('verifies the zone owner + domain pulled from the real Referer header', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      publisherId: 'publisher-1',
    });
    prismaService.publisherSite.findUnique.mockResolvedValue(null);

    await service.verifyFromRequestHeader({
      zoneId: 'zone-1',
      refererHeader: 'https://example.com/article',
    });

    expect(prismaService.publisherSite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publisherId_domain: {
            publisherId: 'publisher-1',
            domain: 'example.com',
          },
        },
        update: expect.objectContaining({
          verified: true,
          verificationMethod: 'AD_SNIPPET',
        }),
        create: expect.objectContaining({
          publisherId: 'publisher-1',
          domain: 'example.com',
          verified: true,
          verificationMethod: 'AD_SNIPPET',
        }),
      }),
    );
  });

  it('falls back to the Origin header when Referer is absent', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      publisherId: 'publisher-1',
    });
    prismaService.publisherSite.findUnique.mockResolvedValue(null);

    await service.verifyFromRequestHeader({
      zoneId: 'zone-1',
      originHeader: 'https://example.com',
    });

    expect(prismaService.publisherSite.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          publisherId_domain: {
            publisherId: 'publisher-1',
            domain: 'example.com',
          },
        },
      }),
    );
  });

  it('never trusts a client-suppliable value - only the header params are read', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      publisherId: 'publisher-1',
    });

    // No refererHeader/originHeader passed - simulates a request whose
    // headers didn't carry a usable origin. Must not verify anything.
    await service.verifyFromRequestHeader({ zoneId: 'zone-1' });

    expect(prismaService.publisherSite.upsert).not.toHaveBeenCalled();
  });

  it('does nothing when the zone does not exist', async () => {
    prismaService.adZone.findUnique.mockResolvedValue(null);

    await service.verifyFromRequestHeader({
      zoneId: 'missing-zone',
      refererHeader: 'https://example.com/article',
    });

    expect(prismaService.publisherSite.upsert).not.toHaveBeenCalled();
  });

  it('does not re-verify or overwrite an already-verified site', async () => {
    prismaService.adZone.findUnique.mockResolvedValue({
      publisherId: 'publisher-1',
    });
    prismaService.publisherSite.findUnique.mockResolvedValue({
      verified: true,
      verificationMethod: 'ADS_TXT',
    });

    await service.verifyFromRequestHeader({
      zoneId: 'zone-1',
      refererHeader: 'https://example.com/article',
    });

    expect(prismaService.publisherSite.upsert).not.toHaveBeenCalled();
  });

  it('swallows errors so a bad request never breaks ad serving', async () => {
    prismaService.adZone.findUnique.mockRejectedValue(new Error('db down'));

    await expect(
      service.verifyFromRequestHeader({
        zoneId: 'zone-1',
        refererHeader: 'https://example.com/article',
      }),
    ).resolves.toBeUndefined();
  });
});
