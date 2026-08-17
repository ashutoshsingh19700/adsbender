import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { join } from 'path';
import { open, CountryResponse, Reader } from 'maxmind';

const DEFAULT_TEST_DB_PATH = join(
  __dirname,
  '..',
  '..',
  'test',
  'fixtures',
  'geoip',
  'GeoLite2-Country-Test.mmdb',
);

@Injectable()
export class GeoIpService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpService.name);
  private readonly countryOverrides = this.loadCountryOverrides();
  private reader: Reader<CountryResponse> | null = null;

  async onModuleInit() {
    const dbPath = process.env.GEOIP_DB_PATH ?? DEFAULT_TEST_DB_PATH;

    try {
      this.reader = await open<CountryResponse>(dbPath);
    } catch (error) {
      this.logger.warn(
        `GeoIP database unavailable at "${dbPath}" (${(error as Error).message}); ` +
          'falling back to header/override-based country resolution. ' +
          'Set GEOIP_DB_PATH to a licensed GeoLite2-Country.mmdb for real lookups.',
      );
    }
  }

  resolveCountry(ipAddress: string, countryHeader?: string): string | null {
    if (countryHeader) {
      return countryHeader.trim().toUpperCase();
    }

    const normalizedIp = this.normalizeIp(ipAddress);

    const override = this.countryOverrides.get(normalizedIp);
    if (override) {
      return override;
    }

    return this.lookupInDatabase(normalizedIp);
  }

  private lookupInDatabase(normalizedIp: string): string | null {
    if (!this.reader) {
      return null;
    }

    try {
      const record = this.reader.get(normalizedIp);

      return (
        record?.country?.iso_code ??
        record?.registered_country?.iso_code ??
        null
      );
    } catch {
      return null;
    }
  }

  private normalizeIp(ipAddress: string) {
    return ipAddress.replace('::ffff:', '').split(',')[0].trim();
  }

  private loadCountryOverrides() {
    const overrides = new Map<string, string>();

    if (!process.env.GEOIP_COUNTRY_OVERRIDES) {
      return overrides;
    }

    try {
      const parsed = JSON.parse(process.env.GEOIP_COUNTRY_OVERRIDES) as Record<
        string,
        string
      >;

      for (const [ipAddress, country] of Object.entries(parsed)) {
        overrides.set(this.normalizeIp(ipAddress), country.toUpperCase());
      }
    } catch {
      return overrides;
    }

    return overrides;
  }
}
