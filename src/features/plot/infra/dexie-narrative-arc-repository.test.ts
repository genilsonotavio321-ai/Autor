import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import { DexieTimelineEventRepository } from "./dexie-timeline-event-repository";

import { DexieNarrativeArcRepository } from "./dexie-narrative-arc-repository";

const repository = new DexieNarrativeArcRepository();
const projectRepository = new DexieProjectRepository();
const eventRepository = new DexieTimelineEventRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    db.projects,
    db.storyArcs,
    db.timelineEvents,
    async () => {
      await db.projects.clear();
      await db.storyArcs.clear();
      await db.timelineEvents.clear();
    },
  );
});

describe("DexieNarrativeArcRepository", () => {
  it("creates ordered arcs and lists only active arcs for a project", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });

    const first = await repository.create({
      projectId: project.id,
      name: "  Jornada de Ana  ",
    });
    const second = await repository.create({
      projectId: project.id,
      name: "Arco de Rui",
    });

    expect(first.name).toBe("Jornada de Ana");
    expect(first.order).toBeLessThan(second.order);
    expect(await repository.listByProject(project.id)).toEqual([first, second]);
  });

  it("updates arc metadata and clears optional values with null", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const arc = await repository.create({
      projectId: project.id,
      name: "Jornada",
      description: "Rascunho",
      color: "#123456",
    });

    const updated = await repository.update(arc.id, {
      name: "Recomeço",
      description: null,
      color: null,
    });

    expect(updated.name).toBe("Recomeço");
    expect(updated.description).toBeUndefined();
    expect(updated.color).toBeUndefined();
  });

  it("soft-deletes and restores an arc", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const arc = await repository.create({ projectId: project.id, name: "Jornada" });

    await repository.softDelete(arc.id);
    expect(await repository.listByProject(project.id)).toEqual([]);
    expect(await repository.listDeleted()).toHaveLength(1);

    await repository.restore(arc.id);
    expect(await repository.listByProject(project.id)).toHaveLength(1);
    expect(await repository.listDeleted()).toEqual([]);
  });

  it("removes event references when an arc is permanently deleted", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const arc = await repository.create({ projectId: project.id, name: "Jornada" });
    const event = await eventRepository.create({
      projectId: project.id,
      date: "1889",
      title: "Início",
      arcIds: [arc.id],
    });

    await repository.hardDelete(arc.id);

    expect(
      (await getDatabase().timelineEvents.get(event.id))?.arcIds,
    ).toEqual([]);
  });
});
