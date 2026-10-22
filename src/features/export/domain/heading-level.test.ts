import { describe, expect, it } from "vitest";

import type { Json } from "@/shared/types/database";

import { headingLevel } from "./heading-level";

function heading(record: Record<string, Json>) {
  return headingLevel(record);
}

describe("headingLevel", () => {
  it("reads the level from attrs, where Tiptap stores it", () => {
    expect(heading({ type: "heading", attrs: { level: 2 } })).toBe(2);
    expect(heading({ type: "heading", attrs: { level: 3 } })).toBe(3);
  });

  it("falls back to the legacy root level", () => {
    expect(heading({ type: "heading", level: 2 })).toBe(2);
    expect(heading({ type: "heading", attrs: { textAlign: null }, level: 2 })).toBe(2);
  });

  it("prefers attrs over the legacy root level", () => {
    expect(heading({ type: "heading", attrs: { level: 2 }, level: 1 })).toBe(2);
  });

  it("defaults to 1 when the level is missing or invalid", () => {
    expect(heading({ type: "heading" })).toBe(1);
    expect(heading({ type: "heading", attrs: {} })).toBe(1);
    expect(heading({ type: "heading", attrs: { level: "dois" } })).toBe(1);
    expect(heading({ type: "heading", attrs: { level: null } })).toBe(1);
  });

  it("clamps to the 1–6 range", () => {
    expect(heading({ type: "heading", attrs: { level: 0 } })).toBe(1);
    expect(heading({ type: "heading", attrs: { level: -3 } })).toBe(1);
    expect(heading({ type: "heading", attrs: { level: 9 } })).toBe(6);
  });
});
