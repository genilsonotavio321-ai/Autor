import type {
  EntityId,
  Json,
  PlotBeat,
  PlotStructure,
  Scene,
  SceneStatus,
  TimelineEvent,
} from "@/shared/types/database";

export const SCENE_STATUS_LABELS: Record<SceneStatus, string> = {
  todo: "A fazer",
  draft: "Rascunho",
  revising: "Revisão",
  done: "Concluído",
};

export const SCENE_STATUSES = [
  "todo",
  "draft",
  "revising",
  "done",
] as const satisfies readonly SceneStatus[];

export const PLOT_STRUCTURE_LABELS: Record<PlotStructure, string> = {
  three_acts: "Três atos",
  heros_journey: "Jornada do herói",
  save_the_cat: "Save the Cat",
  kishotenketsu: "Kishōtenketsu",
  custom: "Personalizado",
};

/** Minimal Tiptap document used for new scenes. */
export const EMPTY_SCENE_DOC: Json = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export interface SceneCreateInput {
  chapterId: EntityId;
  title?: string;
  summary?: string;
  status?: SceneStatus;
  povCharacterId?: EntityId;
  locationId?: EntityId;
  /** Corpo em texto puro convertido em doc (1 linha = 1 parágrafo). */
  content?: Json;
}

export interface SceneUpdateInput {
  title?: string;
  summary?: string;
  status?: SceneStatus;
  povCharacterId?: EntityId;
  locationId?: EntityId;
  /** Tiptap document JSON — usado pelo rename em cascata de menções. */
  content?: Json;
}

/** Per-entity order patch used when reordering or moving scenes. */
export interface SceneMoveUpdate {
  id: EntityId;
  chapterId: EntityId;
  order: number;
}

export interface SceneRepository {
  create(input: SceneCreateInput): Promise<Scene>;
  getById(id: EntityId): Promise<Scene | undefined>;
  /** Non-deleted scenes of a chapter, sorted by order. */
  listByChapter(chapterId: EntityId): Promise<Scene[]>;
  /** Non-deleted scenes of every chapter of a project, sorted by order. */
  listByProject(projectId: EntityId): Promise<Scene[]>;
  update(id: EntityId, patch: SceneUpdateInput): Promise<Scene>;
  /** Persist a full reorder/move batch atomically (single transaction). */
  applyMoves(updates: SceneMoveUpdate[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  /** Soft-deleted scenes (the trash), most recently deleted first. */
  listDeleted(): Promise<Scene[]>;
}

export interface PlotBeatCreateInput {
  projectId: EntityId;
  structure: PlotStructure;
  title: string;
  description?: string;
}

export interface PlotBeatUpdateInput {
  title?: string;
  description?: string;
  linkedChapterId?: EntityId | null;
  linkedSceneId?: EntityId | null;
}

export interface PlotBeatRepository {
  create(input: PlotBeatCreateInput): Promise<PlotBeat>;
  listByProject(projectId: EntityId): Promise<PlotBeat[]>;
  update(id: EntityId, patch: PlotBeatUpdateInput): Promise<PlotBeat>;
  /** Persist a full reorder batch in a single transaction. */
  applyMoves(updates: { id: EntityId; order: number }[]): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  /** Soft-deleted beats (the trash), most recently deleted first. */
  listDeleted(): Promise<PlotBeat[]>;
}

export interface TimelineEventCreateInput {
  projectId: EntityId;
  date: string;
  title: string;
  description?: string;
  linkedChapterId?: EntityId;
}

export interface TimelineEventUpdateInput {
  date?: string;
  title?: string;
  description?: string;
  linkedChapterId?: EntityId | null;
}

export interface TimelineEventRepository {
  create(input: TimelineEventCreateInput): Promise<TimelineEvent>;
  listByProject(projectId: EntityId): Promise<TimelineEvent[]>;
  update(
    id: EntityId,
    patch: TimelineEventUpdateInput,
  ): Promise<TimelineEvent>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Permanently deletes the row (trash purge only). */
  hardDelete(id: EntityId): Promise<void>;
  /** Soft-deleted events (the trash), most recently deleted first. */
  listDeleted(): Promise<TimelineEvent[]>;
}
