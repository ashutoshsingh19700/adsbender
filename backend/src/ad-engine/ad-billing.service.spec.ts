import { ConflictException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';

import { AdBillingService } from './ad-billing.service';
import type { ClickEvent } from './ad-event.types';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { WalletManager } from '../wallet/wallet-manager.service';

const createEvent = (overrides: Partial<ClickEvent> = {}): ClickEvent => ({
  type: 'click',
  zone: 'zone-1',
  campaign: 'campaign-1',
  advertiser: 'advertiser-1',
  cost: 0.5,
  time: 1719274200,
  request: {
    origin: 'https://publisher.test',
    path: '/article',
    country: 'US',
    device: 'desktop',
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
  },
  ...overrides,
});

describe('AdBillingService', () => {
  let service: AdBillingService;
  let prisma: { adZone: { findUnique: jest.Mock } };
  let walletManager: {
    recordCampaignSpend: jest.Mock;
    creditPublisherEarning: jest.Mock;
  };
  let platformSettingsService: {
    getPlatformFeeBps: jest.Mock;
    publisherShareOf: jest.Mock;
  };

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    prisma = {
      adZone: {
        findUnique: jest.fn().mockResolvedValue({ publisherId: 'publisher-1' }),
      },
    };
    walletManager = {
      recordCampaignSpend: jest.fn().mockResolvedValue(undefined),
      creditPublisherEarning: jest.fn().mockResolvedValue(undefined),
    };
    // Real rounding math (not a canned return value) so tests below can
    // assert the actual fee-adjusted amount, same as production behavior.
    platformSettingsService = {
      getPlatformFeeBps: jest.fn().mockResolvedValue(2000), // 20% default
      publisherShareOf: jest.fn((amount: number, feeBps: number) =>
        new Prisma.Decimal(amount)
          .times(new Prisma.Decimal(10_000 - feeBps).dividedBy(10_000))
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdBillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletManager, useValue: walletManager },
        { provide: PlatformSettingsService, useValue: platformSettingsService },
      ],
    }).compile();

    service = module.get(AdBillingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('charges the advertiser the full amount and credits the publisher only their post-fee share', async () => {
    await service.billClick(createEvent(), 'msg-1');

    expect(walletManager.recordCampaignSpend).toHaveBeenCalledWith(
      'campaign-1',
      0.5,
      'msg-1',
      expect.stringContaining('zone-1'),
    );
    // 20% platform fee on $0.50 -> publisher gets $0.40, not the full $0.50.
    const [publisherId, publisherAmount, options] =
      walletManager.creditPublisherEarning.mock.calls[0];
    expect(publisherId).toBe('publisher-1');
    expect(publisherAmount.toString()).toBe('0.4');
    expect(options).toEqual(expect.objectContaining({ referenceId: 'msg-1' }));
  });

  it('does nothing for a zero/negative cost click', async () => {
    await service.billClick(createEvent({ cost: 0 }), 'msg-2');

    expect(prisma.adZone.findUnique).not.toHaveBeenCalled();
    expect(walletManager.recordCampaignSpend).not.toHaveBeenCalled();
    expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
  });

  it('skips billing when the zone no longer exists, without throwing', async () => {
    prisma.adZone.findUnique.mockResolvedValue(null);

    await expect(
      service.billClick(createEvent(), 'msg-3'),
    ).resolves.toBeUndefined();
    expect(walletManager.recordCampaignSpend).not.toHaveBeenCalled();
  });

  it('treats a duplicate advertiser charge as already-billed and skips the publisher credit too', async () => {
    walletManager.recordCampaignSpend.mockRejectedValue(
      new ConflictException('DUPLICATE_TRANSACTION'),
    );

    await expect(
      service.billClick(createEvent(), 'msg-4'),
    ).resolves.toBeUndefined();
    expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
  });

  it('does not credit the publisher when the advertiser charge fails for a real reason', async () => {
    walletManager.recordCampaignSpend.mockRejectedValue(
      new ConflictException('CAMPAIGN_NOT_ACTIVE'),
    );

    await expect(
      service.billClick(createEvent(), 'msg-5'),
    ).resolves.toBeUndefined();
    expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
  });

  it('swallows a duplicate publisher-credit retry without erroring', async () => {
    walletManager.creditPublisherEarning.mockRejectedValue(
      new ConflictException('DUPLICATE_TRANSACTION'),
    );

    await expect(
      service.billClick(createEvent(), 'msg-6'),
    ).resolves.toBeUndefined();
  });

  it('swallows a non-duplicate publisher-credit failure (logged for manual reconciliation) without throwing', async () => {
    walletManager.creditPublisherEarning.mockRejectedValue(
      new Error('wallet locked'),
    );

    await expect(
      service.billClick(createEvent(), 'msg-7'),
    ).resolves.toBeUndefined();
    expect(walletManager.recordCampaignSpend).toHaveBeenCalledTimes(1);
  });

  it('skips crediting (without erroring) when the fee rounds the publisher share down to zero', async () => {
    platformSettingsService.getPlatformFeeBps.mockResolvedValue(10_000); // 100% fee

    await expect(
      service.billClick(createEvent(), 'msg-8'),
    ).resolves.toBeUndefined();
    expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
  });

  describe('billCpmBatch', () => {
    it('charges the advertiser the full CPM rate and credits the publisher their post-fee share', async () => {
      await service.billCpmBatch(
        'campaign-1',
        'publisher-1',
        2, // $2 CPM
        'cpm:campaign-1:batch:1',
      );

      expect(walletManager.recordCampaignSpend).toHaveBeenCalledWith(
        'campaign-1',
        2,
        'cpm:campaign-1:batch:1',
        expect.stringContaining('CPM'),
      );
      const [publisherId, publisherAmount] =
        walletManager.creditPublisherEarning.mock.calls[0];
      expect(publisherId).toBe('publisher-1');
      expect(publisherAmount.toString()).toBe('1.6'); // 80% of $2
    });

    it('treats a duplicate CPM batch charge as already-billed and skips the publisher credit', async () => {
      walletManager.recordCampaignSpend.mockRejectedValue(
        new ConflictException('DUPLICATE_TRANSACTION'),
      );

      await expect(
        service.billCpmBatch('campaign-1', 'publisher-1', 2, 'cpm:campaign-1:batch:1'),
      ).resolves.toBeUndefined();
      expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
    });

    it('does not credit the publisher when the CPM batch charge fails for a real reason', async () => {
      walletManager.recordCampaignSpend.mockRejectedValue(
        new ConflictException('CAMPAIGN_NOT_ACTIVE'),
      );

      await expect(
        service.billCpmBatch('campaign-1', 'publisher-1', 2, 'cpm:campaign-1:batch:1'),
      ).resolves.toBeUndefined();
      expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
    });
  });

  describe('billConversion', () => {
    it('charges the advertiser the full CPA rate and credits the publisher their post-fee share', async () => {
      await service.billConversion(
        'campaign-1',
        'publisher-1',
        20, // $20 CPA
        'conversion:click-1',
      );

      expect(walletManager.recordCampaignSpend).toHaveBeenCalledWith(
        'campaign-1',
        20,
        'conversion:click-1',
        expect.stringContaining('CPA'),
      );
      const [publisherId, publisherAmount] =
        walletManager.creditPublisherEarning.mock.calls[0];
      expect(publisherId).toBe('publisher-1');
      expect(publisherAmount.toString()).toBe('16'); // 80% of $20
    });

    it('treats a duplicate conversion charge as already-billed and skips the publisher credit', async () => {
      walletManager.recordCampaignSpend.mockRejectedValue(
        new ConflictException('DUPLICATE_TRANSACTION'),
      );

      await expect(
        service.billConversion('campaign-1', 'publisher-1', 20, 'conversion:click-1'),
      ).resolves.toBeUndefined();
      expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
    });

    it('does not credit the publisher when the conversion charge fails for a real reason', async () => {
      walletManager.recordCampaignSpend.mockRejectedValue(
        new ConflictException('CAMPAIGN_NOT_ACTIVE'),
      );

      await expect(
        service.billConversion('campaign-1', 'publisher-1', 20, 'conversion:click-1'),
      ).resolves.toBeUndefined();
      expect(walletManager.creditPublisherEarning).not.toHaveBeenCalled();
    });
  });
});
