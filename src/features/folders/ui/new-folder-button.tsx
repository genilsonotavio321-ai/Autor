"use client";

import { Folder as FolderIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { playUiSound } from "@/shared/lib/sound";
import type { EntityId, Folder, FolderKind } from "@/shared/types/database";

import { folderRepository } from "../infra/dexie-folder-repository";

interface NewFolderButtonProps {
  kind: FolderKind;
  projectId: EntityId | null;
  /** Onde criar (pasta aberta atual), quando dentro de uma pasta. */
  parentId?: EntityId;
  disabled?: boolean;
  onCreated?: (folder: Folder) => void;
}

/**
 * Cria pastas vazias sem precisar arrastar dois cards (o gesto continua
 * funcionando). A pasta entra na ordem do tipo e pode ser renomeada na hora
 * pelo próprio FolderCard.
 */
export function NewFolderButton({
  kind,
  projectId,
  parentId,
  disabled,
  onCreated,
}: NewFolderButtonProps) {
  async function create() {
    if (!projectId) return;
    try {
      const folder = await folderRepository.create({
        projectId,
        kind,
        ...(parentId ? { parentId } : {}),
      });
      playUiSound("create");
      onCreated?.(folder);
    } catch {
      toast.error("Falha ao criar a pasta");
    }
  }
  const disabledForReal = Boolean(disabled) || !projectId;
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={disabledForReal}
      aria-label="Nova pasta"
      title="Nova pasta"
      onClick={() => void create()}
    >
      <FolderIcon aria-hidden />
    </Button>
  );
}
