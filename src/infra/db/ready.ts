import Dexie from "dexie";

import { runMigrations } from "./migrations";

let ready: Promise<unknown> | null = null;

/** Cross-tab lock: only one tab runs data migrations at a time. */
const MIGRATION_LOCK = "autor-db-migrations";

async function runMigrationsWithLock(): Promise<string[]> {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  if (!locks) return runMigrations();
  return locks.request(MIGRATION_LOCK, () => runMigrations());
}

/**
 * Runs pending migrations once (idempotent) before the first read/write.
 * The lock is cross-tab so two tabs opening together can't both migrate.
 *
 * Returns a **Dexie.Promise** on purpose: `await` on a native Promise breaks
 * Dexie's PSD zone, which silently disables `liveQuery` change tracking.
 * Awaiting a Dexie.Promise keeps the zone (and thus tracking) alive.
 */
export function ensureDbReady(): Dexie.Promise<void> {
  ready ??= Dexie.Promise.resolve().then(() => runMigrationsWithLock());
  return Dexie.Promise.resolve(ready).then(() => undefined);
}
