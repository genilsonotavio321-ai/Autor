import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, IdeaBoard } from "@/shared/types/database";

import type {
  IdeaBoardCreateInput,
  IdeaBoardRepository,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieIdeaBoardRepository implements IdeaBoardRepository {
  async create(input: IdeaBoardCreateInput): Promise<IdeaBoard> {
    await ensureDbReady();
    const name = input.name.trim();
    if (!name) throw new Error("Quadro precisa de um nome");
    const now = nowIso();
    const board: IdeaBoard = {
      id: createId(),
      projectId: input.projectId,
      name,
      // Clone: o snapshot não compartilha arrays com quem o criou.
      items: structuredClone(input.items),
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().ideaBoards.add(board);
    return board;
  }

  async listByProject(projectId: EntityId): Promise<IdeaBoard[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .ideaBoards.filter((board) => board.projectId === projectId)
      .toArray();
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().ideaBoards.delete(id);
  }
}

export const ideaBoardRepository = new DexieIdeaBoardRepository();
