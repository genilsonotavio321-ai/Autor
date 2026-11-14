"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface MentionConfirmDialogProps {
  open: boolean;
  name: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onDontAskAgain: () => void;
}

/** Aviso ao toque em um nome destacado (pode ser desativado nas configurações). */
export function MentionConfirmDialog({
  open,
  name,
  onOpenChange,
  onConfirm,
  onDontAskAgain,
}: MentionConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Abrir a ficha de {name || "destaque"}?</AlertDialogTitle>
          <AlertDialogDescription>
            Toque no nome destacado para abrir. Você pode desativar este aviso
            nas configurações.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Abrir</AlertDialogAction>
          <AlertDialogAction onClick={onDontAskAgain}>
            Não perguntar de novo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
