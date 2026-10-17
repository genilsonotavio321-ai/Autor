import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import {
  getWritingLog,
  recordSprint,
  recordWords,
  WRITING_LOG_KEY,
} from "./writing-log-repository";

beforeEach(async () => {
  const db = getDatabase();
  await db.settings.clear();
});

describe("writing log repository", () => {
  it("returns an empty log when nothing was recorded", async () => {
    expect(await getWritingLog()).toEqual({});
  });

  it("accumulates words per day", async () => {
    await recordWords("2026-10-17", 150);
    await recordWords("2026-10-17", 50);
    await recordWords("2026-10-16", 20);
    const log = await getWritingLog();
    expect(log["2026-10-17"]).toEqual({ words: 200, sprints: 0 });
    expect(log["2026-10-16"]).toEqual({ words: 20, sprints: 0 });
  });

  it("records sprint completions", async () => {
    await recordSprint("2026-10-17");
    await recordSprint("2026-10-17");
    const log = await getWritingLog();
    expect(log["2026-10-17"]?.sprints).toBe(2);
  });

  it("ignores malformed stored values", async () => {
    const db = getDatabase();
    await db.settings.put({
      key: WRITING_LOG_KEY,
      value: { "2026-10-17": "not-an-object", "2026-10-16": { words: 5 } },
    });
    const log = await getWritingLog();
    expect(log).toEqual({ "2026-10-16": { words: 5, sprints: 0 } });
  });
});
