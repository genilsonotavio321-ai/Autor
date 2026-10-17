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
}

export interface ChapterCreateInput {
  projectId: EntityId;
  title?: string;
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

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  archived: "Arquivado",
};
