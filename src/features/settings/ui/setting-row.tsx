"use client";

import { Label } from "@/components/ui/label";

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

/** Linha de ajuste: rótulo (e descrição) à esquerda, controle à direita. */
export function SettingRow({
  label,
  description,
  htmlFor,
  children,
}: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={htmlFor}>{label}</Label>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
