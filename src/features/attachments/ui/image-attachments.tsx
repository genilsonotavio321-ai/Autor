"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { readImageAsDataUrl } from "@/features/editor/domain/image-file";
import type { AttachmentEntityType, EntityId } from "@/shared/types/database";

import { attachmentRepository } from "../infra/dexie-attachment-repository";
import { ImageLightbox } from "./image-lightbox";

interface ImageAttachmentsProps {
  entityType: AttachmentEntityType;
  /** Null while the entity is being created (no id yet) — renders nothing. */
  entityId: EntityId | null | undefined;
  /** Required to upload; read-only galleries omit it. */
  projectId?: EntityId | null;
  /** Thumbnails only, without add/remove controls (view dialogs). */
  readOnly?: boolean;
}

/**
 * Anexos de imagem de notas/fichas/eventos (Fase 2B): botão de anexar +
 * miniaturas com remoção. Capítulos usam imagens inline no editor (Fase 2A).
 */
export function ImageAttachments({
  entityType,
  entityId,
  projectId,
  readOnly = false,
}: ImageAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<{
    src: string;
    name?: string | null;
  } | null>(null);

  const attachments = useLiveQuery(
    () =>
      entityId
        ? attachmentRepository.listByEntity(entityType, entityId)
        : Promise.resolve([]),
    [entityType, entityId],
  );

  if (!entityId) return null;

  async function addFiles(files: FileList | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0 || !projectId || !entityId) return;
    setUploading(true);
    try {
      for (const file of list) {
        const dataUrl = await readImageAsDataUrl(file);
        await attachmentRepository.add({
          projectId,
          entityType,
          entityId,
          dataUrl,
          name: file.name,
        });
      }
      toast.success(
        list.length === 1 ? "Imagem anexada" : `${list.length} imagens anexadas`,
      );
    } catch {
      toast.error("Não foi possível anexar a imagem");
    } finally {
      setUploading(false);
    }
  }

  const list = attachments ?? [];
  if (readOnly && list.length === 0) return null;

  return (
    <div className="grid gap-2">
      {readOnly ? null : (
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Imagens</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus aria-hidden />
            Anexar
          </Button>
        </div>
      )}
      {list.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {list.map((attachment) => (
            <div key={attachment.id} className="group relative">
              <button
                type="button"
                className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Ampliar ${attachment.name ?? "imagem anexada"}`}
                onClick={() =>
                  setLightbox({
                    src: attachment.dataUrl,
                    name: attachment.name,
                  })
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- dataURL local; next/image não se aplica */}
                <img
                  src={attachment.dataUrl}
                  alt={attachment.name ?? "Imagem anexada"}
                  className="size-20 rounded-md border object-cover"
                />
              </button>
              {readOnly ? null : (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon-sm"
                  className="absolute top-0.5 right-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                  aria-label="Remover imagem"
                  onClick={(event) => {
                    event.stopPropagation();
                    void attachmentRepository.remove(attachment.id);
                  }}
                >
                  <X aria-hidden />
                </Button>
              )}
            </div>
          ))}
        </div>
      ) : readOnly ? null : (
        <p className="text-xs text-muted-foreground">Nenhuma imagem anexada.</p>
      )}
      {readOnly ? null : (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      )}
      <ImageLightbox
        open={lightbox !== null}
        onOpenChange={(open) => {
          if (!open) setLightbox(null);
        }}
        src={lightbox?.src ?? ""}
        name={lightbox?.name}
      />
    </div>
  );
}
