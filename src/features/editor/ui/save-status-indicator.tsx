"use client";

import { Cloud } from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/dates";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveStatusIndicatorProps {
  status: SaveStatus;
  dirty: boolean;
  savedAt: string | null;
}

/** Selo discreto de autosave no canto do editor. */
export function SaveStatusIndicator({
  status,
  dirty,
  savedAt,
}: SaveStatusIndicatorProps) {
  return (
    <span
      data-testid="save-status"
      aria-live="polite"
      className="pointer-events-none absolute bottom-2 left-2 z-10 inline-flex items-center rounded-full bg-card/80 px-2 py-1 backdrop-blur-sm"
    >
      <Cloud
        aria-hidden
        className={`size-3.5 ${
          status === "saving"
            ? "animate-pulse text-foreground"
            : status === "error"
              ? "text-destructive"
              : dirty || !savedAt
                ? "text-muted-foreground/50"
                : "text-foreground"
        }`}
      />
      <span className="sr-only">
        {status === "saving"
          ? "Salvando…"
          : status === "error"
            ? "Erro ao salvar"
            : savedAt
              ? `Salvo ${formatRelativeTime(savedAt)}`
              : "Nenhuma alteração ainda"}
      </span>
    </span>
  );
}
