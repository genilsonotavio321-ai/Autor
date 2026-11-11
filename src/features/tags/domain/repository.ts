import type { EntityId, Tag } from "@/shared/types/database";

export interface TagCreateInput {
  projectId: EntityId;
  name: string;
  color?: string;
}

export interface TagUpdateInput {
  name?: string;
  color?: string;
}

export interface TagRepository {
  create(input: TagCreateInput): Promise<Tag>;
  getById(id: EntityId): Promise<Tag | undefined>;
  listByProject(projectId: EntityId): Promise<Tag[]>;
  update(id: EntityId, patch: TagUpdateInput): Promise<Tag>;
  /** Reaponta todas as referências de `sourceId` para `targetId` e exclui a tag de origem. */
  merge(sourceId: EntityId, targetId: EntityId): Promise<void>;
  /** Exclui a tag e remove todas as referências a ela. */
  remove(id: EntityId): Promise<void>;
  /**
   * Exclui todas as tags de um projeto, sem tocar nas referências — usado
   * apenas na purga em cascata do projeto (os donos já foram apagados).
   */
  deleteByProject(projectId: EntityId): Promise<void>;
}

/** Paleta de cores das tags (plan §7.8 — gestão de tags com cor). */
export const TAG_COLOR_PALETTE = [
  "#64748b",
  "#ef4444",
  "#f59e0b",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
] as const;

export const DEFAULT_TAG_COLOR = TAG_COLOR_PALETTE[0];

export function resolveTagColor(color?: string): string {
  return color && color.trim() ? color : DEFAULT_TAG_COLOR;
}
