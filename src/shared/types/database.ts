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

/**
 * Estrutura escolhida para o projeto (trama principal ou arco).
 * Cada template sequencial define seções (atos/estágios/esferas) e beats.
 */
export type StructureTemplateId =
  | "three_acts"
  | "heros_journey"
  | "save_the_cat"
  | "kishotenketsu"
  | "booker_overcoming_the_monster"
  | "booker_rags_to_riches"
  | "booker_the_quest"
  | "booker_voyage_and_return"
  | "booker_comedy"
  | "booker_tragedy"
  | "booker_rebirth"
  | "propp"
  | "custom";

/** Escopo de uma estrutura: esqueleto principal ou trama paralela (arco). */
export type StructureScope = "main" | "arc";

/** Funções dramáticas de Etienne Souriau (classificação, não sequência). */
export type SouriauFunctionId =
  | "leo"
  | "soleil"
  | "terre"
  | "balance"
  | "mars"
  | "lune";

/** Personagem atribuído a cada função dramática de Souriau. */
export type SouriauAssignment = Partial<
  Record<SouriauFunctionId, EntityId>
>;

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
  /** Arquivado dentro do projeto: sai da escrita, mas não vai para a lixeira. */
  archived?: boolean;
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
  /** Beat da estrutura ao qual a cena pertence (ponte estrutura ↔ timeline). */
  beatId?: EntityId;
}

export interface Relationship {
  targetId: EntityId;
  type: RelationshipType;
  note?: string;
}

/** Tipos de ficha que podem ser agrupados em pastas (uma árvore por aba). */
export type FolderKind = "character" | "location" | "lore" | "item" | "note";

/** Pasta de fichas numa aba (Personagens, Locais, Lore, Objetos, Notas). */
export interface Folder extends BaseEntity {
  projectId: EntityId;
  kind: FolderKind;
  name: string;
  /** Manual position among same-kind folders. */
  order?: number;
  /** Pasta-mãe; sem valor = pasta na raiz da aba. */
  parentId?: EntityId;
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
  /** Pasta na aba Personagens (arrastar um card sobre outro cria). */
  folderId?: EntityId;
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
  /** Pasta na aba Locais (arrastar um card sobre outro cria). */
  folderId?: EntityId;
}

export interface LoreEntry extends BaseEntity {
  projectId: EntityId;
  title: string;
  /** Include this lore record in inventory and item-continuity tracking. */
  isTrackableItem?: boolean;
  initialOwnerId?: EntityId;
  /** Manual (drag-and-drop) position within the project. */
  order?: number;
  category: string;
  /** Tiptap document JSON. */
  content: Json;
  tags: EntityId[];
  linkedIds: EntityId[];
  /** Pasta na aba Lore ou Objetos (arrastar um card sobre outro cria). */
  folderId?: EntityId;
}

/** Seção de uma estrutura: ato, estágio de Booker ou esfera de Propp. */
export interface StructureSection extends BaseEntity {
  projectId: EntityId;
  scope: StructureScope;
  /** Presente quando a seção pertence a um arco (scope === "arc"). */
  arcId?: EntityId;
  /** Chave da seção no template de origem (ex.: "ato1", "pesadelo"). */
  templateKey?: string;
  title: string;
  description?: string;
  order: number;
}

export interface PlotBeat extends BaseEntity {
  projectId: EntityId;
  scope: StructureScope;
  /** Presente quando o beat pertence a um arco (scope === "arc"). */
  arcId?: EntityId;
  /** Seção da estrutura; ausente nos beats de arco (lista única). */
  sectionId?: EntityId;
  title: string;
  description?: string;
  order: number;
  /** Vínculo legado (antes das cenas serem a ponte) — mantido como fallback. */
  linkedChapterId?: EntityId;
  /** Situação de Georges Polti ("polti_1" … "polti_36"). */
  poltiSituation?: string;
  /** Atribuição das seis funções dramáticas de Souriau. */
  souriauFunctions?: SouriauAssignment;
}

export interface TimelineEvent extends BaseEntity {
  projectId: EntityId;
  /** Sortable date string ("YYYY", "YYYY-MM" or "YYYY-MM-DD"). */
  date: string;
  /** Optional in-world time in HH:mm format. */
  time?: string;
  title: string;
  description?: string;
  characterIds: EntityId[];
  locationId?: EntityId;
  linkedChapterId?: EntityId;
  linkedSceneId?: EntityId;
  arcIds?: EntityId[];
  stateChanges?: TimelineStateChange[];
  tags: EntityId[];
}

export interface NarrativeArc extends BaseEntity {
  projectId: EntityId;
  name: string;
  description?: string;
  color?: string;
  order: number;
}

export interface StoryItem {
  id: EntityId;
  name: string;
  initialOwnerId?: EntityId;
}

export type TimelineStateChange =
  | {
      kind: "character";
      characterId: EntityId;
      motivation?: string | null;
      physicalCondition?: string | null;
    }
  | {
      kind: "item";
      action: "acquire" | "transfer" | "use";
      itemId: EntityId;
      characterId: EntityId;
    }
  | {
      kind: "item";
      action: "lose";
      itemId: EntityId;
      characterId?: EntityId;
    }
  | { kind: "item"; action: "destroy"; itemId: EntityId };

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
  /** Pasta na aba Notas (arrastar um card sobre outro cria). */
  folderId?: EntityId;
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
  /** Ficha referenciada pelo node (canvas ligado às fichas — fase 4). */
  refType?: "character" | "location" | "chapter" | "scene";
  refId?: EntityId;
  /** Tamanho do node (resize); padrão do layout do canvas. */
  w?: number;
  h?: number;
  /** Conteúdo rico (Tiptap); `content` espelha o texto puro p/ busca. */
  doc?: Json;
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
  /** Ficha referenciada, quando o node é um node de ficha. */
  refType?: "character" | "location" | "chapter" | "scene";
  refId?: EntityId;
  /** Tamanho do node no momento do snapshot. */
  w?: number;
  h?: number;
  /** Conteúdo rico (Tiptap) no momento do snapshot. */
  doc?: Json;
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
