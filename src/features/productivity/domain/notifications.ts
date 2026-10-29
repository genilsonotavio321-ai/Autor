import { MS_DAY } from "@/shared/store/ui-store";

/** Tipos de aviso: meta do dia e criação parada (personagem/cena/capítulo). */
export type NotificationKind = "goal" | "character" | "scene" | "chapter";

export interface NotificationDecision {
  kind: NotificationKind;
  body: string;
}

export type StaleFlags = {
  character: boolean;
  scene: boolean;
  chapter: boolean;
};

const KIND_LABELS: Record<"character" | "scene" | "chapter", string> = {
  character: "personagem",
  scene: "cena",
  chapter: "capítulo",
};

/** Maior `createdAt` não-nulo de uma coleção. */
export function latestCreatedAt(
  dates: (string | undefined | null)[],
): string | undefined {
  let latest: string | undefined;
  for (const date of dates) {
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

/**
 * Meta não batida hoje: só avisa a partir das 19h locais — de manhã é
 * natural ainda não ter escrito, e o aviso viraria ruído em toda abertura.
 */
export function decideGoalNotification(
  wordsToday: number,
  goal: number,
  now: Date,
): NotificationDecision | null {
  if (goal <= 0) return null;
  if (wordsToday >= goal) return null;
  if (now.getHours() < 19) return null;
  return {
    kind: "goal",
    body: `Você ainda não bateu a meta de ${goal} palavras hoje.`,
  };
}

/**
 * Está há `days` ou mais dias sem criar uma ficha/cena/capítulo novo?
 * Só avisa se já existe pelo menos um item do tipo (sem referência não dá
 * para medir "parado") e se a flag correspondente estiver ligada.
 */
export function decideStaleNotifications(
  latest: Partial<Record<"character" | "scene" | "chapter", string | undefined>>,
  days: number,
  now: Date,
  flags: StaleFlags,
): NotificationDecision[] {
  const results: NotificationDecision[] = [];
  const minAge = Math.max(days, 0) * MS_DAY;
  for (const kind of ["character", "scene", "chapter"] as const) {
    if (!flags[kind]) continue;
    const createdAt = latest[kind];
    if (!createdAt) continue;
    const created = Date.parse(createdAt);
    if (Number.isNaN(created)) continue;
    if (now.getTime() - created < minAge) continue;
    const plural = days === 1 ? "dia" : "dias";
    results.push({
      kind,
      body: `Você está há ${days} ou mais ${plural} sem criar um ${KIND_LABELS[kind]} novo.`,
    });
  }
  return results;
}
