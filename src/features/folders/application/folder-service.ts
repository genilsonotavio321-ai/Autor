import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { noteRepository } from "@/features/notes/infra/dexie-note-repository";
import type { EntityId, Folder, FolderKind } from "@/shared/types/database";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { loreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";

import { collectSubtreeIds } from "../domain/folder-tree";
import {
  folderRepository,
  setEntityFolderId,
} from "../infra/dexie-folder-repository";

/**
 * Pastas da aba Projetos não pertencem a um projeto: vivem numa biblioteca
 * única, identificada por este escopo fixo em `Folder.projectId`.
 */
export const PROJECT_FOLDER_SCOPE = "projects";

/** Mínimo que o serviço precisa de cada repositório de ficha. */
interface FolderMemberRepo {
  listByProject(
    projectId: EntityId,
  ): Promise<{ id: EntityId; projectId: EntityId; folderId?: EntityId }[]>;
  listDeleted(): Promise<
    { id: EntityId; projectId: EntityId; folderId?: EntityId }[]
  >;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
}

const KIND_REPOS: Record<FolderKind, FolderMemberRepo> = {
  character: characterRepository,
  location: locationRepository,
  item: {
    async listByProject(projectId) {
      return (await loreEntryRepository.listByProject(projectId)).filter(
        (entry) => entry.isTrackableItem,
      );
    },
    async listDeleted() {
      return (await loreEntryRepository.listDeleted()).filter(
        (entry) => entry.isTrackableItem,
      );
    },
    softDelete: (id) => loreEntryRepository.softDelete(id),
    restore: (id) => loreEntryRepository.restore(id),
  },
  // Lore e objetos dividem a mesma tabela (`loreEntries`), mas são árvores
  // de pastas separadas: cada cascata só pode tocar no seu próprio tipo.
  // Sem esse filtro, apagar uma pasta de lore levava junto um objeto que
  // tinha sido marcado como rastreável morando naquela pasta.
  lore: {
    async listByProject(projectId) {
      return (await loreEntryRepository.listByProject(projectId)).filter(
        (entry) => !entry.isTrackableItem,
      );
    },
    async listDeleted() {
      return (await loreEntryRepository.listDeleted()).filter(
        (entry) => !entry.isTrackableItem,
      );
    },
    softDelete: (id) => loreEntryRepository.softDelete(id),
    restore: (id) => loreEntryRepository.restore(id),
  },
  note: noteRepository,
  // Projetos: o "projectId" vira o escopo da biblioteca. Os adapters
  // normalizam o campo para que a cascata genérica continue valendo.
  project: {
    async listByProject() {
      return (await projectRepository.listActive()).map((project) => ({
        id: project.id,
        projectId: PROJECT_FOLDER_SCOPE,
        folderId: project.folderId,
      }));
    },
    async listDeleted() {
      return (await projectRepository.listDeleted()).map((project) => ({
        id: project.id,
        projectId: PROJECT_FOLDER_SCOPE,
        folderId: project.folderId,
      }));
    },
    softDelete: (id) => projectRepository.softDelete(id),
    restore: (id) => projectRepository.restore(id),
  },
};

/** Cria uma pasta (dentro de `parentId`, quando informado) e move as fichas. */
export async function createFolderWith(input: {
  kind: FolderKind;
  projectId: EntityId;
  parentId?: EntityId;
  /** Nome da pasta nova (padrão: "Nova pasta"). */
  name?: string;
  entityIds: EntityId[];
}): Promise<Folder> {
  const folder = await folderRepository.create({
    projectId: input.projectId,
    kind: input.kind,
    ...(input.name ? { name: input.name } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
  });
  for (const id of input.entityIds) {
    await setEntityFolderId(input.kind, id, folder.id);
  }
  return folder;
}

/**
 * Soft-delete da pasta, de todas as descendentes e das fichas diretas de
 * cada uma — tudo aparece na lixeira e é desfazível (restoreFolderCascade).
 */
export async function deleteFolderCascade(folder: Folder): Promise<void> {
  const live = await folderRepository.listByProject(folder.projectId);
  const subtree = new Set(collectSubtreeIds(live, folder.id));
  for (const id of subtree) {
    await folderRepository.softDelete(id);
  }
  const repo = KIND_REPOS[folder.kind];
  const items = await repo.listByProject(folder.projectId);
  for (const item of items) {
    if (item.folderId && subtree.has(item.folderId)) {
      await repo.softDelete(item.id);
    }
  }
}

/** Restaura a pasta, suas descendentes e as fichas apagadas junto com ela. */
export async function restoreFolderCascade(
  folderId: EntityId,
): Promise<void> {
  const folder = await folderRepository.getById(folderId);
  if (!folder) return;
  const [live, deleted] = await Promise.all([
    folderRepository.listByProject(folder.projectId),
    folderRepository.listDeleted(),
  ]);
  const all = [
    ...live,
    ...deleted.filter((item) => item.projectId === folder.projectId),
  ];
  const subtree = new Set(collectSubtreeIds(all, folderId));
  for (const item of deleted) {
    if (subtree.has(item.id)) await folderRepository.restore(item.id);
  }
  const repo = KIND_REPOS[folder.kind];
  const deletedItems = (await repo.listDeleted()).filter(
    (item) =>
      item.projectId === folder.projectId &&
      item.folderId !== undefined &&
      subtree.has(item.folderId),
  );
  for (const item of deletedItems) {
    await repo.restore(item.id);
  }
}
