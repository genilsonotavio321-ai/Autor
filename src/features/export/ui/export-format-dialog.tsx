"use client";

import { FileDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** File formats offered when sharing a piece of writing. */
export type ExportFormat = "txt" | "md" | "pdf" | "docx";

const FORMAT_OPTIONS: Array<{
  value: ExportFormat;
  label: string;
  description: string;
}> = [
  {
    value: "txt",
    label: "Texto simples (.txt)",
    description: "Somente o texto, sem formatação.",
  },
  {
    value: "md",
    label: "Markdown (.md)",
    description: "Títulos e formatação em Markdown.",
  },
  {
    value: "docx",
    label: "Word (.docx)",
    description: "Documento do Word, com estilos de título.",
  },
  {
    value: "pdf",
    label: "PDF (.pdf)",
    description: "Pronto para ler, compartilhar ou imprimir.",
  },
];

/** Formats every dialog offers by default (Word is opt-in per caller). */
const DEFAULT_FORMATS: ExportFormat[] = ["txt", "md", "pdf"];

interface ExportFormatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Downloads the content in the chosen format (toasts belong to the caller). */
  onExport: (format: ExportFormat) => void;
  title?: string;
  description?: string;
  /** Restricts the offered formats (order follows `FORMAT_OPTIONS`). */
  formats?: ExportFormat[];
}

export function ExportFormatDialog({
  open,
  onOpenChange,
  onExport,
  title = "Compartilhar capítulo",
  description = "Escolha o formato do arquivo para baixar.",
  formats = DEFAULT_FORMATS,
}: ExportFormatDialogProps) {
  const options = FORMAT_OPTIONS.filter((option) =>
    formats.includes(option.value),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 py-3 text-left"
              onClick={() => {
                onOpenChange(false);
                onExport(option.value);
              }}
            >
              <span className="flex items-center gap-2 font-medium">
                <FileDown aria-hidden className="size-4" />
                {option.label}
              </span>
              <span className="text-xs text-muted-foreground">
                {option.description}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
