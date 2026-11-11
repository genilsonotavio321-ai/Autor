import { describe, expect, it } from "vitest";

import {
  buildMentionIndex,
  findMentions,
  type MentionEntity,
} from "./entity-index";

const character = (id: string, name: string): MentionEntity => ({
  id,
  type: "character",
  name,
});
const location = (id: string, name: string): MentionEntity => ({
  id,
  type: "location",
  name,
});

describe("buildMentionIndex", () => {
  it("trims names and drops names shorter than two characters", () => {
    const index = buildMentionIndex([
      character("1", "  Alice  "),
      character("2", "A"),
    ]);
    expect(index).toEqual([character("1", "Alice")]);
  });

  it("dedupes case-insensitively per type and sorts longest first", () => {
    const index = buildMentionIndex([
      character("1", "Ana"),
      character("2", "Ana"),
      location("3", "Porto de Ana"),
    ]);
    expect(index.map((entity) => entity.name)).toEqual([
      "Porto de Ana",
      "Ana",
    ]);
    expect(index).toHaveLength(2);
  });
});

describe("findMentions", () => {
  const index = buildMentionIndex([
    character("alice", "Alice"),
    location("porto", "Porto de Ana"),
    character("ana", "Ana"),
  ]);

  it("matches whole words case-insensitively", () => {
    const matches = findMentions("alice viu Ana.", index);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ start: 0, end: 5 });
    expect(matches[0]?.entity.id).toBe("alice");
    expect(matches[1]).toMatchObject({ start: 10, end: 13 });
  });

  it("does not match inside a longer word", () => {
    expect(findMentions("Analice", index)).toHaveLength(0);
  });

  it("keeps the longest name when matches overlap", () => {
    const matches = findMentions("Fui ao Porto de Ana ontem.", index);
    expect(matches).toHaveLength(1);
    const match = matches[0]!;
    expect(match.entity.id).toBe("porto");
    expect(match.end - match.start).toBe("Porto de Ana".length);
  });

  it("matches case-insensitively", () => {
    const accented = buildMentionIndex([location("agua", "Água")]);
    expect(findMentions("bebi ÁGUA ontem", accented)).toHaveLength(1);
  });

  it("returns matches ordered by position", () => {
    const matches = findMentions("Ana e Alice", index);
    expect(matches.map((m) => m.start)).toEqual([0, 6]);
  });

  it("handles empty inputs", () => {
    expect(findMentions("", index)).toEqual([]);
    expect(findMentions("texto", [])).toEqual([]);
  });
});
