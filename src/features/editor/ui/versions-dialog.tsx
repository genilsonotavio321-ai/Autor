"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { ArrowLeft, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatDateTime } from "@/shared/lib/dates";
import type { Json, Version } from "@/shared/types/database";

import { diffDocAgainstSnapshot, type DiffLine } from "../domain/version-diff";
import { listVersions } from "../application/version-service";
import { versionRepository } from "../infra/dexie-version-repository";

interface VersionsDialogProps {
  chapterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: Version) => void;
  /** Live editor content, used to preview the diff before restoring. */
  getCurrentContent: () => Json | null;
}

const DIFF_LINE_CLASSES: Record<DiffLine["type"], string> = {
  same: "text-muted-foreground",
  removed:
    "border-l-2 border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  added:
    "border-l-2 border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const DIFF_LINE_PREFIX: Record<DiffLine["type"], string> = {
  same: "  ",
  removed: "− ",
  added: "+ ",
};

export function VersionsDialog({
  chapterId,
  open,
  onOpenChange,
  onRestore,
  getCurrentContent,
}: VersionsDialogProps) {
  const versions = useLiveQuery(
    () => listVersions(chapterId),
    [chapterId, open],
    [] as Version[],
  );
  const [preview, setPreview] = useState<{
    version: Version;
    lines: DiffLine[];
  } | null>(null);

  function requestRestore(version: Version) {
    const lines = diffDocAgainstSnapshot(getCurrentContent(), version.snapshot);
    // Identical content — restoring is a no-op, go straight through.
    if (lines.every((line) => line.type === "same")) {
      onRestore(version);
      return;
    }
    setPreview({ version, lines });
  }

  function confirmRestore() {
    if (!preview) return;
    onRestore(preview.version);
    setPreview(null);
  }

  function close() {
    setPreview(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {preview ? "Confirmar restauração" : "Versões do capítulo"}
          </DialogTitle>
          <DialogDescription>
            {preview
              ? "Verifique o que muda ao restaurar esta versão."
              : "Instantâneos automáticos (a cada 5 minutos) e salvamentos manuais."}
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Comparando com {formatDateTime(preview.version.createdAt)}
                {preview.version.label ? ` · ${preview.version.label}` : ""}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreview(null)}
              >
                <ArrowLeft aria-hidden />
                Voltar
              </Button>
            </div>
            <ul className="max-h-80 space-y-px overflow-y-auto rounded-md border p-2 font-mono text-xs">
              {preview.lines.map((line, index) => (
                <li
                  key={index}
                  className={`whitespace-pre-wrap break-words px-1 py-0.5 ${DIFF_LINE_CLASSES[line.type]}`}
                >
                  {DIFF_LINE_PREFIX[line.type]}
                  {line.block.text || "¶"}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600 dark:text-red-400">−</span> removido
              · <span className="text-emerald-600 dark:text-emerald-400">+</span>{" "}
              recuperado da versão
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancelar
              </Button>
              <Button onClick={confirmRestore}>
                <RotateCcw aria-hidden />
                Confirmar restauração
              </Button>
            </div>
          </div>
        ) : versions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma versão ainda. Continue escrevendo para gerar instantâneos.
          </p>
        ) : (
          <ul className="max-h-80 divide-y overflow-y-auto">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {formatDateTime(version.createdAt)}
                    {version.label ? ` · ${version.label}` : ""}
                  </p>
                  <Badge variant="outline" className="mt-0.5 text-[10px]">
                    {version.auto ? "Automática" : "Manual"}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => requestRestore(version)}
                >
                  <RotateCcw aria-hidden />
                  Restaurar
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label="Excluir versão"
                  onClick={() => void versionRepository.delete(version.id)}
                >
                  <Trash2 aria-hidden className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Separator />
      </DialogContent>
    </Dialog>
  );
}
