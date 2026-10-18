import type Dexie from "dexie";

/** Tables carrying a manual (non-indexed) `order` property. */
export type OrderTableName = "characters" | "locations" | "loreEntries";

/**
 * Persists a drag-and-drop reorder in a single transaction. Shared by the
 * characters, locations and lore tables, which all use `order?: number`.
 */
export async function applyOrderMoves(
  db: Dexie,
  table: OrderTableName,
  updates: { id: string; order: number }[],
): Promise<void> {
  if (updates.length === 0) return;
  const now = new Date().toISOString();
  await db.transaction("rw", table, async () => {
    for (const move of updates) {
      await db.table(table).update(move.id, {
        order: move.order,
        updatedAt: now,
      });
    }
  });
}

/** Rows without an order yet (legacy data) sort after the ordered ones. */
export function compareOrder(
  a: { order?: number },
  b: { order?: number },
): number {
  return (
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER)
  );
}

/** Next manual position among a project's live rows. */
export function nextOrder(rows: { order?: number }[]): number {
  let max = -1;
  for (const row of rows) {
    if (typeof row.order === "number" && row.order > max) max = row.order;
  }
  return max + 1;
}
