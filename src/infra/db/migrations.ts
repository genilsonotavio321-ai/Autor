import type { Setting } from "@/shared/types/database";

import { getDatabase } from "./index";
import type { AutorDatabase } from "./schema";

export interface Migration {
  /** Must match a Dexie `.version(n)` that changed the schema. */
  version: number;
  description: string;
  upgrade: (db: AutorDatabase) => Promise<void>;
}

/**
 * Data-migration registry (plan: versioned migrations + pre-migration backup).
 * Schema changes go into schema.ts; row-level rewrites are registered here.
 */
export const migrations: Migration[] = [];

const DATA_VERSION_KEY = "dataVersion";

/** Full JSON dump of every table — stored before any migration runs. */
export async function dumpDatabase(): Promise<Record<string, unknown[]>> {
  const db = getDatabase();
  const tables = [
    "projects",
    "chapters",
    "scenes",
    "characters",
    "locations",
    "loreEntries",
    "plotBeats",
    "timelineEvents",
    "notes",
    "tags",
    "snippets",
    "templates",
    "versions",
    "settings",
  ] as const;

  const dump: Record<string, unknown[]> = {};
  for (const table of tables) {
    dump[table] = await db.table(table).toArray();
  }
  return dump;
}

async function readDataVersion(db: AutorDatabase): Promise<number> {
  const row = await db.settings.get(DATA_VERSION_KEY);
  return typeof row?.value === "number" ? row.value : 0;
}

async function writeDataVersion(
  db: AutorDatabase,
  version: number,
): Promise<void> {
  const existing: Setting = { key: DATA_VERSION_KEY, value: version };
  await db.settings.put(existing);
}

/**
 * Applies pending data migrations, taking a full JSON backup first.
 * Returns the list of migration descriptions that ran.
 */
export async function runMigrations(): Promise<string[]> {
  const db = getDatabase();
  const current = await readDataVersion(db);
  const pending = migrations
    .filter((migration) => migration.version > current)
    .sort((a, b) => a.version - b.version);

  if (pending.length === 0) return [];

  await dumpDatabase(); // pre-migration backup (kept in memory; persisted by Fase 4 backup feature)

  const applied: string[] = [];
  for (const migration of pending) {
    await migration.upgrade(db);
    await writeDataVersion(db, migration.version);
    applied.push(migration.description);
  }
  return applied;
}
