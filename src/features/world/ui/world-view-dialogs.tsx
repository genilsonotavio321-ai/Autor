"use client";

import { formatRelativeTime } from "@/shared/lib/dates";
import { EntityViewDialog } from "@/shared/ui/entity-view-dialog";
import type { Location, LoreEntry } from "@/shared/types/database";

import { ImageAttachments } from "@/features/attachments/ui/image-attachments";

/** Ficha somente leitura de um local (deep link `&view=1`). */
export function LocationViewDialog({
  location,
  locations,
  onEdit,
  onTrash,
  onClose,
}: {
  location: Location | null;
  locations: Location[];
  onEdit: (location: Location) => void;
  onTrash: (location: Location) => void;
  onClose: () => void;
}) {
  return (
    <EntityViewDialog
      open={location !== null}
      title={location?.name ?? ""}
      subtitle={
        location
          ? `Atualizado ${formatRelativeTime(location.updatedAt)}`
          : undefined
      }
      sections={
        location
          ? [
              { label: "Tipo", value: location.type },
              {
                label: "Ficha-mãe",
                value:
                  locations.find((item) => item.id === location.parentId)
                    ?.name ?? "",
              },
              { label: "Descrição", value: location.description ?? "" },
            ].filter((section) => section.value.length > 0)
          : []
      }
      onEdit={() => {
        if (location) onEdit(location);
      }}
      onTrash={() => {
        if (location) onTrash(location);
      }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      gallery={
        <ImageAttachments
          readOnly
          entityType="location"
          entityId={location?.id}
        />
      }
    />
  );
}

/** Ficha somente leitura de uma entrada de lore (ou objeto). */
export function LoreViewDialog({
  entry,
  onEdit,
  onClose,
}: {
  entry: LoreEntry | null;
  onEdit: (entry: LoreEntry) => void;
  onClose: () => void;
}) {
  return (
    <EntityViewDialog
      open={entry !== null}
      title={entry?.title ?? ""}
      subtitle={
        entry ? `Atualizada ${formatRelativeTime(entry.updatedAt)}` : undefined
      }
      sections={
        entry
          ? [
              { label: "Categoria", value: entry.category },
              {
                label: "Conteúdo",
                value: typeof entry.content === "string" ? entry.content : "",
              },
            ].filter((section) => section.value.length > 0)
          : []
      }
      onEdit={() => {
        if (entry) onEdit(entry);
      }}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      gallery={
        <ImageAttachments readOnly entityType="lore" entityId={entry?.id} />
      }
    />
  );
}
