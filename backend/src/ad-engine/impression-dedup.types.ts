// Backs PublisherImpressionDedupService's "one impression per IP per 24h
// per publisher site" rule (see that file). Distinct from
// FrequencyCapCounterStore/VelocityCounterStore above - those count how
// many times something happened; this only needs a yes/no "has this exact
// key already been claimed in the current window", which is a single
// atomic SET-if-not-exists rather than an increment.
export interface ImpressionDedupStore {
  // Returns true the FIRST time `key` is claimed within `ttlSeconds` (this
  // request is the one that "counts"), false if an earlier request already
  // claimed it inside the same window (this request is a repeat view, not a
  // new unique impression).
  claimOnce(key: string, ttlSeconds: number): Promise<boolean>;
}
