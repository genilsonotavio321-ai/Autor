import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, IdeaCard } from "@/shared/types/database";

import type {
  IdeaCardCreateInput,
  IdeaCardRepository,
  IdeaCardUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieIdeaCardRepository implements IdeaCardRepository {
  async create(input: IdeaCardCreateInput): Promise<IdeaCard> {
    await ensureDbReady();
    const now = nowIso();
    const card: IdeaCard = {
      id: createId(),
      projectId: input.projectId,
      title: input.title?.trim() || "Sem título",
      content: input.content ?? "",
      color: input.color,
      x: input.x ?? 16,
      y: input.y ?? 16,
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().ideaCards.add(card);
    return card;
  }

  async getById(id: EntityId): Promise<IdeaCard | undefined> {
    await ensureDbReady();
    return getDatabase().ideaCards.get(id);
  }

  async listByProject(projectId: EntityId): Promise<IdeaCard[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .ideaCards.filter(
        (card) => card.projectId === projectId && !card.deletedAt,
      )
      .toArray();
    return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async update(id: EntityId, patch: IdeaCardUpdateInput): Promise<IdeaCard> {
    await ensureDbReady();
    const db = getDatabase();
    // `null` em sentSceneId limpa o vínculo: `modify` com undefined remove a
    // propriedade (Table.update gravaria undefined).
    const changes = {
      ...patch,
      sentSceneId: patch.sentSceneId ?? undefined,
      updatedAt: nowIso(),
    };
    await db.ideaCards.where("id").equals(id).modify(changes);
    const updated = await db.ideaCards.get(id);
    if (!updated) throw new Error(`IdeaCard not found: ${id}`);
    return updated;
  }

  async move(id: EntityId, x: number, y: number): Promise<void> {
    await ensureDbReady();
    await getDatabase().ideaCards.update(id, {
      x: Math.max(0, Math.round(x)),
      y: Math.max(0, Math.round(y)),
      updatedAt: nowIso(),
    });
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().ideaCards.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .ideaCards.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().ideaCards.delete(id);
  }

  async listDeleted(): Promise<IdeaCard[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .ideaCards.filter((card) => Boolean(card.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }

  async link(aId: EntityId, bId: EntityId): Promise<void> {
    if (aId === bId) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.ideaCards, async () => {
      const [a, b] = await db.ideaCards.bulkGet([aId, bId]);
      if (!a || !b) throw new Error(`IdeaCard not found: ${aId}|${bId}`);
      if (!(a.links ?? []).includes(bId)) {
        await db.ideaCards.update(aId, {
          links: [...(a.links ?? []), bId],
          updatedAt: nowIso(),
        });
      }
      if (!(b.links ?? []).includes(aId)) {
        await db.ideaCards.update(bId, {
          links: [...(b.links ?? []), aId],
          updatedAt: nowIso(),
        });
      }
    });
  }

  async unlink(aId: EntityId, bId: EntityId): Promise<void> {
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.ideaCards, async () => {
      const [a, b] = await db.ideaCards.bulkGet([aId, bId]);
      if (a) {
        const links = (a.links ?? []).filter((id) => id !== bId);
        if (links.length !== (a.links ?? []).length) {
          await db.ideaCards.update(aId, { links, updatedAt: nowIso() });
        }
      }
      if (b) {
        const links = (b.links ?? []).filter((id) => id !== aId);
        if (links.length !== (b.links ?? []).length) {
          await db.ideaCards.update(bId, { links, updatedAt: nowIso() });
        }
      }
    });
  }
}

export const ideaCardRepository: IdeaCardRepository =
  new DexieIdeaCardRepository();
