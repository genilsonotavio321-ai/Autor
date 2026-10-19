/**
 * Core data entities for Autor (plan §5).
 * Timestamps are ISO-8601 strings so they sort lexicographically in IndexedDB.
 */

export type EntityId = string;

/** Recursive JSON value — also the shape of Tiptap document content. */
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

export type ProjectStatus = "draft" | "active" | "completed" | "archived";

export type StoryUnitStatus = "todo" | "draft" | "revising" | "done";
export type ChapterStatus = StoryUnitStatus;
export type SceneStatus = StoryUnitStatus;

export type CharacterRole =
  | "protagonist"
  | "antagonist"
  | "supporting"
  | "minor";

export type RelationshipType =
  | "family"
  | "friend"
  | "enemy"
  | "love"
  | "mentor"
  | "rival"
  | "ally"
  | "other";

export type PlotStructure =
  | "three_acts"
  | "heros_journey"
  | "save_the_cat"
  | "kishotenketsu"
  | "custom";

export type TemplateScope = "project" | "chapter" | "scene" | "character";

export type VersionEntityType =
  | "project"
  | "chapter"
  | "scene"
  | "character"
  | "location"
  | "loreEntry"
  | "plotBeat"
  | "timelineEvent"
  | "note";

export interface BaseEntity {
  id: EntityId;
  createdAt: string;
  updatedAt: string;
  /** Soft-delete timestamp; when present the row lives in the trash. */
  deletedAt?: string;
}

export interface LastEdit {
  chapterId: EntityId;
  sceneId?: EntityId;
  cursorOffset: number;
  scrollY: number;
  updatedAt: string;
}

export interface Project extends BaseEntity {
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
  coverBlob?: Blob;
  status: ProjectStatus;
  settings: Record<string, Json>;
  lastEdit?: LastEdit;
}

export interface Chapter extends BaseEntity {
  projectId: EntityId;
  title: string;
  order: number;
  status: ChapterStatus;
  wordCount: number;
  /** Tiptap document JSON. */
  content: Json;
}

export interface Scene extends BaseEntity {
  chapterId: EntityId;
  title: string;
  order: number;
  povCharacterId?: EntityId;
  locationId?: EntityId;
  summary?: string;
  content: Json;
  status: SceneStatus;
}

export interface Relationship {
  targetId: EntityId;
  type: RelationshipType;
  note?: string;
}

export interface Character extends BaseEntity {
  projectId: EntityId;
  name: string;
  /** Manual (drag-and-drop) position within the project. */
  order?: number;
  role: CharacterRole;
  description?: string;
  backstory?: string;
  goals?: string;
  fears?: string;
  traits: string[];
  relationships: Relationship[];
  avatarBlob?: Blob;
  tags: EntityId[];
}

export interface Location extends BaseEntity {
  projectId: EntityId;
  name: string;
  /** Manual (drag-and-drop) position within the project. */
  order?: number;
  type: string;
  description?: string;
  /** Ficha-mãe quando este local é uma subficha (item 7). */
  parentId?: EntityId;
  tags: EntityId[];
}

export interface LoreEntry extends BaseEntity {
  projectId: EntityId;
  title: string;
  /** Manual (drag-and-drop) position within the project. */
  order?: number;
  category: string;
  /** Tiptap document JSON. */
  content: Json;
  tags: EntityId[];
  linkedIds: EntityId[];
}

export interface PlotBeat extends BaseEntity {
  projectId: EntityId;
  structure: PlotStructure;
  title: string;
  description?: string;
  order: number;
  linkedChapterId?: EntityId;
  linkedSceneId?: EntityId;
}

export interface TimelineEvent extends BaseEntity {
  projectId: EntityId;
  /** Sortable date string ("YYYY", "YYYY-MM" or "YYYY-MM-DD"). */
  date: string;
  title: string;
  description?: string;
  characterIds: EntityId[];
  locationId?: EntityId;
  linkedChapterId?: EntityId;
  tags: EntityId[];
}

export interface Note extends BaseEntity {
  projectId: EntityId;
  title: string;
  content: string;
  pinned: boolean;
  /**
   * Manual position inside the project (pinned notes keep their slot too).
   * Optional: rows created before this field existed are backfilled lazily.
   */
  order?: number;
  tags: EntityId[];
}

export interface Tag {
  id: EntityId;
  projectId: EntityId;
  name: string;
  color?: string;
}

export interface Snippet extends BaseEntity {
  projectId: EntityId;
  title: string;
  content: string;
}

export interface Template {
  id: EntityId;
  name: string;
  scope: TemplateScope;
  payload: Json;
  builtin: boolean;
}

export interface Version {
  id: EntityId;
  entityType: VersionEntityType;
  entityId: EntityId;
  snapshot: Json;
  label?: string;
  auto: boolean;
  createdAt: string;
}

export interface Setting {
  key: string;
  value: Json;
}
