"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { playSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";

import { toDayKey } from "../domain/writing-log";
import { recordSprint } from "../infra/writing-log-repository";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Sprint timer (plan §7.5): contagem regressiva para sessões de escrita.
 * Cada sprint concluído é registrado no log de escrita do dia.
 */
export function SprintTimer() {
  const sprintMinutes = useUiStore((state) => state.sprintMinutes);
  const duration = Math.max(1, sprintMinutes) * 60;

  const [remaining, setRemaining] = useState(duration);
  const [running, setRunning] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  // Keep the ready time in sync while the timer is not running.
  useEffect(() => {
    if (!running) setRemaining(duration);
  }, [duration, running]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining > 0) return;
    setRunning(false);
    setRemaining(duration);
    setCompleted((count) => count + 1);
    setAnnouncement("Sprint concluído. Faça uma pausa.");
    const { soundEnabled, soundVolume } = useUiStore.getState();
    if (soundEnabled) playSound("complete", soundVolume);
    toast.success("Sprint concluído!", {
      description: "Boa escrita. Faça uma pausa antes do próximo.",
    });
    void recordSprint(toDayKey(new Date())).catch(() => undefined);
  }, [remaining, duration]);

  function toggle() {
    setRunning((value) => {
      const next = !value;
      setAnnouncement(next ? "Sprint iniciado." : "Sprint pausado.");
      return next;
    });
  }

  function reset() {
    setRunning(false);
    setRemaining(duration);
    setAnnouncement("Sprint reiniciado.");
  }

  const progress = duration > 0 ? ((duration - remaining) / duration) * 100 : 0;

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
          onClick={toggle}
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
          onClick={reset}
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
