import { describe, expect, it } from "vitest";

import {
  activityLevel,
  buildActivityDays,
  chunkWeeks,
  startOfWeekMonday,
  type ActivityDay,
} from "./activity-chart";
import type { WritingLog } from "./writing-log";

describe("activityLevel", () => {
  it("returns 0 for empty days", () => {
    expect(activityLevel(0, 500)).toBe(0);
  });

  it("returns 1 without a goal when there is any writing", () => {
    expect(activityLevel(120, 0)).toBe(1);
  });

  it("scales levels against the daily goal", () => {
    expect(activityLevel(200, 500)).toBe(1); // < 50%
    expect(activityLevel(400, 500)).toBe(2); // < 100%
    expect(activityLevel(700, 500)).toBe(3); // < 200%
    expect(activityLevel(1200, 500)).toBe(4); // ≥ 200%
  });
});

describe("startOfWeekMonday", () => {
  it("returns the Monday of the week for any weekday", () => {
    // 2026-10-14 é uma quarta-feira.
    const wednesday = new Date(2026, 9, 14, 15, 30);
    const monday = startOfWeekMonday(wednesday);
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(12);
    expect(monday.getHours()).toBe(0);
  });
});

describe("buildActivityDays", () => {
  it("covers weeks columns ending today, aligned from Monday", () => {
    // 2026-10-14 (quarta) — 2 semanas ⇒ segunda de -1 semana até hoje.
    const today = new Date(2026, 9, 14);
    const log: WritingLog = { "2026-10-12": { words: 300, sprints: 1 } };
    const days = buildActivityDays(log, today, 2, 500);

    // Segunda -1 semana (05/10) até quarta (14/10) = 10 dias, 2 colunas.
    expect(days).toHaveLength(10);
    expect(days[7]?.dayKey).toBe("2026-10-12"); // segunda da semana corrente
    expect(days[7]?.words).toBe(300);
    expect(days[7]?.level).toBe(2); // 300/500 = 0.6 ⇒ nível 2
    expect(days[9]?.dayKey).toBe("2026-10-14");
    expect(days[9]?.level).toBe(0); // sem escrita
  });

  it("ends today and omits future days of the current week", () => {
    const today = new Date(2026, 9, 14); // quarta
    const days = buildActivityDays({}, today, 1, 500);
    // Segunda (12), terça (13), quarta (14) — não quinta-domingo.
    expect(days.map((d) => d.date.getDate())).toEqual([12, 13, 14]);
  });
});

describe("chunkWeeks", () => {
  it("groups days into weekly columns of up to 7 cells", () => {
    const days: ActivityDay[] = Array.from({ length: 10 }, (_, i) => ({
      dayKey: `d${i}`,
      date: new Date(2026, 0, i + 1),
      words: 0,
      level: 0,
    }));
    const weeks = chunkWeeks(days);
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toHaveLength(7);
    expect(weeks[1]).toHaveLength(3);
  });
});
