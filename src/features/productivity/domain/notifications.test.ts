import { describe, expect, it } from "vitest";

import {
  decideGoalNotification,
  decideStaleNotifications,
  latestCreatedAt,
} from "./notifications";

const EVENING = new Date("2026-10-29T20:00:00");
const MORNING = new Date("2026-10-29T09:00:00");

describe("decideGoalNotification", () => {
  it("avisa de noite quando a meta não foi batida", () => {
    expect(decideGoalNotification(100, 500, EVENING)).toEqual({
      kind: "goal",
      body: "Você ainda não bateu a meta de 500 palavras hoje.",
    });
  });

  it("não avisa de manhã (falta natural de começar)", () => {
    expect(decideGoalNotification(0, 500, MORNING)).toBeNull();
  });

  it("não avisa com meta batida ou desligada (goal 0)", () => {
    expect(decideGoalNotification(500, 500, EVENING)).toBeNull();
    expect(decideGoalNotification(0, 0, EVENING)).toBeNull();
  });
});

describe("decideStaleNotifications", () => {
  const flags = { character: true, scene: true, chapter: true };

  it("avisa para tipo parado além do limite", () => {
    const latest = {
      character: "2026-10-01T00:00:00.000Z",
      scene: undefined,
      chapter: "2026-10-28T00:00:00.000Z",
    };
    const results = decideStaleNotifications(latest, 7, EVENING, flags);
    expect(results.map((item) => item.kind)).toEqual(["character"]);
    expect(results[0]?.body).toContain("sem criar um personagem novo");
  });

  it("respeita flags desligadas e itens inexistentes", () => {
    const results = decideStaleNotifications(
      { character: "2020-01-01T00:00:00.000Z" },
      7,
      EVENING,
      { character: false, scene: true, chapter: true },
    );
    expect(results).toEqual([]);
  });
});

describe("latestCreatedAt", () => {
  it("pega a maior data e ignora vazias", () => {
    expect(
      latestCreatedAt([
        undefined,
        "2026-01-02T00:00:00.000Z",
        null,
        "2026-02-10T00:00:00.000Z",
      ]),
    ).toBe("2026-02-10T00:00:00.000Z");
    expect(latestCreatedAt([undefined])).toBeUndefined();
  });
});
