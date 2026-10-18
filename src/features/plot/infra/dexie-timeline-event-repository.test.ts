import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DexieTimelineEventRepository } from "./dexie-timeline-event-repository";

const repository = new DexieTimelineEventRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.projects, db.timelineEvents, async () => {
    await db.projects.clear();
    await db.timelineEvents.clear();
  });
});

describe("DexieTimelineEventRepository", () => {
  it("sorts events lexicographically by date", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });

    await repository.create({
      projectId: project.id,
      date: "1900",
      title: "Depois",
    });
    await repository.create({
      projectId: project.id,
      date: "1889-05",
      title: "Meio",
    });
    await repository.create({
      projectId: project.id,
      date: "1889-05-01",
      title: "Antes",
    });

    const list = await repository.listByProject(project.id);
    // Lexicographic: coarser date strings sort before more specific ones.
    expect(list.map((event) => event.title)).toEqual([
      "Meio",
      "Antes",
      "Depois",
    ]);
  });

  it("updates fields and clears chapter link with null", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const event = await repository.create({
      projectId: project.id,
      date: "2026",
      title: "Início",
      linkedChapterId: "ch-1",
    });

    const updated = await repository.update(event.id, {
      title: "Revisado",
      linkedChapterId: null,
    });
    expect(updated.title).toBe("Revisado");
    expect("linkedChapterId" in updated).toBe(false);
  });

  it("soft-deletes, lists trash and restores", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const event = await repository.create({
      projectId: project.id,
      date: "2026",
      title: "Início",
    });

    await repository.softDelete(event.id);
    expect(await repository.listByProject(project.id)).toHaveLength(0);

    const deleted = await repository.listDeleted();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.id).toBe(event.id);

    await repository.restore(event.id);
    expect(await repository.listDeleted()).toEqual([]);
    expect(await repository.listByProject(project.id)).toHaveLength(1);
    const restored = await getDatabase().timelineEvents.get(event.id);
    expect(restored?.deletedAt).toBeUndefined();
  });
});
