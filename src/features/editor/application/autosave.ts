/**
 * Debounced autosave controller (plan: 800ms debounce).
 * Framework-free so it can be unit-tested with fake timers.
 */
export interface AutosaveController<T> {
  /** Queues a payload, restarting the debounce window. */
  schedule(payload: T): void;
  /** Saves any pending payload immediately and waits for it. */
  flush(): Promise<void>;
  /** Drops any pending payload without saving. */
  cancel(): void;
}

export function createAutosave<T>(
  save: (payload: T) => Promise<void>,
  delayMs = 800,
): AutosaveController<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;
  let inFlight: Promise<void> = Promise.resolve();

  async function runSave(): Promise<void> {
    const payload = pending;
    pending = null;
    if (payload === null) return;
    inFlight = inFlight.then(() => save(payload));
    await inFlight;
  }

  return {
    schedule(payload: T): void {
      pending = payload;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void runSave();
      }, delayMs);
    },
    async flush(): Promise<void> {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      await runSave();
    },
    cancel(): void {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
