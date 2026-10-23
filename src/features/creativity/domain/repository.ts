import type { EntityId, IdeaCard } from "@/shared/types/database";

export interface IdeaCardCreateInput {
  projectId: EntityId;
  title?: string;
  content?: string;
  color?: string;
  x?: number;
  y?: number;
}

export interface IdeaCardUpdateInput {
  title?: string;
  content?: string;
  color?: string;
  /** Cena criada a partir do card; `null` limpa o vínculo. */
  sentSceneId?: EntityId | null;
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
