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
  /** Non-deleted notes of a project: pinned first, then most recently updated. */
  listByProject(projectId: EntityId): Promise<Note[]>;
  update(id: EntityId, patch: NoteUpdateInput): Promise<Note>;
  togglePinned(id: EntityId, pinned: boolean): Promise<Note>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  listDeleted(): Promise<Note[]>;
}
