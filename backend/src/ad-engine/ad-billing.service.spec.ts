import { ConflictException, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AdBillingService } from './ad-billing.service';
import type { ClickEvent } from './ad-event.types';
import { PrismaService } from '../prisma/prisma.service';
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdBillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: WalletManager, useValue: walletManager },
      ],
    }).compile();

    service = module.get(AdBillingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('charges the advertiser and credits the zone publisher the same amount', async () => {
    await service.billClick(createEvent(), 'msg-1');

    expect(walletManager.recordCampaignSpend).toHaveBeenCalledWith(
      'campaign-1',
      0.5,
      'msg-1',
      expect.stringContaining('zone-1'),
    );
    expect(walletManager.creditPublisherEarning).toHaveBeenCalledWith(
      'publisher-1',
      0.5,
      expect.objectContaining({ referenceId: 'msg-1' }),
    );
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
});
