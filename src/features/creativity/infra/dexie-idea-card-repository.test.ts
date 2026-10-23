import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DexieIdeaCardRepository } from "./dexie-idea-card-repository";

const repository = new DexieIdeaCardRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", [db.projects, db.ideaCards], async () => {
    await db.projects.clear();
    await db.ideaCards.clear();
  });
});

async function seedProjectId(): Promise<string> {
  const project = await projectRepository.create({
    title: "Romance",
    status: "draft",
  });
  return project.id;
}

describe("DexieIdeaCardRepository", () => {
  it("creates cards with defaults and clamped cascade position", async () => {
    const projectId = await seedProjectId();

    const card = await repository.create({ projectId });
    expect(card.title).toBe("Sem título");
    expect(card.content).toBe("");
    expect(card.x).toBe(16);
    expect(card.y).toBe(16);
    expect(card.deletedAt).toBeUndefined();

    const named = await repository.create({
      projectId,
      title: "  Perseguição  ",
      content: "E se...",
      color: "blue",
      x: 42,
      y: 7,
    });
    expect(named.title).toBe("Perseguição");
    expect(named.content).toBe("E se...");
    expect(named.color).toBe("blue");
    expect(named.x).toBe(42);
    expect(named.y).toBe(7);
  });

  it("lists only active cards of the project in creation order", async () => {
    const projectId = await seedProjectId();
    const otherProjectId = await seedProjectId();
    const a = await repository.create({ projectId, title: "A" });
    const b = await repository.create({ projectId, title: "B" });
    await repository.create({ projectId: otherProjectId, title: "Outro" });
    await repository.softDelete(b.id);

    const listed = await repository.listByProject(projectId);
    expect(listed.map((card) => card.id)).toEqual([a.id]);
    expect(await repository.listByProject(otherProjectId)).toHaveLength(1);
  });

  it("updates fields, clears sentSceneId with null and moves", async () => {
    const projectId = await seedProjectId();
    const card = await repository.create({ projectId });

    const updated = await repository.update(card.id, {
      title: "Virada do meio",
      content: "Objetivo: fugir",
      sentSceneId: "scene-1",
    });
    expect(updated.title).toBe("Virada do meio");
    expect(updated.sentSceneId).toBe("scene-1");

    const cleared = await repository.update(card.id, { sentSceneId: null });
    expect(cleared.sentSceneId).toBeUndefined();

    await repository.move(card.id, 120, 80);
    const moved = await repository.getById(card.id);
    expect(moved?.x).toBe(120);
    expect(moved?.y).toBe(80);

    // move rejeita posições negativas (clamp em zero).
    await repository.move(card.id, -50, -20);
    const clamped = await repository.getById(card.id);
    expect(clamped?.x).toBe(0);
    expect(clamped?.y).toBe(0);
  });

  it("soft-deletes, lists trash, restores and hard-deletes", async () => {
    const projectId = await seedProjectId();
    const card = await repository.create({ projectId });

    await repository.softDelete(card.id);
    expect(await repository.listByProject(projectId)).toHaveLength(0);
    expect((await repository.listDeleted()).map((c) => c.id)).toEqual([
      card.id,
    ]);

    await repository.restore(card.id);
    expect(await repository.listDeleted()).toEqual([]);
    const restored = await repository.getById(card.id);
    expect(restored?.deletedAt).toBeUndefined();

    await repository.softDelete(card.id);
    await repository.hardDelete(card.id);
    expect(await repository.getById(card.id)).toBeUndefined();
    expect(await repository.listDeleted()).toHaveLength(0);
  });

  it("conecta dois cards dos dois lados, sem duplicar, e desconecta", async () => {
    const projectId = await seedProjectId();
    const a = await repository.create({ projectId, title: "A" });
    const b = await repository.create({ projectId, title: "B" });

    await repository.link(a.id, b.id);
    expect((await repository.getById(a.id))?.links).toEqual([b.id]);
    expect((await repository.getById(b.id))?.links).toEqual([a.id]);

    // reconectar não duplica.
    await repository.link(a.id, b.id);
    expect((await repository.getById(a.id))?.links).toEqual([b.id]);

    await repository.unlink(a.id, b.id);
    expect((await repository.getById(a.id))?.links).toEqual([]);
    expect((await repository.getById(b.id))?.links).toEqual([]);

    // unlink de par sem conexão é no-op.
    await repository.unlink(a.id, b.id);
    expect((await repository.getById(a.id))?.links).toEqual([]);
  });

  it("link consigo mesmo é no-op e link com id inexistente falha", async () => {
    const projectId = await seedProjectId();
    const a = await repository.create({ projectId });

    await repository.link(a.id, a.id);
    expect((await repository.getById(a.id))?.links).toBeUndefined();

    await expect(repository.link(a.id, "sumiu")).rejects.toThrow();
  });
});
