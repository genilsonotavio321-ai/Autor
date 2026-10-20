import { useUiStore } from "@/shared/store/ui-store";

export type SoundKind =
  | "click"
  | "sprintStart"
  | "sprintEnd"
  | "delete"
  | "create"
  | "backup"
  | "open"
  | "close"
  | "save"
  | "restore"
  | "toggle"
  | "warn";

let context: AudioContext | null = null;

// Sons primários (ações do app) engolem um "click" logo em seguida e se
// repetem dentro da janela — evita sobreposição/duplicação em ações rápidas.
const PRIMARY_DEBOUNCE_MS = 300;
let lastPrimaryAt = 0;
let lastPrimaryKind: SoundKind | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!context) context = new Ctor();
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
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  // Lowpass suaviza a aresta do waveform (menos "bip" seco).
  filter.type = "lowpass";
  filter.frequency.value = 2500;
  const at = ctx.currentTime + start;
  // Ataque rápido (~10ms) em vez de pico instantâneo.
  const attack = Math.min(0.01, duration / 4);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(gainValue, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  oscillator.connect(filter).connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration);
}

type ToneSpec = [
  frequency: number,
  start: number,
  duration: number,
  gain: number,
  type?: OscillatorType,
];

// Cada efeito é uma sequência de tons sintetizados (sem arquivos de áudio).
const SEQUENCES: Record<SoundKind, ToneSpec[]> = {
  // "Marimba" suave: nota base + nota aguda sobreposta, decaimento rápido.
  click: [
    [880, 0, 0.08, 0.064, "triangle"],
    [1320, 0.03, 0.08, 0.04, "triangle"],
  ],
  // Arpejo ascendente: dar energia sem gritar.
  sprintStart: [
    [660, 0, 0.12, 0.056, "triangle"],
    [880, 0.09, 0.15, 0.064, "triangle"],
  ],
  // Chime descendente: conclusão calma.
  sprintEnd: [
    [880, 0, 0.2, 0.096, "sine"],
    [660, 0.18, 0.35, 0.08, "sine"],
  ],
  // Nota grave e curta: item sumiu, nada de alarde.
  delete: [[330, 0, 0.1, 0.048, "triangle"]],
  // Terça maior ascendente: criação com warmth.
  create: [
    [660, 0, 0.12, 0.064, "sine"],
    [880, 0.1, 0.2, 0.064, "sine"],
  ],
  // Chime duplo tipo sino.
  backup: [
    [1046.5, 0, 0.25, 0.064, "sine"],
    [1318.5, 0.15, 0.35, 0.064, "sine"],
  ],
  // Abertura: curto e ascendente.
  open: [
    [784, 0, 0.07, 0.05, "triangle"],
    [1046.5, 0.05, 0.1, 0.05, "triangle"],
  ],
  // Fechamento: espelho do open (descendente).
  close: [
    [1046.5, 0, 0.07, 0.05, "triangle"],
    [784, 0.05, 0.1, 0.05, "triangle"],
  ],
  // Edição salva: dois tons redondos, mais morno que o create.
  save: [
    [880, 0, 0.1, 0.055, "sine"],
    [1174.7, 0.07, 0.16, 0.05, "sine"],
  ],
  // Desfazer do delete: mesma nota grave subindo.
  restore: [
    [330, 0, 0.07, 0.04, "triangle"],
    [660, 0.06, 0.13, 0.05, "triangle"],
  ],
  // Toggle: micro-nota, quase um toque.
  toggle: [[740, 0, 0.06, 0.05, "triangle"]],
  // Aviso: quinta grave, dois tons — alerta sem ser agressivo.
  warn: [
    [220, 0, 0.18, 0.08, "sine"],
    [330, 0.16, 0.28, 0.08, "sine"],
  ],
};

function schedule(kind: SoundKind, volume: number) {
  const ctx = getContext();
  if (!ctx) return;
  for (const [frequency, start, duration, gain, type] of SEQUENCES[kind]) {
    tone(ctx, frequency, start, duration, gain * volume, type);
  }
}

function isSuppressed(kind: SoundKind): boolean {
  const elapsed = Date.now() - lastPrimaryAt;
  if (elapsed >= PRIMARY_DEBOUNCE_MS) return false;
  // Click some segundos depois de qualquer ação primária.
  if (kind === "click") return true;
  // Primário repetido em sequência rápida (ex.: loop de exclusões).
  return lastPrimaryKind === kind;
}

/** Efeitos sonoros gerados por WebAudio (sem arquivos de áudio). */
export function playSound(kind: SoundKind, volumePercent: number): void {
  const ctx = getContext();
  if (!ctx) return;
  const volume = Math.min(100, Math.max(0, volumePercent)) / 100;
  if (volume === 0) return;
  if (isSuppressed(kind)) return;
  if (kind !== "click") {
    lastPrimaryAt = Date.now();
    lastPrimaryKind = kind;
  }
  if (ctx.state !== "running") {
    // iOS/Safari: resume() é assíncrono; osciladores agendados antes disso
    // disparam com o contexto suspenso e o som sai mudo.
    void ctx.resume().then(() => schedule(kind, volume));
    return;
  }
  schedule(kind, volume);
}

/** Toca o efeito se o usuário ativou som nas configurações. */
export function playUiSound(kind: SoundKind): void {
  const { soundEnabled, soundVolume } = useUiStore.getState();
  if (!soundEnabled) return;
  playSound(kind, soundVolume);
}

/**
 * Clique global em botões/links. Silenciado logo após uma ação primária para
 * não sobrepor (ex.: salvar toca "save" e o click do botão some).
 */
export function playClickSound(): void {
  const { soundEnabled, soundVolume } = useUiStore.getState();
  if (!soundEnabled) return;
  playSound("click", soundVolume);
}
