"use client";

import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  onOpenChange,
  floatingAction,
}: EntityViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
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
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onEdit}>
            Editar
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
        {floatingAction}
      </DialogContent>
    </Dialog>
  );
}
