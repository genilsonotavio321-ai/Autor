import { describe, expect, it } from "vitest";

import { BEAT_TEMPLATES, getBeatTemplate } from "./beat-templates";

describe("beat templates", () => {
  it("covers every builtin plot structure", () => {
    const structures = BEAT_TEMPLATES.map((template) => template.structure);
    expect(structures).toEqual(
      expect.arrayContaining([
        "three_acts",
        "heros_journey",
        "save_the_cat",
        "kishotenketsu",
      ]),
    );
  });

  it("has non-empty beats with unique titles per template", () => {
    for (const template of BEAT_TEMPLATES) {
      expect(template.beats.length).toBeGreaterThan(0);
      const titles = template.beats.map((beat) => beat.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const beat of template.beats) {
        expect(beat.description.length).toBeGreaterThan(0);
      }
    }
  });

  it("returns the template for a structure and undefined otherwise", () => {
    expect(getBeatTemplate("three_acts")?.name).toBe("Três atos");
    expect(getBeatTemplate("custom")).toBeUndefined();
  });
});
