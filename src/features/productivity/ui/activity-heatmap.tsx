"use client";

import { useMemo } from "react";

import {
  chunkWeeks,
  type ActivityDay,
  type ActivityLevel,
} from "../domain/activity-chart";

/** Cores por nível — opacidades crescentes da cor primária. */
const LEVEL_CLASS: Record<ActivityLevel, string> = {
  0: "bg-muted",
  1: "bg-primary/25",
  2: "bg-primary/50",
  3: "bg-primary/75",
  4: "bg-primary",
};

const WEEKDAY_LABELS: Record<number, string> = {
  0: "Seg",
  2: "Qua",
  4: "Sex",
};

const CELL_SIZE = "size-2.5 rounded-[3px]";

function formatDayLabel(day: ActivityDay): string {
  const formatted = day.date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
  });
  if (day.words > 0) {
    return `${formatted}: ${day.words.toLocaleString("pt-BR")} palavras`;
  }
  return `${formatted}: sem escrita`;
}

/**
 * Gráfico de calor (estilo GitHub) da atividade de escrita — colunas são
 * semanas (segunda a domingo), linhas são dias da semana. Cada célula usa um
 * tom da cor primária conforme a relação com a meta diária.
 */
export function ActivityHeatmap({
  days,
}: {
  days: ActivityDay[];
}) {
  const weeks = useMemo(() => chunkWeeks(days), [days]);

  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">Atividade recente</p>
      <div className="mt-3 flex gap-1.5">
        {/* Rótulos de dia da semana (Seg/Qua/Sex) à esquerda. */}
        <div className="mr-1 flex flex-col justify-between py-[1px]">
          {Array.from({ length: 7 }, (_, row) => (
            <span
              key={row}
              className="flex h-2.5 items-center text-[9px] leading-none text-muted-foreground"
            >
              {WEEKDAY_LABELS[row] ?? ""}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex flex-col gap-1">
              {Array.from({ length: 7 }, (_, row) => {
                const day = week[row];
                if (!day) {
                  // Célula futura da semana corrente.
                  return (
                    <span
                      key={row}
                      aria-hidden
                      className={`${CELL_SIZE} border border-dashed border-muted-foreground/20`}
                    />
                  );
                }
                return (
                  <span
                    key={row}
                    className={`${CELL_SIZE} ${LEVEL_CLASS[day.level]}`}
                    title={formatDayLabel(day)}
                    aria-label={formatDayLabel(day)}
                    role="img"
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[9px] text-muted-foreground">
        <span>Menos</span>
        {([0, 1, 2, 3, 4] as ActivityLevel[]).map((level) => (
          <span key={level} className={`${CELL_SIZE} ${LEVEL_CLASS[level]}`} />
        ))}
        <span>Mais</span>
      </div>
    </div>
  );
}
