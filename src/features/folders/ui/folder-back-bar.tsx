"use client";

import { useDroppable } from "@dnd-kit/core";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

import { FOLDER_EXIT_ID } from "../application/folder-drag";

interface FolderBackBarProps {
  /** Nome da pasta aberta (exibido ao lado do botão). */
  title: string;
  onBack: () => void;
}

/**
 * Seta "voltar" exibida dentro de uma pasta: o clique navega para a pasta
 * pai; soltar um card ou pasta aqui move o item para a pasta pai.
 */
export function FolderBackBar({ title, onBack }: FolderBackBarProps) {
  const { setNodeRef, isOver } = useDroppable({ id: FOLDER_EXIT_ID });
  return (
    <div
      ref={setNodeRef}
      data-folder-exit={isOver || undefined}
      className={`flex items-center gap-3 rounded-lg border border-dashed p-2 pl-3 transition-colors ${
        isOver ? "border-primary bg-primary/5" : ""
      }`}
    >
      <Button variant="outline" size="sm" onClick={onBack}>
        <ArrowLeft aria-hidden />
        Voltar
      </Button>
      <span className="min-w-0 truncate text-sm text-muted-foreground">
        {isOver ? "Solte aqui para mover para fora da pasta" : title}
      </span>
    </div>
  );
}
