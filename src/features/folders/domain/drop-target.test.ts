import { describe, expect, it } from "vitest";

import { resolveDrop, type RectLike } from "./drop-target";

const over: RectLike = { left: 0, top: 0, width: 100, height: 100 };

/** Card centrado no alvo (centro em 50,50 — zona central). */
const centered = (x: number, y: number): RectLike => ({
  left: x - 5,
  top: y - 5,
  width: 10,
  height: 10,
});

describe("resolveDrop", () => {
  it("centro do card na zona central cria pasta", () => {
    expect(resolveDrop(centered(50, 50), over)).toBe("into");
    expect(resolveDrop(centered(31, 69), over)).toBe("into");
  });

  it("borda do card reordena (comportamento antigo)", () => {
    expect(resolveDrop(centered(20, 50), over)).toBe("reorder");
    expect(resolveDrop(centered(50, 10), over)).toBe("reorder");
    expect(resolveDrop(centered(80, 50), over)).toBe("reorder");
  });

  it("sem retângulos, reordena", () => {
    expect(resolveDrop(null, over)).toBe("reorder");
    expect(resolveDrop(centered(50, 50), null)).toBe("reorder");
    expect(resolveDrop(null, null)).toBe("reorder");
  });
});
