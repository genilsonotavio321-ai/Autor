import { arrayMove } from "@dnd-kit/sortable";

import type { EntityId, Folder, FolderKind } from "@/shared/types/database";

import { collectSubtreeIds } from "../domain/folder-tree";
import { resolveDrop, type RectLike } from "../domain/drop-target";
import { createFolderWith } from "./folder-service";
import {
  folderRepository,
  setEntityFolderId,
} from "../infra/dexie-folder-repository";

/** Id da zona de drop da seta "voltar" — soltar nela tira a ficha (ou
 * pasta) da pasta atual e a devolve para a pasta pai. */
export const FOLDER_EXIT_ID = "folder-exit";

export type FolderDragOutcome =
  | "created" // pasta nova criada com os dois cards
  | "moved" // ficha entrou numa pasta existente
  | "nested" // pasta entrou dentro de outra pasta
  | "exited" // ficha/pasta saiu para a pasta pai (seta voltar)
  | "reordered" // pastas reordenadas entre si
  | "ignored" // combinação sem efeito (ex.: pasta sobre a própria filha)
  | "reorder"; // deixa a página reordenar as fichas (comportamento antigo)

/**
 * Resolve o fim de um arrasto numa página com pastas. Devolve "reorder"
 * quando a página deve aplicar a reordenação de fichas que já existia.
 */
export async function resolveFolderDragEnd(input: {
  kind: FolderKind;
  projectId: EntityId | null;
  /** Pastas vivas deste kind no projeto. */
  folders: Folder[];
  /** Pastas visíveis na pasta aberta, ordenadas. */
  viewFolderIds: EntityId[];
  openFolderId: EntityId | null;
  activeId: EntityId;
  overId: EntityId | undefined;
  activeRect: RectLike | null;
  overRect: RectLike | null;
}): Promise<FolderDragOutcome> {
  const { kind, folders, viewFolderIds, openFolderId } = input;
  const overId = input.overId;
  if (!overId || overId === input.activeId) return "ignored";

  const folderIds = new Set(viewFolderIds);
  const activeIsFolder = folderIds.has(input.activeId);

  if (overId === FOLDER_EXIT_ID) {
    const current = folders.find((folder) => folder.id === openFolderId);
    const parent =
      current?.parentId &&
      folders.some((folder) => folder.id === current.parentId)
        ? current.parentId
        : undefined;
    if (activeIsFolder) {
      await folderRepository.setParent(input.activeId, parent);
    } else {
      await setEntityFolderId(kind, input.activeId, parent);
    }
    return "exited";
  }

  const overIsFolder = folderIds.has(overId);

  if (activeIsFolder && overIsFolder) {
    if (resolveDrop(input.activeRect, input.overRect) === "into") {
      // Aninhar dentro da própria descendente criaria um ciclo — ignora.
      if (collectSubtreeIds(folders, input.activeId).includes(overId)) {
        return "ignored";
      }
      await folderRepository.setParent(input.activeId, overId);
      return "nested";
    }
    const reordered = arrayMove(
      viewFolderIds,
      viewFolderIds.indexOf(input.activeId),
      viewFolderIds.indexOf(overId),
    );
    await folderRepository.applyMoves(
      reordered.map((id, order) => ({ id, order })),
    );
    return "reordered";
  }

  if (overIsFolder) {
    await setEntityFolderId(kind, input.activeId, overId);
    return "moved";
  }

  if (activeIsFolder) return "ignored"; // pasta sobre ficha: nada sensato a fazer

  if (resolveDrop(input.activeRect, input.overRect) === "into") {
    if (!input.projectId) return "ignored";
    await createFolderWith({
      kind,
      projectId: input.projectId,
      ...(openFolderId ? { parentId: openFolderId } : {}),
      entityIds: [input.activeId, overId],
    });
    return "created";
  }
  return "reorder";
}

/** Modo do texto flutuante que segue o ponteiro durante um arrasto. */
export type FolderHintMode = "create" | "add" | "nested" | "exit" | null;

/**
 * Resolve o aviso a mostrar com base no alvo atual do arrasto: criar pasta
 * (zona central de um card), adicionar à pasta, aninhar pasta ou sair da
 * pasta (seta voltar). Puro — chamado no onDragOver da página e coberto
 * por teste.
 */
export function resolveHintMode(input: {
  viewFolderIds: EntityId[];
  activeId: EntityId;
  overId: EntityId | undefined;
  activeRect: RectLike | null;
  overRect: RectLike | null;
}): FolderHintMode {
  if (!input.overId || input.overId === input.activeId) return null;
  if (input.overId === FOLDER_EXIT_ID) return "exit";
  const activeIsFolder = input.viewFolderIds.includes(input.activeId);
  const overIsFolder = input.viewFolderIds.includes(input.overId);
  if (overIsFolder) return activeIsFolder ? "nested" : "add";
  if (activeIsFolder) return null;
  return resolveDrop(input.activeRect, input.overRect) === "into"
    ? "create"
    : null;
}
