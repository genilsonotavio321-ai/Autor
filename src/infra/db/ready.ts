import Dexie from "dexie";

import { runMigrations } from "./migrations";

let ready: Promise<unknown> | null = null;

/**
 * Runs pending migrations once (idempotent) before the first read/write.
 *
 * Returns a **Dexie.Promise** on purpose: `await` on a native Promise breaks
 * Dexie's PSD zone, which silently disables `liveQuery` change tracking.
 * Awaiting a Dexie.Promise keeps the zone (and thus tracking) alive.
 */
export function ensureDbReady(): Dexie.Promise<void> {
  ready ??= Dexie.Promise.resolve().then(() => runMigrations());
  return Dexie.Promise.resolve(ready).then(() => undefined);
}
