import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { TABLE_NAMES } from "@/infra/db/migrations";
import { dumpDatabase } from "@/infra/db/migrations";

export interface BackupFile {
  app: "autor";
  formatVersion: 1;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Dumps every table and returns the backup as a JSON blob + filename. */
export async function buildBackupBlob(): Promise<{ blob: Blob; filename: string }> {
  const tables = await dumpDatabase();
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
  return {
    app: "autor",
    formatVersion: 1,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    tables: tables as Record<string, unknown[]>,
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
