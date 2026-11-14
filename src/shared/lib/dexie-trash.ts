import type { EntityId } from "@/shared/types/database";

/** Timestamp used by every repository write. */
export function nowIso(): string {
  return new Date().toISOString();
}

interface TrashableRow {
  id: EntityId;
  deletedAt?: string;
  updatedAt?: string;
}

interface TrashableTable {
  update(id: EntityId, changes: Partial<TrashableRow>): Promise<unknown>;
  where(index: "id"): {
    equals(id: EntityId): { modify(changes: Partial<TrashableRow>): Promise<number> };
  };
}

/** Moves a row to the trash and bumps `updatedAt`. */
export async function softDeleteRow(
  table: TrashableTable,
  id: EntityId,
): Promise<void> {
  const now = nowIso();
  await table.update(id, { deletedAt: now, updatedAt: now });
}

/**
 * Clears `deletedAt`. Uses `modify` because `Table.update` would keep the
 * property (set to undefined) instead of removing it.
 */
export async function restoreRow(
  table: TrashableTable,
  id: EntityId,
): Promise<void> {
  await table.where("id").equals(id).modify({ deletedAt: undefined });
}

/** Trashed rows, most recently deleted first. */
export async function listDeletedRows<T extends TrashableRow>(table: {
  filter(predicate: (row: T) => boolean): { toArray(): Promise<T[]> };
}): Promise<T[]> {
  const rows = await table.filter((row) => Boolean(row.deletedAt)).toArray();
  return rows.sort((a, b) =>
    (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
  );
}
