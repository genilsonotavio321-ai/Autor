export type SoundKind = "click" | "complete";

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gainValue: number,
  type: OscillatorType = "sine",
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(gainValue, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    ctx.currentTime + start + duration,
  );
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(ctx.currentTime + start);
  oscillator.stop(ctx.currentTime + start + duration);
}

/** Efeitos sonoros gerados por WebAudio (sem arquivos de áudio). */
export function playSound(kind: SoundKind, volumePercent: number): void {
  const ctx = getContext();
  if (!ctx) return;
  const volume = Math.min(100, Math.max(0, volumePercent)) / 100;
  if (volume === 0) return;
  if (kind === "click") {
    tone(ctx, 660, 0, 0.05, 0.12 * volume, "square");
  } else {
    tone(ctx, 880, 0, 0.18, 0.2 * volume);
    tone(ctx, 1175, 0.15, 0.3, 0.2 * volume);
  }
}
