import { describe, expect, it } from "vitest";

import type { LoreEntry } from "@/shared/types/database";

import { partitionLoreEntries } from "./lore-entry-collections";

const now = "2026-01-01T00:00:00.000Z";

function entry(id: string, isTrackableItem = false): LoreEntry {
  return {
    id,
    projectId: "p1",
    title: id,
    category: "Geral",
    content: "",
    tags: [],
    linkedIds: [],
    isTrackableItem,
    createdAt: now,
    updatedAt: now,
  };
}

describe("partitionLoreEntries", () => {
  it("keeps trackable objects out of Lore", () => {
    const loreEntry = entry("lore");
    const item = entry("item", true);

    expect(partitionLoreEntries([loreEntry, item])).toEqual({
      lore: [loreEntry],
      items: [item],
    });
  });

  it("keeps entries without item tracking in Lore", () => {
    const loreEntry = entry("lore");

    expect(partitionLoreEntries([loreEntry])).toEqual({
      lore: [loreEntry],
      items: [],
    });
  });
});
