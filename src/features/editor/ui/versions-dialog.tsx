"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { RotateCcw, Trash2 } from "lucide-react";
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
import type { Version } from "@/shared/types/database";

import { listVersions } from "../application/version-service";
import { versionRepository } from "../infra/dexie-version-repository";

interface VersionsDialogProps {
  chapterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (version: Version) => void;
}

export function VersionsDialog({
  chapterId,
  open,
  onOpenChange,
  onRestore,
}: VersionsDialogProps) {
  const versions = useLiveQuery(
    () => listVersions(chapterId),
    [chapterId, open],
    [] as Version[],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Versões do capítulo</DialogTitle>
          <DialogDescription>
            Instantâneos automáticos (a cada 5 minutos) e salvamentos manuais.
          </DialogDescription>
        </DialogHeader>
        {versions.length === 0 ? (
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
                  onClick={() => onRestore(version)}
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
