import { describe, expect, it } from "vitest";

import { projectFormSchema } from "./schemas";

describe("projectFormSchema", () => {
  it("accepts a minimal valid payload", () => {
    const result = projectFormSchema.safeParse({
      title: "Meu romance",
      status: "draft",
    });
    expect(result.success).toBe(true);
  });

  it("trims the title", () => {
    const result = projectFormSchema.parse({
      title: "  Meu romance  ",
      status: "active",
    });
    expect(result.title).toBe("Meu romance");
  });

  it("rejects an empty title", () => {
    const result = projectFormSchema.safeParse({
      title: "   ",
      status: "draft",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = projectFormSchema.safeParse({
      title: "Ok",
      status: "published",
    });
    expect(result.success).toBe(false);
  });
});
