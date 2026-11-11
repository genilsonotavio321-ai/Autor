import type { EntityId, Note } from "@/shared/types/database";

export interface NoteCreateInput {
  projectId: EntityId;
  title?: string;
  content?: string;
}

export interface NoteUpdateInput {
  title?: string;
  content?: string;
}

export interface NoteRepository {
  create(input: NoteCreateInput): Promise<Note>;
  getById(id: EntityId): Promise<Note | undefined>;
  /** Non-deleted notes of a project: pinned first, then manual order. */
  listByProject(projectId: EntityId): Promise<Note[]>;
  update(id: EntityId, patch: NoteUpdateInput): Promise<Note>;
  togglePinned(id: EntityId, pinned: boolean): Promise<Note>;
  /** Persists a manual reorder (transaction; bumps updatedAt per note). */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  /** Moves every non-deleted note of the project to the trash; returns the ids. */
  softDeleteByProject(projectId: EntityId): Promise<EntityId[]>;
  restore(id: EntityId): Promise<void>;
  /** Restores many notes at once (undo of softDeleteByProject). */
  restoreMany(ids: EntityId[]): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<Note[]>;
}
