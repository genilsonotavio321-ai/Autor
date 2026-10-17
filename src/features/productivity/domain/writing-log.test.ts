import { describe, expect, it } from "vitest";

import {
  addSprint,
  addWords,
  EMPTY_WRITING_LOG,
  estimateReadingMinutes,
  summariseWriting,
  toDayKey,
  type WritingLog,
} from "./writing-log";

describe("toDayKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDayKey(new Date(2026, 9, 17))).toBe("2026-10-17");
    expect(toDayKey(new Date(2026, 0, 3))).toBe("2026-01-03");
  });
});

describe("addWords / addSprint", () => {
  it("accumulates words and sprints per day", () => {
    let log = addWords(EMPTY_WRITING_LOG, "2026-10-17", 120);
    log = addWords(log, "2026-10-17", 80);
    log = addSprint(log, "2026-10-17");
    expect(log["2026-10-17"]).toEqual({ words: 200, sprints: 1 });
  });

  it("ignores non-positive word deltas", () => {
    const log = addWords(EMPTY_WRITING_LOG, "2026-10-17", 0);
    expect(log).toEqual({});
    expect(addWords(log, "2026-10-17", -50)).toEqual({});
  });
});

describe("summariseWriting", () => {
  const today = new Date(2026, 9, 17); // sábado

  it("sums today, the last seven days and the total", () => {
    const log: WritingLog = {
      "2026-10-17": { words: 300, sprints: 1 },
      "2026-10-16": { words: 100, sprints: 0 },
      "2026-10-11": { words: 50, sprints: 0 }, // dentro da janela de 7 dias
      "2026-10-10": { words: 999, sprints: 0 }, // fora da janela
    };
    const summary = summariseWriting(log, today);
    expect(summary.today).toBe(300);
    expect(summary.week).toBe(450);
    expect(summary.total).toBe(1449);
    expect(summary.sprintsToday).toBe(1);
  });

  it("counts a streak ending today", () => {
    const log: WritingLog = {
      "2026-10-17": { words: 10, sprints: 0 },
      "2026-10-16": { words: 10, sprints: 0 },
      "2026-10-15": { words: 10, sprints: 0 },
      "2026-10-13": { words: 10, sprints: 0 },
    };
    expect(summariseWriting(log, today).streak).toBe(3);
  });

  it("keeps the streak alive when today is still empty", () => {
    const log: WritingLog = {
      "2026-10-16": { words: 10, sprints: 0 },
      "2026-10-15": { words: 10, sprints: 0 },
    };
    expect(summariseWriting(log, today).streak).toBe(2);
  });

  it("reports zeroes for an empty log", () => {
    const summary = summariseWriting(EMPTY_WRITING_LOG, today);
    expect(summary).toEqual({
      today: 0,
      week: 0,
      streak: 0,
      total: 0,
      sprintsToday: 0,
    });
  });
});

describe("estimateReadingMinutes", () => {
  it("rounds up at 200 words per minute", () => {
    expect(estimateReadingMinutes(0)).toBe(0);
    expect(estimateReadingMinutes(1)).toBe(1);
    expect(estimateReadingMinutes(200)).toBe(1);
    expect(estimateReadingMinutes(201)).toBe(2);
    expect(estimateReadingMinutes(10_000)).toBe(50);
  });
});
