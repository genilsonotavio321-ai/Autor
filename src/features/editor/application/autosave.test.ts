import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAutosave } from "./autosave";

describe("createAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves once after the debounce window with the latest payload", async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave(save, 800);

    autosave.schedule("a");
    autosave.schedule("ab");
    autosave.schedule("abc");

    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(800);
    expect(save).toHaveBeenCalledExactlyOnceWith("abc");
  });

  it("flush saves pending payload immediately", async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave(save, 800);

    autosave.schedule("pending");
    await autosave.flush();

    expect(save).toHaveBeenCalledExactlyOnceWith("pending");
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("cancel drops the pending payload", async () => {
    const save = vi.fn(async () => undefined);
    const autosave = createAutosave(save, 800);

    autosave.schedule("dropped");
    autosave.cancel();
    await vi.advanceTimersByTimeAsync(1000);

    expect(save).not.toHaveBeenCalled();
  });

  it("queues saves serially", async () => {
    const order: string[] = [];
    const autosave = createAutosave(async (payload: string) => {
      order.push(payload);
    }, 100);

    autosave.schedule("first");
    await vi.advanceTimersByTimeAsync(100);
    autosave.schedule("second");
    await vi.advanceTimersByTimeAsync(100);

    expect(order).toEqual(["first", "second"]);
  });
});
