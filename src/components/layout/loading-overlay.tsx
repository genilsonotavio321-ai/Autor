"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { useProjectLoadStore } from "@/shared/store/project-load-store";
import { useUiStore } from "@/shared/store/ui-store";

/** Entrada depois de um instante: trocas rápidas não piscam a tela. */
const ENTER_DELAY_MS = 120;
const EXIT_MS = 180;
/** Nunca deixa a tela presa (alguma página pode não sinalizar prontidão). */
const SAFETY_MS = 4000;

interface LoadingScreenProps {
  visible?: boolean;
  label: string;
  description?: string;
}

/** Tela cheia de carregamento (apresentacional: boot e troca de projeto). */
export function LoadingScreen({
  visible = true,
  label,
  description,
}: LoadingScreenProps) {
  return (
    <div
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-md transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <Loader2 aria-hidden className="size-7 animate-spin text-primary" />
      <p className="font-serif text-lg tracking-tight">{label}</p>
      {description ? (
        <p className="max-w-xs text-center text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/** Overlay do shell: aparece enquanto o projeto selecionado carrega. */
export function LoadingOverlay() {
  const pendingProjectId = useProjectLoadStore(
    (state) => state.pendingProjectId,
  );
  const waiting = useProjectLoadStore((state) => state.waiting);
  const animationsEnabled = useUiStore((state) => state.animationsEnabled);
  const [present, setPresent] = useState(false);
  const [visible, setVisible] = useState(false);
  // Sem página que carregue dados do projeto (Configurações, Painel, Lixeira,
  // Projetos…) não há prontidão a esperar: o overlay não deve prender a tela.
  const active = pendingProjectId !== null && waiting > 0;

  // A troca pode vir de uma rota sem dados e navegar logo em seguida: dá um
  // instante para a página nova se registrar antes de descartar o pedido.
  useEffect(() => {
    if (!pendingProjectId || waiting > 0) return;
    const idle = window.setTimeout(
      () => useProjectLoadStore.getState().reset(),
      ENTER_DELAY_MS,
    );
    return () => window.clearTimeout(idle);
  }, [pendingProjectId, waiting]);

  useEffect(() => {
    if (active) {
      setPresent(true);
      const enter = window.setTimeout(() => setVisible(true), ENTER_DELAY_MS);
      const safety = window.setTimeout(
        () => useProjectLoadStore.getState().reset(),
        SAFETY_MS,
      );
      return () => {
        window.clearTimeout(enter);
        window.clearTimeout(safety);
      };
    }

    setVisible(false);
    const exit = window.setTimeout(
      () => setPresent(false),
      animationsEnabled ? EXIT_MS : 0,
    );
    return () => window.clearTimeout(exit);
  }, [active, animationsEnabled]);

  if (!present) return null;

  return (
    <LoadingScreen
      visible={visible}
      label="Carregando projeto…"
      description="Preparando capítulos, fichas e o manuscrito."
    />
  );
}
