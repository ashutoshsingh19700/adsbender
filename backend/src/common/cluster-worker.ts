// Node's cluster module (wired up in main.ts) forks one process per CPU in
// production, each running a full copy of this Nest app - safe for the HTTP
// API itself (stateless, backed by Postgres/Redis), but NOT safe for a
// handful of singleton background jobs that assume they're the only reader
// of a resource:
//
//   - ClickHouseIngestionWorkerService / ClickHouseClickIngestionWorkerService
//     / ClickHouseTrafficIngestionWorkerService each consume a Redis stream
//     via plain XREAD + a hard XDEL-on-ack (no consumer group) and track
//     their read cursor in an in-process variable. A second reader racing
//     the same stream can see the same message before either ack's it -
//     duplicate ClickHouse analytics rows and, worse, a second attempt at
//     CPM/CPC billing for the same impression/click.
//   - CampaignCacheSyncService / ZoneCacheSyncService / BlacklistCacheSyncService
//     resync the whole Postgres table into Redis every 30s. Not a
//     correctness bug if every worker does it (idempotent, last-write-wins),
//     but it multiplies Redis command usage by the worker count for zero
//     benefit - see those services' own comments on staying inside a
//     managed Redis provider's command quota.
//
// main.ts assigns CLUSTER_WORKER_INDEX="0" to exactly one worker (and
// re-assigns it to that worker's replacement if it crashes - see
// forkWorker/cluster.on('exit') in main.ts), so exactly one process ever
// runs these jobs regardless of how many workers are serving HTTP traffic.
// Unset entirely outside cluster mode (plain `node dist/src/main`, `nest
// start --watch` in dev, or any Jest test) - there's only one process, so it
// always owns these jobs.
export function isSingletonWorker(): boolean {
  return (
    process.env.CLUSTER_WORKER_INDEX === undefined ||
    process.env.CLUSTER_WORKER_INDEX === '0'
  );
}
