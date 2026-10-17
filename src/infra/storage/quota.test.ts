import { describe, expect, it } from "vitest";

import {
  QUOTA_WARNING_THRESHOLD,
  isQuotaExceededError,
} from "@/infra/storage/quota";

describe("isQuotaExceededError", () => {
  it("detects DOMException QuotaExceededError", () => {
    const error = new DOMException("quota", "QuotaExceededError");
    expect(isQuotaExceededError(error)).toBe(true);
  });

  it("detects legacy code 22 DOMException", () => {
    const error = new DOMException("quota");
    // Some engines report QuotaExceededError as code 22 with a generic name
    const legacy = { ...error, code: 22, name: "NS_ERROR_DOM_QUOTA_REACHED" };
    expect(isQuotaExceededError(legacy)).toBe(true);
  });

  it("detects plain objects with quota name or code", () => {
    expect(isQuotaExceededError({ name: "QuotaExceededError" })).toBe(true);
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(
      isQuotaExceededError({ name: "NS_ERROR_DOM_QUOTA_REACHED" }),
    ).toBe(true);
  });

  it("rejects unrelated errors", () => {
    expect(isQuotaExceededError(new Error("boom"))).toBe(false);
    expect(isQuotaExceededError({ name: "AbortError" })).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError("quota")).toBe(false);
  });

  it("exposes a warning threshold below 1", () => {
    expect(QUOTA_WARNING_THRESHOLD).toBeLessThan(1);
    expect(QUOTA_WARNING_THRESHOLD).toBeGreaterThan(0);
  });
});
