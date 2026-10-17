/**
 * Per-day writing activity (plan §7.5): palavras por dia, sprints e streak.
 * Persistido como um único valor JSON na tabela `settings` do Dexie,
 * portanto não exige bump de schema.
 */

export type DayActivity = {
  /** Palavras líquidas escritas no dia (apenas deltas positivos). */
  words: number;
  /** Sessões de sprint concluídas no dia. */
  sprints: number;
};

export type WritingLog = Record<string, DayActivity>;

export const EMPTY_WRITING_LOG: WritingLog = {};

/** Quantidade de dias considerados em "esta semana". */
export const WEEK_LENGTH_DAYS = 7;

/** Velocidade média de leitura usada para estimar tempo de leitura. */
export const ESTIMATED_READING_WPM = 200;

/** Chave de dia local (YYYY-MM-DD) — usa o fuso local, não UTC. */
export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addWords(
  log: WritingLog,
  dayKey: string,
  words: number,
): WritingLog {
  if (words <= 0) return log;
  const current = log[dayKey] ?? { words: 0, sprints: 0 };
  return { ...log, [dayKey]: { ...current, words: current.words + words } };
}

export function addSprint(log: WritingLog, dayKey: string): WritingLog {
  const current = log[dayKey] ?? { words: 0, sprints: 0 };
  return { ...log, [dayKey]: { ...current, sprints: current.sprints + 1 } };
}

export interface WritingSummary {
  today: number;
  week: number;
  /** Dias consecutivos com escrita, terminando hoje (ou ontem, se hoje ainda vazio). */
  streak: number;
  total: number;
  sprintsToday: number;
}

export function summariseWriting(
  log: WritingLog,
  today: Date,
): WritingSummary {
  const todayKey = toDayKey(today);
  let week = 0;
  for (let offset = 0; offset < WEEK_LENGTH_DAYS; offset += 1) {
    week += log[toDayKey(shiftDays(today, -offset))]?.words ?? 0;
  }

  let streak = 0;
  let cursor = today;
  // Hoje pode ainda estar vazio sem quebrar a sequência em andamento.
  if ((log[todayKey]?.words ?? 0) === 0) cursor = shiftDays(today, -1);
  while ((log[toDayKey(cursor)]?.words ?? 0) > 0) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }

  const total = Object.values(log).reduce((sum, day) => sum + day.words, 0);
  return {
    today: log[todayKey]?.words ?? 0,
    week,
    streak,
    total,
    sprintsToday: log[todayKey]?.sprints ?? 0,
  };
}

/** Tempo estimado de leitura em minutos (arredondado para cima). */
export function estimateReadingMinutes(words: number): number {
  if (words <= 0) return 0;
  return Math.ceil(words / ESTIMATED_READING_WPM);
}
