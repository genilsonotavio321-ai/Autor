/**
 * Efeitos sonoros removidos no rework (design silencioso).
 * A API é mantida para não quebrar as chamadas existentes nos componentes.
 */
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

export function playSound(_kind: SoundKind, _volumePercent: number): void {}

export function playUiSound(_kind: SoundKind): void {}

export function playClickSound(): void {}
