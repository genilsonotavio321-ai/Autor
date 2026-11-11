import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { EntityId, Note } from "@/shared/types/database";

import type {
  NoteCreateInput,
  NoteRepository,
  NoteUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

export class DexieNoteRepository implements NoteRepository {
  async create(input: NoteCreateInput): Promise<Note> {
    await ensureDbReady();
    const now = nowIso();
    // Manual order = max+1 among the project's live notes. Unlike the legacy
    // chapter bug, soft-deleted rows are excluded from the max.
    const live = await getDatabase()
      .notes.filter(
        (note) => note.projectId === input.projectId && !note.deletedAt,
      )
      .toArray();
    let maxOrder = -1;
    for (const note of live) {
      if (typeof note.order === "number" && note.order > maxOrder) {
        maxOrder = note.order;
      }
    }
    const note: Note = {
      id: createId(),
      projectId: input.projectId,
      title: input.title?.trim() || "Sem título",
      content: input.content ?? "",
      pinned: false,
      order: maxOrder + 1,
      tags: [],
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().notes.add(note);
    return note;
  }

  async getById(id: EntityId): Promise<Note | undefined> {
    await ensureDbReady();
    return getDatabase().notes.get(id);
  }

  async listByProject(projectId: EntityId): Promise<Note[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .notes.filter(
        (note) => note.projectId === projectId && !note.deletedAt,
      )
      .toArray();
    // Legacy rows (created before `order` existed) get a sequential number
    // following the visible order, so the manual sort matches what the user
    // already sees. The write is best-effort: a read never fails because of
    // the backfill, and an order may briefly collide with a freshly created
    // note — the `updatedAt` tiebreak keeps the display stable either way.
    const missing = all.filter((note) => typeof note.order !== "number");
    if (missing.length > 0) {
      const displayOrder = [...all].sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          b.updatedAt.localeCompare(a.updatedAt),
      );
      const fills: { id: EntityId; order: number }[] = [];
      displayOrder.forEach((note, index) => {
        if (typeof note.order !== "number") {
          note.order = index;
          fills.push({ id: note.id, order: index });
        }
      });
      try {
        const db = getDatabase();
        await db.transaction("rw", db.notes, async () => {
          for (const fill of fills) {
            await db.notes.update(fill.id, { order: fill.order });
          }
        });
      } catch {
        // Backfill is best-effort — keep serving the read even if it fails.
      }
    }
    return all.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async update(id: EntityId, patch: NoteUpdateInput): Promise<Note> {
    await ensureDbReady();
    await getDatabase().notes.update(id, { ...patch, updatedAt: nowIso() });
    const updated = await getDatabase().notes.get(id);
    if (!updated) throw new Error(`Note not found: ${id}`);
    return updated;
  }

  async togglePinned(id: EntityId, pinned: boolean): Promise<Note> {
    await ensureDbReady();
    await getDatabase().notes.update(id, { pinned, updatedAt: nowIso() });
    const updated = await getDatabase().notes.get(id);
    if (!updated) throw new Error(`Note not found: ${id}`);
    return updated;
  }

  async applyMoves(
    updates: { id: EntityId; order: number }[],
  ): Promise<void> {
    if (updates.length === 0) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.notes, async () => {
      for (const move of updates) {
        await db.notes.update(move.id, {
          order: move.order,
          updatedAt: nowIso(),
        });
      }
    });
  }

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().notes.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async softDeleteByProject(projectId: EntityId): Promise<EntityId[]> {
    await ensureDbReady();
    const db = getDatabase();
    const targets = await db.notes
      .filter((note) => note.projectId === projectId && !note.deletedAt)
      .toArray();
    if (targets.length === 0) return [];
    const now = nowIso();
    await db.transaction("rw", db.notes, async () => {
      for (const note of targets) {
        await db.notes.update(note.id, { deletedAt: now, updatedAt: now });
      }
    });
    return targets.map((note) => note.id);
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .notes.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
  }

  async restoreMany(ids: EntityId[]): Promise<void> {
    if (ids.length === 0) return;
    await ensureDbReady();
    const db = getDatabase();
    await db.transaction("rw", db.notes, async () => {
      for (const id of ids) {
        await db.notes.where("id").equals(id).modify({ deletedAt: undefined });
      }
    });
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().notes.delete(id);
  }

  async listDeleted(): Promise<Note[]> {
    await ensureDbReady();
    const all = await getDatabase()
      .notes.filter((note) => Boolean(note.deletedAt))
      .toArray();
    return all.sort((a, b) =>
      (b.deletedAt ?? "").localeCompare(a.deletedAt ?? ""),
    );
  }
}

export const noteRepository: NoteRepository = new DexieNoteRepository();
