import { DatacenterIpService } from './datacenter-ip.service';

describe('DatacenterIpService', () => {
  let service: DatacenterIpService;

  beforeEach(() => {
    service = new DatacenterIpService();
  });

  it('flags an IP inside a known AWS range', () => {
    expect(service.isDatacenterIp('52.10.20.30')).toBe(true);
  });

  it('flags an IP inside a known Hetzner range', () => {
    expect(service.isDatacenterIp('88.99.1.1')).toBe(true);
  });

  it('does not flag an ordinary residential-looking IP', () => {
    expect(service.isDatacenterIp('98.14.22.5')).toBe(false);
  });

  it('normalizes an IPv4-mapped IPv6 address before checking', () => {
    expect(service.isDatacenterIp('::ffff:52.10.20.30')).toBe(true);
  });

  it('returns false for a malformed address instead of throwing', () => {
    expect(service.isDatacenterIp('not-an-ip')).toBe(false);
    expect(service.isDatacenterIp('999.999.999.999')).toBe(false);
    expect(service.isDatacenterIp('')).toBe(false);
  });
});
