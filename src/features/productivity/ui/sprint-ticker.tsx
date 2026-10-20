"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { playSound } from "@/shared/lib/sound";
import { useUiStore } from "@/shared/store/ui-store";

import { toDayKey } from "../domain/writing-log";
import { recordSprint } from "../infra/writing-log-repository";

/**
 * Mantém o cronômetro de sprint contando mesmo com o SprintTimer desmontado
 * (navegação entre páginas, modo foco). Renderiza nada; montar uma vez no AppShell.
 */
export function SprintTicker() {
  const sprintMinutes = useUiStore((state) => state.sprintMinutes);
  const duration = Math.max(1, sprintMinutes) * 60;
  const running = useUiStore((state) => state.sprintRunning);
  const remaining = useUiStore((state) => state.sprintRemaining);

  // Sincroniza quando o usuário troca a duração; pausar não zera o restante.
  const prevDuration = useRef(duration);
  useEffect(() => {
    if (prevDuration.current === duration) return;
    prevDuration.current = duration;
    if (!useUiStore.getState().sprintRunning) {
      useUiStore.setState({ sprintRemaining: duration });
    }
  }, [duration]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      useUiStore.setState((state) => ({
        sprintRemaining: Math.max(0, state.sprintRemaining - 1),
      }));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (remaining > 0) return;
    useUiStore.getState().completeSprint();
    const { soundEnabled, soundVolume } = useUiStore.getState();
    if (soundEnabled) playSound("complete", soundVolume);
    toast.success("Sprint concluído!", {
      description: "Boa escrita. Faça uma pausa antes do próximo.",
    });
    void recordSprint(toDayKey(new Date())).catch(() => undefined);
  }, [remaining]);

  return null;
}
