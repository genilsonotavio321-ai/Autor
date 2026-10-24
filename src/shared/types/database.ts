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

/** Gênero da ficha — concorda os prompts do gerador (ex.: "obrigad@"). */
export type CharacterGender = "masculino" | "feminino" | "outro";

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
  /** Concordância de gênero nos prompts do gerador; opcional. */
  gender?: CharacterGender;
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

/** Card de ideia no canvas de Criatividade (posição livre). */
export interface IdeaCard extends BaseEntity {
  projectId: EntityId;
  title: string;
  content: string;
  /** Chave da paleta de cores do canvas (ver idea-canvas.tsx). */
  color?: string;
  /** Posição livre no canvas, em pixels. */
  x: number;
  y: number;
  /** Cena criada a partir deste card ("transformar em cena"). */
  sentSceneId?: EntityId;
  /** Ids dos cards conectados (linhas do canvas, gravado dos dois lados). */
  links?: EntityId[];
  /** Grupo persistente: arrastar um membro move todos os do grupo. */
  groupId?: EntityId;
}

/** Grupo nomeado de cards do canvas (mover junto é persistente). */
export interface IdeaGroup extends BaseEntity {
  projectId: EntityId;
  name: string;
}

/** Card dentro de um quadro salvo; `key` remapeia os links ao carregar. */
export interface IdeaBoardItem {
  key: string;
  title: string;
  content: string;
  color?: string;
  x: number;
  y: number;
  /** Chaves dos itens conectados (remapeadas para ids no load). */
  links?: string[];
}

/** Snapshot do canvas salvo pelo autor. */
export interface IdeaBoard extends BaseEntity {
  projectId: EntityId;
  name: string;
  items: IdeaBoardItem[];
}

/** Entities that accept image attachments (Fase 2B). */
export type AttachmentEntityType =
  | "note"
  | "character"
  | "location"
  | "lore"
  | "event";

/** Tipo de prompt customizado do gerador de Criatividade. */
export type CustomPromptKind = "question" | "whatIf";

/** Categoria de pergunta — espelha PromptCategory do gerador. */
export type CustomPromptCategory = "enredo" | "personagem" | "mundo" | "conflito";

/** Perguntas e combinações "E se...?" criadas pelo autor (globais). */
export interface CustomPrompt extends BaseEntity {
  kind: CustomPromptKind;
  /** Obrigatório para kind "question"; ignorado em "whatIf". */
  category?: CustomPromptCategory;
  /** Redações alternativas; apoia {personagem} e {local}. */
  variants: string[];
  enabled: boolean;
  order: number;
}


export interface Attachment {
  id: EntityId;
  projectId: EntityId;
  entityType: AttachmentEntityType;
  entityId: EntityId;
  name?: string;
  /** Image dataURL (JPEG, downscaled at insert — see image-file.ts). */
  dataUrl: string;
  createdAt: string;
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
