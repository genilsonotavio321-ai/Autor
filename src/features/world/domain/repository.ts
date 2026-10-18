import type { EntityId, Location, LoreEntry } from "@/shared/types/database";

/** Free-text location kinds shown as datalist suggestions in the UI. */
export const LOCATION_TYPE_SUGGESTIONS = [
  "Cidade",
  "Vila",
  "Castelo",
  "Floresta",
  "Montanha",
  "Mar",
  "Deserto",
  "Prisão",
  "Escola",
  "Outro",
] as const;

export interface LocationCreateInput {
  projectId: EntityId;
  name: string;
  type?: string;
  description?: string;
}

export interface LocationUpdateInput {
  name?: string;
  type?: string;
  description?: string;
}

export interface LocationRepository {
  create(input: LocationCreateInput): Promise<Location>;
  getById(id: EntityId): Promise<Location | undefined>;
  listByProject(projectId: EntityId): Promise<Location[]>;
  update(id: EntityId, patch: LocationUpdateInput): Promise<Location>;
  /** Persists the manual order of a drag-and-drop reorder. */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<Location[]>;
}

export const DEFAULT_LORE_CATEGORY = "Geral";

export interface LoreEntryCreateInput {
  projectId: EntityId;
  title: string;
  category?: string;
  /** Plain text (stored as Json string). */
  content?: string;
  linkedIds?: EntityId[];
}

export interface LoreEntryUpdateInput {
  title?: string;
  category?: string;
  content?: string;
  linkedIds?: EntityId[];
}

export interface LoreEntryRepository {
  create(input: LoreEntryCreateInput): Promise<LoreEntry>;
  getById(id: EntityId): Promise<LoreEntry | undefined>;
  listByProject(projectId: EntityId): Promise<LoreEntry[]>;
  update(id: EntityId, patch: LoreEntryUpdateInput): Promise<LoreEntry>;
  /** Persists the manual order of a drag-and-drop reorder. */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<LoreEntry[]>;
}
