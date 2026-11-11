import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import type { EntityId } from "@/shared/types/database";

/**
 * Repositório mínimo de snippets. A tabela existe desde a Fase 0, mas ainda
 * não tem UI; hoje só serve à purga em cascata do projeto (lixeira).
 */
export interface SnippetRepository {
  /** Exclui todos os snippets de um projeto. */
  deleteByProject(projectId: EntityId): Promise<void>;
}

export class DexieSnippetRepository implements SnippetRepository {
  async deleteByProject(projectId: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().snippets.where("projectId").equals(projectId).delete();
  }
}

export const snippetRepository: SnippetRepository =
  new DexieSnippetRepository();
