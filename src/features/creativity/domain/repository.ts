import type {
  CustomPrompt,
  CustomPromptCategory,
  CustomPromptKind,
  EntityId,
  IdeaBoard,
  IdeaBoardItem,
  IdeaCard,
  IdeaGroup,
} from "@/shared/types/database";

export interface IdeaCardCreateInput {
  projectId: EntityId;
  title?: string;
  content?: string;
  color?: string;
  x?: number;
  y?: number;
  /** Conexões iniciais (carregar quadro/importação). */
  links?: EntityId[];
}

export interface IdeaCardUpdateInput {
  title?: string;
  content?: string;
  color?: string;
  /** Cena criada a partir do card; `null` limpa o vínculo. */
  sentSceneId?: EntityId | null;
  /** Grupo do canvas; `null` remove o card do grupo. */
  groupId?: EntityId | null;
  /** Substitui as conexões do card. */
  links?: EntityId[];
}

export interface IdeaCardRepository {
  create(input: IdeaCardCreateInput): Promise<IdeaCard>;
  getById(id: EntityId): Promise<IdeaCard | undefined>;
  /** Cards do projeto fora da lixeira, por ordem de criação. */
  listByProject(projectId: EntityId): Promise<IdeaCard[]>;
  update(id: EntityId, patch: IdeaCardUpdateInput): Promise<IdeaCard>;
  /** Persiste a nova posição livre no canvas. */
  move(id: EntityId, x: number, y: number): Promise<void>;
  softDelete(id: EntityId): Promise<void>;
  restore(id: EntityId): Promise<void>;
  /** Exclusão permanente (purga da lixeira). */
  hardDelete(id: EntityId): Promise<void>;
  listDeleted(): Promise<IdeaCard[]>;
  /** Conecta dois cards — ids gravados dos dois lados. */
  link(aId: EntityId, bId: EntityId): Promise<void>;
  /** Remove a conexão; par inexistente é no-op. */
  unlink(aId: EntityId, bId: EntityId): Promise<void>;
}

export interface IdeaGroupCreateInput {
  projectId: EntityId;
  name: string;
}

/** Grupos nomeados de cards do canvas (mover junto é persistente). */
export interface IdeaGroupRepository {
  create(input: IdeaGroupCreateInput): Promise<IdeaGroup>;
  /** Grupos do projeto por ordem de criação. */
  listByProject(projectId: EntityId): Promise<IdeaGroup[]>;
  rename(id: EntityId, name: string): Promise<IdeaGroup>;
  /** Exclusão direta (grupos não passam pela lixeira). */
  hardDelete(id: EntityId): Promise<void>;
}

export interface IdeaBoardCreateInput {
  projectId: EntityId;
  name: string;
  /** Snapshot dos cards (`key` remapeia os links ao carregar). */
  items: IdeaBoardItem[];
}

/** Snapshots do canvas guardados no banco, por projeto. */
export interface IdeaBoardRepository {
  create(input: IdeaBoardCreateInput): Promise<IdeaBoard>;
  /** Quadros do projeto por ordem de criação. */
  listByProject(projectId: EntityId): Promise<IdeaBoard[]>;
  /** Exclusão direta (quadros não passam pela lixeira). */
  hardDelete(id: EntityId): Promise<void>;
}

export interface CustomPromptCreateInput {
  kind: CustomPromptKind;
  category?: CustomPromptCategory;
  variants: string[];
}

export interface CustomPromptUpdateInput {
  category?: CustomPromptCategory;
  variants?: string[];
  enabled?: boolean;
}

/** Prompts customizados do gerador (globais, sem lixeira). */
export interface CustomPromptRepository {
  create(input: CustomPromptCreateInput): Promise<CustomPrompt>;
  update(id: EntityId, patch: CustomPromptUpdateInput): Promise<CustomPrompt>;
  /** Todos os prompts por ordem de criação. */
  list(): Promise<CustomPrompt[]>;
  hardDelete(id: EntityId): Promise<void>;
}
