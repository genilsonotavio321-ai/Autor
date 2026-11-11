import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieNarrativeArcRepository } from "@/features/plot/infra/dexie-narrative-arc-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import {
  autoPurgeExpiredTrash,
  emptyTrash,
  purgeTrashItem,
} from "./trash-service";

const arcRepository = new DexieNarrativeArcRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.projects, db.storyArcs, async () => {
    await db.projects.clear();
    await db.storyArcs.clear();
  });
});

describe("narrative arc trash", () => {
  it("purges one trashed arc", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const arc = await arcRepository.create({
      projectId: project.id,
      name: "Jornada",
    });
    await arcRepository.softDelete(arc.id);

    await purgeTrashItem("arc", arc.id);

    expect(await arcRepository.getById(arc.id)).toBeUndefined();
  });

  it("purges active and trashed arcs with their project", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const active = await arcRepository.create({
      projectId: project.id,
      name: "Arco ativo",
    });
    const trashed = await arcRepository.create({
      projectId: project.id,
      name: "Arco na lixeira",
    });
    await arcRepository.softDelete(trashed.id);
    await projectRepository.softDelete(project.id);

    await purgeTrashItem("project", project.id);

    expect(await projectRepository.getById(project.id)).toBeUndefined();
    expect(await arcRepository.getById(active.id)).toBeUndefined();
    expect(await arcRepository.getById(trashed.id)).toBeUndefined();
  });

  it("empties trashed arcs but preserves active arcs", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const active = await arcRepository.create({
      projectId: project.id,
      name: "Arco ativo",
    });
    const trashed = await arcRepository.create({
      projectId: project.id,
      name: "Arco na lixeira",
    });
    await arcRepository.softDelete(trashed.id);

    await emptyTrash();

    expect(await arcRepository.getById(active.id)).toBeDefined();
    expect(await arcRepository.getById(trashed.id)).toBeUndefined();
  });

  it("includes arcs in automatic trash expiration", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const arc = await arcRepository.create({
      projectId: project.id,
      name: "Arco expirado",
    });
    await arcRepository.softDelete(arc.id);
    await getDatabase().storyArcs.update(arc.id, {
      deletedAt: "2000-01-01T00:00:00.000Z",
    });

    const purged = await autoPurgeExpiredTrash(0);

    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await arcRepository.getById(arc.id)).toBeUndefined();
  });
});
