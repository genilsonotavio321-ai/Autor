"use client";

import { Cloud } from "lucide-react";

import { formatRelativeTime } from "@/shared/lib/dates";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export interface SaveStatusIndicatorProps {
  status: SaveStatus;
  dirty: boolean;
  savedAt: string | null;
}

/** Ícone de autosave do editor (fica ao lado do status do capítulo). */
export function SaveStatusIndicator({
  status,
  dirty,
  savedAt,
}: SaveStatusIndicatorProps) {
  return (
    <span
      data-testid="save-status"
      aria-live="polite"
      title={
        status === "saving"
          ? "Salvando…"
          : status === "error"
            ? "Erro ao salvar"
            : savedAt
              ? `Salvo ${formatRelativeTime(savedAt)}`
              : "Nenhuma alteração ainda"
      }
      className="inline-flex size-8 items-center justify-center rounded-full border border-border/70 text-muted-foreground"
    >
      <Cloud
        aria-hidden
        className={`size-4 ${
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
