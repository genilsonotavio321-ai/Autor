"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUiStore } from "@/shared/store/ui-store";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Sprint timer (plan §7.5): contagem regressiva para sessões de escrita.
 * Estado vive no ui-store (SprintTicker conta); aqui só a UI.
 * compact: variante enxuta para o Topbar (sem barra de progresso/reset).
 */
export function SprintTimer({ compact = false }: { compact?: boolean }) {
  const sprintMinutes = useUiStore((state) => state.sprintMinutes);
  const remaining = useUiStore((state) => state.sprintRemaining);
  const running = useUiStore((state) => state.sprintRunning);
  const completed = useUiStore((state) => state.sprintCompleted);
  const announcement = useUiStore((state) => state.sprintAnnouncement);
  const toggleSprintRunning = useUiStore((state) => state.toggleSprintRunning);
  const resetSprint = useUiStore((state) => state.resetSprint);

  const duration = Math.max(1, sprintMinutes) * 60;
  const progress = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;

  if (compact) {
    return (
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Cronômetro de sprint"
      >
        <span
          className="font-mono text-sm font-semibold tabular-nums"
          data-testid="sprint-timer"
        >
          {formatClock(remaining)}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={toggleSprintRunning}
          aria-label={running ? "Pausar sprint" : "Iniciar sprint"}
        >
          {running ? (
            <Pause aria-hidden className="size-3.5" />
          ) : (
            <Play aria-hidden className="size-3.5" />
          )}
        </Button>
        <span className="sr-only" aria-live="polite">
          {announcement}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-1.5"
      role="group"
      aria-label="Cronômetro de sprint"
    >
      <div className="flex items-center gap-2">
        <Timer aria-hidden className="size-4 text-muted-foreground" />
        <span
          className="font-mono text-base font-semibold tabular-nums"
          data-testid="sprint-timer"
        >
          {formatClock(remaining)}
        </span>
      </div>
      <div
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Progresso do sprint"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={toggleSprintRunning}
          aria-label={running ? "Pausar sprint" : "Iniciar sprint"}
        >
          {running ? (
            <Pause aria-hidden className="size-3.5" />
          ) : (
            <Play aria-hidden className="size-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={resetSprint}
          aria-label="Reiniciar sprint"
        >
          <RotateCcw aria-hidden className="size-3.5" />
        </Button>
      </div>
      {completed > 0 ? (
        <span
          className="text-xs text-muted-foreground"
          title="Sprints concluídos nesta sessão"
        >
          {completed}×
        </span>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
