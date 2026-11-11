import type { LoreEntry } from "@/shared/types/database";

export function partitionLoreEntries(entries: LoreEntry[]): {
  lore: LoreEntry[];
  items: LoreEntry[];
} {
  const lore: LoreEntry[] = [];
  const items: LoreEntry[] = [];

  for (const entry of entries) {
    (entry.isTrackableItem ? items : lore).push(entry);
  }

  return { lore, items };
}
