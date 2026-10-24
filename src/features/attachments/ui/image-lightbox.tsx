"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

/** Amplia uma miniatura de anexo (fase 3). */
export function ImageLightbox({
  open,
  onOpenChange,
  src,
  name,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  name?: string | null;
}) {
  const alt = name ?? "Imagem anexada";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">
          Imagem ampliada. Feche para voltar.
        </DialogDescription>
        {/* eslint-disable-next-line @next/next/no-img-element -- dataURL local; next/image não se aplica */}
        <img src={src} alt={alt} className="max-h-[85vh] w-full object-contain" />
      </DialogContent>
    </Dialog>
  );
}
