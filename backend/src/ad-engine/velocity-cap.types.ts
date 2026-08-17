export type VelocityCounterResult = {
  key: string;
  count: number;
  ttlSeconds: number;
};

export interface VelocityCounterStore {
  increment(key: string, ttlSeconds: number): Promise<VelocityCounterResult>;
}
