import { Injectable } from '@nestjs/common';

// A starter, illustrative list of well-known cloud/hosting-provider CIDR
// blocks (AWS, Google Cloud, Microsoft Azure, DigitalOcean, OVH, Hetzner,
// Linode/Akamai, Vultr, Oracle Cloud). Real ad viewers browse from
// residential/mobile/corporate ISPs - a request from inside one of these
// ranges is a server, not a person's browser, so it's a strong bot/scripted-
// traffic signal regardless of what User-Agent it presents.
//
// This is NOT a substitute for a real IP-intelligence feed in production
// (these ranges shift constantly and this list is far from exhaustive) -
// plug in a provider like IPQualityScore/IP2Location/MaxMind GeoIP2
// Anonymous IP DB via this same `isDatacenterIp` interface when one is
// available. Kept dependency-free here so fraud detection has *some*
// coverage for this signal out of the box.
const DATACENTER_CIDR_RANGES: string[] = [
  // AWS
  '3.0.0.0/9',
  '13.32.0.0/15',
  '18.130.0.0/16',
  '34.192.0.0/10',
  '52.0.0.0/8',
  '54.0.0.0/8',
  // Google Cloud
  '34.64.0.0/10',
  '35.184.0.0/13',
  '104.196.0.0/14',
  // Microsoft Azure
  '13.64.0.0/11',
  '20.0.0.0/8',
  '40.64.0.0/10',
  // DigitalOcean
  '104.131.0.0/16',
  '134.209.0.0/16',
  '138.68.0.0/16',
  '159.65.0.0/16',
  '164.90.0.0/16',
  '167.71.0.0/16',
  // OVH
  '51.68.0.0/16',
  '51.75.0.0/16',
  '141.94.0.0/16',
  '145.239.0.0/16',
  // Hetzner
  '5.9.0.0/16',
  '78.46.0.0/15',
  '88.99.0.0/16',
  '116.202.0.0/16',
  '135.181.0.0/16',
  // Linode / Akamai Connected Cloud
  '45.33.0.0/16',
  '45.56.0.0/16',
  '172.104.0.0/15',
  '172.234.0.0/16',
  // Vultr
  '45.32.0.0/16',
  '66.42.0.0/16',
  '104.156.224.0/19',
  '108.61.0.0/16',
  // Oracle Cloud
  '129.146.0.0/16',
  '132.145.0.0/16',
  '150.230.0.0/16',
];

type CidrBlock = { network: number; mask: number };

@Injectable()
export class DatacenterIpService {
  private readonly blocks: CidrBlock[] = DATACENTER_CIDR_RANGES.map((cidr) =>
    this.parseCidr(cidr),
  ).filter((block): block is CidrBlock => block !== null);

  // Returns false (never true) for anything that isn't a plain IPv4 address
  // - IPv6 datacenter ranges aren't covered by the table above, and this is
  // a "flag it, don't crash on it" signal, not a hard requirement.
  isDatacenterIp(ipAddress: string): boolean {
    const numericIp = this.ipv4ToInt(ipAddress);
    if (numericIp === null) {
      return false;
    }

    return this.blocks.some(
      (block) => (numericIp & block.mask) === block.network,
    );
  }

  private parseCidr(cidr: string): CidrBlock | null {
    const [address, prefixRaw] = cidr.split('/');
    const prefix = Number(prefixRaw);
    const network = this.ipv4ToInt(address);

    if (network === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
      return null;
    }

    // 32-bit shifts in JS wrap at 31 bits for a full /0 mask - not a range
    // this list ever uses, but guarded defensively anyway.
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

    return { network: network & mask, mask };
  }

  private ipv4ToInt(ipAddress: string): number | null {
    const normalized = ipAddress.replace('::ffff:', '').split(',')[0].trim();
    const parts = normalized.split('.');

    if (parts.length !== 4) {
      return null;
    }

    let value = 0;
    for (const part of parts) {
      if (!/^\d{1,3}$/.test(part)) {
        return null;
      }
      const octet = Number(part);
      if (octet > 255) {
        return null;
      }
      value = (value << 8) | octet;
    }

    return value >>> 0;
  }
}
