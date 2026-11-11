/**
 * Atividade de escrita para o gráfico de calor do Painel (Fase 7.3).
 * Funções puras sobre o `WritingLog` já persistido — sem tocar em infra.
 */

import { toDayKey, type WritingLog } from "./writing-log";

export type ActivityLevel = 0 | 1 | 2 | 3 | 4;

export interface ActivityDay {
  /** Chave local YYYY-MM-DD (mesma de `WritingLog`). */
  dayKey: string;
  date: Date;
  words: number;
  level: ActivityLevel;
}

/** Quantidade de semanas (colunas) exibidas por padrão. */
export const DEFAULT_ACTIVITY_WEEKS = 12;

/**
 * Classifica um dia em 5 níveis (0–4) pela relação com a meta diária.
 * Sem meta (goal ≤ 0), qualquer escrita vira nível 1.
 */
export function activityLevel(words: number, goal: number): ActivityLevel {
  if (words <= 0) return 0;
  if (goal <= 0) return 1;
  const ratio = words / goal;
  if (ratio < 0.5) return 1;
  if (ratio < 1) return 2;
  if (ratio < 2) return 3;
  return 4;
}

/** Segunda-feira (00:00 local) da semana que contém `date`. */
export function startOfWeekMonday(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const weekday = copy.getDay(); // 0=Dom .. 6=Sáb
  const daysSinceMonday = (weekday + 6) % 7;
  copy.setDate(copy.getDate() - daysSinceMonday);
  return copy;
}

/**
 * Dias da atividade do gráfico, em ordem cronológica (mais antigo primeiro),
 * alinhados por semana (segunda a domingo). O intervalo termina em `today` e
 * cobre `weeks` colunas; a última coluna pode estar parcial (dias futuros da
 * semana corrente ainda não aconteceram).
 */
export function buildActivityDays(
  log: WritingLog,
  today: Date,
  weeks: number = DEFAULT_ACTIVITY_WEEKS,
  goal = 0,
): ActivityDay[] {
  const safeWeeks = Math.max(1, Math.floor(weeks));
  const start = startOfWeekMonday(today);
  start.setDate(start.getDate() - (safeWeeks - 1) * 7);

  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  const days: ActivityDay[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const dayKey = toDayKey(cursor);
    const words = log[dayKey]?.words ?? 0;
    days.push({
      dayKey,
      date: new Date(cursor),
      words,
      level: activityLevel(words, goal),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * Agrupa dias consecutivos (segunda-primeiro) em colunas semanais de 7 células.
 * A última coluna pode ser menor; o chamador preenche o restante como futuro.
 */
export function chunkWeeks(days: ActivityDay[]): ActivityDay[][] {
  const columns: ActivityDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }
  return columns;
}
