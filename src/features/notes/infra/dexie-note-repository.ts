import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
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
    const note: Note = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      title: input.title?.trim() || "Sem título",
      content: input.content ?? "",
      pinned: false,
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
    return all.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
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

  async softDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().notes.update(id, {
      deletedAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  async restore(id: EntityId): Promise<void> {
    await ensureDbReady();
    // `modify` with undefined removes the property (Table.update would not).
    await getDatabase()
      .notes.where("id")
      .equals(id)
      .modify({ deletedAt: undefined });
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
