import type { EntityId, Folder, FolderKind } from "@/shared/types/database";

export interface FolderCreateInput {
  projectId: EntityId;
  kind: FolderKind;
  name?: string;
  /** Pasta-mãe; sem valor = pasta na raiz da aba. */
  parentId?: EntityId;
}

export interface FolderRepository {
  create(input: FolderCreateInput): Promise<Folder>;
  getById(id: EntityId): Promise<Folder | undefined>;
  rename(id: EntityId, name: string): Promise<Folder>;
  /** Pastas vivas do projeto, ordenadas por `order` (fallback: nome). */
  listByProject(projectId: EntityId): Promise<Folder[]>;
  listDeleted(): Promise<Folder[]>;
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  /** `undefined` devolve a pasta para a raiz da aba. */
  setParent(id: EntityId, parentId: EntityId | undefined): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  hardDelete(id: EntityId): Promise<void>;
}
