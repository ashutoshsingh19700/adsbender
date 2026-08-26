export type VelocityCounterResult = {
  key: string;
  count: number;
  ttlSeconds: number;
};

export interface VelocityCounterStore {
  increment(key: string, ttlSeconds: number): Promise<VelocityCounterResult>;
}

// Superset of VelocityCounterStore used by per-visitor frequency capping,
// which needs to PEEK a counter's current value while deciding whether a
// campaign is eligible, without bumping it - a plain increment would count
// campaigns that were merely considered but never actually served.
export interface FrequencyCapCounterStore extends VelocityCounterStore {
  get(key: string): Promise<number>;
}
