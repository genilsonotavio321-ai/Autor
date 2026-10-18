import type {
  Chapter,
  ChapterStatus,
  EntityId,
  Json,
  LastEdit,
  Project,
  ProjectStatus,
} from "@/shared/types/database";

export interface ProjectCreateInput {
  title: string;
  subtitle?: string;
  author?: string;
  description?: string;
  status: ProjectStatus;
}

export type ProjectUpdateInput = Partial<ProjectCreateInput>;

export interface ProjectRepository {
  create(input: ProjectCreateInput): Promise<Project>;
  getById(id: EntityId): Promise<Project | undefined>;
  /** Non-deleted projects, most recently updated first. */
  listActive(): Promise<Project[]>;
  /** Soft-deleted projects (the trash), most recently deleted first. */
  listDeleted(): Promise<Project[]>;
  update(id: EntityId, patch: ProjectUpdateInput): Promise<Project>;
  updateLastEdit(id: EntityId, lastEdit: LastEdit): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
}

export interface ChapterCreateInput {
  projectId: EntityId;
  title?: string;
  /** Optional initial Tiptap document (e.g. Markdown import). */
  content?: Json;
}

export type ChapterUpdateInput = Partial<
  Pick<Chapter, "title" | "status" | "content" | "wordCount" | "order">
>;

export interface ChapterRepository {
  create(input: ChapterCreateInput): Promise<Chapter>;
  getById(id: EntityId): Promise<Chapter | undefined>;
  /** Non-deleted chapters of a project, ordered by `order`. */
  listByProject(projectId: EntityId): Promise<Chapter[]>;
  update(id: EntityId, patch: ChapterUpdateInput): Promise<Chapter>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  /** Soft-deleted chapters (the trash), most recently deleted first. */
  listDeleted(): Promise<Chapter[]>;
}

/** Empty Tiptap document used for new chapters. */
export const EMPTY_DOC: Json = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export const CHAPTER_STATUS_LABELS: Record<ChapterStatus, string> = {
  todo: "A fazer",
  draft: "Rascunho",
  revising: "Revisão",
  done: "Concluído",
};

/**
 * Tinted styling per story-unit status (chapters and scenes share the status
 * set). Each state gets its own color so it is identifiable at a glance.
 */
export const CHAPTER_STATUS_COLORS: Record<ChapterStatus, string> = {
  todo: "border-slate-300 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
  draft:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  revising:
    "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
  done: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
};

/** Solid dot color per status (used inside select triggers and items). */
export const CHAPTER_STATUS_DOT: Record<ChapterStatus, string> = {
  todo: "bg-slate-400",
  draft: "bg-amber-500",
  revising: "bg-sky-500",
  done: "bg-emerald-500",
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};
