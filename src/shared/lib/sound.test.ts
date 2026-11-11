import { afterEach, describe, expect, it, vi } from "vitest";

type MockOscillator = {
  type: OscillatorType;
  frequency: { value: number };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
};

type MockContext = {
  state: AudioContextState;
  currentTime: number;
  destination: object;
  resume: ReturnType<typeof vi.fn>;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBiquadFilter: ReturnType<typeof vi.fn>;
};

function createMockContext(state: AudioContextState): MockContext {
  const ctx: MockContext = {
    state,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    createOscillator: vi.fn((): MockOscillator => {
      const oscillator: MockOscillator = {
        type: "sine",
        frequency: { value: 0 },
        connect: vi.fn((node: unknown) => node),
        start: vi.fn(),
        stop: vi.fn(),
      };
      return oscillator;
    }),
    createGain: vi.fn(() => ({
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn((node: unknown) => node),
    })),
    createBiquadFilter: vi.fn(() => ({
      type: "lowpass" as BiquadFilterType,
      frequency: { value: 0 },
      connect: vi.fn((node: unknown) => node),
    })),
  };
  return ctx;
}

async function loadSoundModule() {
  // O módulo guarda o AudioContext num singleton; resetar garante contexto novo.
  // O store também precisa ser recarregado junto: sound.ts importa a mesma
  // instância fresca do registry, e um import estático ficaria defasado.
  vi.resetModules();
  const sound = await import("./sound");
  const { useUiStore } = await import("@/shared/store/ui-store");
  return { ...sound, useUiStore };
}

function installContext(ctx: MockContext) {
  window.AudioContext = vi.fn(function () {
    return ctx;
  }) as unknown as typeof AudioContext;
}

describe("playSound", () => {
  const originalAudioContext = window.AudioContext;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("agenda os tons imediatamente com o contexto rodando", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const { playSound } = await loadSoundModule();

    playSound("click", 50);

    expect(ctx.resume).not.toHaveBeenCalled();
    expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("aguarda resume() antes de agendar quando suspenso (iOS)", async () => {
    const ctx = createMockContext("suspended");
    installContext(ctx);
    const { playSound } = await loadSoundModule();

    playSound("click", 50);

    expect(ctx.resume).toHaveBeenCalledTimes(1);
    // Nada agendado no mesmo tick (contexto ainda suspenso).
    expect(ctx.createOscillator).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(ctx.createOscillator).toHaveBeenCalledTimes(2);
    });
    expect(ctx.state).toBe("running");
  });

  it("não toca nada com volume zero", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const { playSound } = await loadSoundModule();

    playSound("click", 0);

    expect(ctx.createOscillator).not.toHaveBeenCalled();
    expect(ctx.resume).not.toHaveBeenCalled();
  });

  it("agenda tons para todos os kinds sem lançar", async () => {
    const kinds = [
      "click",
      "sprintStart",
      "sprintEnd",
      "delete",
      "create",
      "backup",
      "open",
      "close",
      "save",
      "restore",
      "toggle",
      "warn",
    ] as const;
    for (const kind of kinds) {
      const ctx = createMockContext("running");
      installContext(ctx);
      const { playSound } = await loadSoundModule();

      playSound(kind, 50);

      expect(ctx.createOscillator.mock.calls.length, kind).toBeGreaterThan(0);
    }
  });

  it("silencia o click logo após uma ação primária (300ms)", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { playSound } = await loadSoundModule();

    playSound("create", 50);
    const afterPrimary = ctx.createOscillator.mock.calls.length;
    playSound("click", 50);
    expect(ctx.createOscillator.mock.calls.length).toBe(afterPrimary);

    now.mockReturnValue(1_000_301);
    playSound("click", 50);
    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(
      afterPrimary,
    );
  });

  it("suprime primário repetido, mas toca kind diferente", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const { playSound } = await loadSoundModule();

    playSound("delete", 50);
    const afterFirst = ctx.createOscillator.mock.calls.length;
    playSound("delete", 50);
    expect(ctx.createOscillator.mock.calls.length).toBe(afterFirst);

    playSound("create", 50);
    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(afterFirst);
  });

  it("envolve o volume com ataque antes do pico", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const { playSound } = await loadSoundModule();

    playSound("click", 50);

    const gain = ctx.createGain.mock.results[0]!.value.gain;
    // Começa silencioso, sobe por rampa e decai — nunca inicia no pico.
    expect(gain.setValueAtTime).toHaveBeenCalledWith(0.0001, expect.any(Number));
    expect(gain.linearRampToValueAtTime).toHaveBeenCalledTimes(1);
    expect(gain.exponentialRampToValueAtTime).toHaveBeenCalledTimes(1);
    // Lowpass no sinal de cada tom.
    expect(ctx.createBiquadFilter).toHaveBeenCalledTimes(2);
  });
});

describe("playUiSound", () => {
  const originalAudioContext = window.AudioContext;

  afterEach(() => {
    window.AudioContext = originalAudioContext;
  });

  it("não toca quando o som está desativado", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const { playUiSound, useUiStore } = await loadSoundModule();
    useUiStore.setState({ soundEnabled: false, soundVolume: 50 });

    playUiSound("delete");

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("não toca com volume zero mesmo ativado", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const { playUiSound, useUiStore } = await loadSoundModule();
    useUiStore.setState({ soundEnabled: true, soundVolume: 0 });

    playUiSound("create");

    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("toca quando ativado com volume", async () => {
    const ctx = createMockContext("running");
    installContext(ctx);
    const { playUiSound, useUiStore } = await loadSoundModule();
    useUiStore.setState({ soundEnabled: true, soundVolume: 50 });

    playUiSound("backup");

    expect(ctx.createOscillator.mock.calls.length).toBeGreaterThan(0);
  });
});
