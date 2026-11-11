import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { TABLE_NAMES } from "@/infra/db/migrations";
import { dumpDatabase } from "@/infra/db/migrations";

import {
  deserializeBlob,
  isSerializedBlob,
  serializeBlob,
} from "./serialized-blob";

export interface BackupFile {
  app: "autor";
  formatVersion: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function serializeBlobField(
  rows: unknown[],
  field: string,
): Promise<unknown[]> {
  return Promise.all(
    rows.map(async (value) => {
      if (!isRecord(value)) return value;
      const blob = value[field];
      if (
        blob === null ||
        typeof blob !== "object" ||
        typeof (blob as Blob).arrayBuffer !== "function"
      ) {
        return value;
      }
      return { ...value, [field]: await serializeBlob(blob as Blob) };
    }),
  );
}

function deserializeBlobField(rows: unknown[], field: string): unknown[] {
  return rows.map((value) => {
    if (!isRecord(value) || value[field] === undefined) return value;
    if (isSerializedBlob(value[field])) {
      try {
        return { ...value, [field]: deserializeBlob(value[field]) };
      } catch {
        throw new Error("Arquivo de backup inválido.");
      }
    }
    if (isRecord(value[field]) && Object.keys(value[field]).length === 0) {
      const restored = { ...value };
      delete restored[field];
      return restored;
    }
    throw new Error("Arquivo de backup inválido.");
  });
}

/** Dumps every table and returns the backup as a JSON blob + filename. */
export async function buildBackupBlob(): Promise<{ blob: Blob; filename: string }> {
  const tables = await dumpDatabase();
  tables.projects = await serializeBlobField(tables.projects ?? [], "coverBlob");
  tables.characters = await serializeBlobField(
    tables.characters ?? [],
    "avatarBlob",
  );
  const backup: BackupFile = {
    app: "autor",
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  return { blob, filename: `autor-backup-${todayIsoDate()}.json` };
}

/** Validates untrusted JSON as a backup file (throws a pt-BR error). */
export function parseBackup(raw: unknown): BackupFile {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Arquivo de backup inválido.");
  }
  const candidate = raw as Record<string, unknown>;
  const tables = candidate.tables;
  if (tables === null || typeof tables !== "object" || Array.isArray(tables)) {
    throw new Error("Arquivo de backup inválido.");
  }
  for (const value of Object.values(tables)) {
    if (!Array.isArray(value)) throw new Error("Arquivo de backup inválido.");
  }
  const parsedTables = { ...(tables as Record<string, unknown[]>) };
  if (Array.isArray(parsedTables.projects)) {
    parsedTables.projects = deserializeBlobField(parsedTables.projects, "coverBlob");
  }
  if (Array.isArray(parsedTables.characters)) {
    parsedTables.characters = deserializeBlobField(
      parsedTables.characters,
      "avatarBlob",
    );
  }
  return {
    app: "autor",
    formatVersion: 1,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    tables: parsedTables,
  };
}

/**
 * Replaces every table with the backup contents (atomic transaction).
 * Returns how many rows were restored per table.
 */
export async function importBackup(
  backup: BackupFile,
): Promise<Record<string, number>> {
  await ensureDbReady();
  const db = getDatabase();
  const counts: Record<string, number> = {};

  await db.transaction("rw", [...TABLE_NAMES], async () => {
    for (const name of TABLE_NAMES) {
      const rows = backup.tables[name] ?? [];
      const table = db.table(name);
      await table.clear();
      if (rows.length > 0) await table.bulkPut(rows as never[]);
      counts[name] = rows.length;
    }
  });

  return counts;
}

/** Convenience: parse JSON text and import it. */
export async function importBackupJson(
  json: string,
): Promise<Record<string, number>> {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("Arquivo de backup inválido.");
  }
  return importBackup(parseBackup(raw));
}
