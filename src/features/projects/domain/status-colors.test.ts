import { describe, expect, it } from "vitest";

import { CHAPTER_STATUS_COLORS, CHAPTER_STATUS_DOT, CHAPTER_STATUS_LABELS } from "./repository";

const STATUSES = ["todo", "draft", "revising", "done"] as const;

describe("chapter status colors", () => {
  it("defines a distinct color and dot for every status", () => {
    const colors = new Set<string>();
    for (const status of STATUSES) {
      expect(CHAPTER_STATUS_LABELS[status]).toBeTruthy();
      expect(CHAPTER_STATUS_COLORS[status]).toBeTruthy();
      expect(CHAPTER_STATUS_DOT[status]).toBeTruthy();
      colors.add(CHAPTER_STATUS_COLORS[status]);
    }
    // Every state must be visually distinguishable.
    expect(colors.size).toBe(STATUSES.length);
  });
});
