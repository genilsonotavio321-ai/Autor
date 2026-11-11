import { afterEach, describe, expect, it, vi } from "vitest";

import { createId } from "./id";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("createId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a RFC 4122 v4 uuid", () => {
    expect(createId()).toMatch(UUID_V4);
  });

  it("returns a fresh value on every call", () => {
    expect(createId()).not.toBe(createId());
  });

  it("falls back to getRandomValues when crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (array: Uint8Array) => {
        for (let index = 0; index < array.length; index += 1) {
          array[index] = index * 7 + 1;
        }
        return array;
      },
    });

    expect(createId()).toMatch(UUID_V4);
  });

  it("still works when crypto is unavailable at all", () => {
    vi.stubGlobal("crypto", undefined);

    expect(createId()).toMatch(UUID_V4);
  });
});
