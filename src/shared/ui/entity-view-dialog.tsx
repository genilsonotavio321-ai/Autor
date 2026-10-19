"use client";

import type { ReactNode } from "react";
import { Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface EntityViewSection {
  label: string;
  value: string;
}

interface EntityViewDialogProps {
  open: boolean;
  title: string;
  subtitle?: string;
  sections: EntityViewSection[];
  onEdit: () => void;
  /** Mostra o ícone de lixeira ao lado do editar (exclusão). */
  onTrash?: () => void;
  onOpenChange: (open: boolean) => void;
  /** Optional element floating over the sheet (e.g. "Voltar ao texto"). */
  floatingAction?: ReactNode;
}

/**
 * Read-only view shared by the fichas (personagem, local e lore): the cards
 * open here first, with an "Editar" action that switches to the form.
 */
export function EntityViewDialog({
  open,
  title,
  subtitle,
  sections,
  onEdit,
  onTrash,
  onOpenChange,
  floatingAction,
}: EntityViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" showCloseButton={false}>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            aria-label="Editar"
            title="Editar"
          >
            <Pencil aria-hidden />
          </Button>
          {onTrash ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onTrash}
              aria-label="Excluir"
              title="Excluir"
            >
              <Trash2 aria-hidden />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            title="Fechar"
          >
            <X aria-hidden />
          </Button>
        </div>
        <DialogHeader className="pr-20">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[60vh] gap-4 overflow-y-auto rounded-md border bg-muted/30 p-4">
          {sections.length === 0 ? (
            <p className="text-sm italic text-muted-foreground">
              Sem informações ainda.
            </p>
          ) : (
            sections.map((section) => (
              <div key={section.label} className="grid gap-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {section.label}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {section.value}
                </p>
              </div>
            ))
          )}
        </div>
        {floatingAction}
      </DialogContent>
    </Dialog>
  );
}
