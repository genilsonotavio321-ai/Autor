import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { applyBeatTemplate } from "../application/plot-service";
import { DexiePlotBeatRepository } from "./dexie-plot-beat-repository";

const repository = new DexiePlotBeatRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction("rw", db.projects, db.plotBeats, async () => {
    await db.projects.clear();
    await db.plotBeats.clear();
  });
});

async function seedProject() {
  return projectRepository.create({ title: "Romance", status: "draft" });
}

describe("DexiePlotBeatRepository", () => {
  it("lists beats sorted by order", async () => {
    const project = await seedProject();
    const b1 = await repository.create({
      projectId: project.id,
      structure: "custom",
      title: "Um",
    });
    const b2 = await repository.create({
      projectId: project.id,
      structure: "custom",
      title: "Dois",
    });

    expect(
      (await repository.listByProject(project.id)).map((b) => b.id),
    ).toEqual([b1.id, b2.id]);
  });

  it("clears a chapter link when patched with null", async () => {
    const project = await seedProject();
    const beat = await repository.create({
      projectId: project.id,
      structure: "custom",
      title: "Beat",
    });

    await repository.update(beat.id, { linkedChapterId: "ch-1" });
    expect((await repository.listByProject(project.id))[0]?.linkedChapterId).toBe(
      "ch-1",
    );

    await repository.update(beat.id, { linkedChapterId: null });
    const updated = (await repository.listByProject(project.id))[0];
    expect(updated?.linkedChapterId).toBeUndefined();
    expect("linkedChapterId" in (updated ?? {})).toBe(false);
  });

  it("reorders via applyMoves", async () => {
    const project = await seedProject();
    const b1 = await repository.create({
      projectId: project.id,
      structure: "custom",
      title: "Um",
    });
    const b2 = await repository.create({
      projectId: project.id,
      structure: "custom",
      title: "Dois",
    });

    await repository.applyMoves([
      { id: b1.id, order: 2 },
      { id: b2.id, order: 1 },
    ]);

    expect(
      (await repository.listByProject(project.id)).map((b) => b.id),
    ).toEqual([b2.id, b1.id]);
  });

  it("soft-deletes, lists trash and restores", async () => {
    const project = await seedProject();
    const beat = await repository.create({
      projectId: project.id,
      structure: "custom",
      title: "Beat",
    });

    await repository.softDelete(beat.id);
    expect(await repository.listByProject(project.id)).toHaveLength(0);

    const deleted = await repository.listDeleted();
    expect(deleted).toHaveLength(1);
    expect(deleted[0]?.id).toBe(beat.id);

    await repository.restore(beat.id);
    expect(await repository.listDeleted()).toEqual([]);
    expect(await repository.listByProject(project.id)).toHaveLength(1);
    const restored = await getDatabase().plotBeats.get(beat.id);
    expect(restored?.deletedAt).toBeUndefined();
  });
});

describe("applyBeatTemplate", () => {
  it("creates every beat of the template in order", async () => {
    const project = await seedProject();

    const result = await applyBeatTemplate(project.id, "three_acts", {
      replaceExisting: false,
    });

    expect(result.created).toBe(10);
    expect(result.replaced).toBe(0);
    const beats = await repository.listByProject(project.id);
    expect(beats).toHaveLength(10);
    expect(beats[0]?.title).toBe("1. Mundo comum");
    expect(beats.every((beat) => beat.structure === "three_acts")).toBe(true);
  });

  it("replaces existing beats when asked", async () => {
    const project = await seedProject();
    await applyBeatTemplate(project.id, "kishotenketsu", {
      replaceExisting: false,
    });

    const result = await applyBeatTemplate(project.id, "save_the_cat", {
      replaceExisting: true,
    });

    expect(result.replaced).toBe(4);
    expect(result.created).toBe(15);
    const beats = await repository.listByProject(project.id);
    expect(beats).toHaveLength(15);
    expect(beats.every((beat) => beat.structure === "save_the_cat")).toBe(true);
  });

  it("throws for structures without a builtin template", async () => {
    const project = await seedProject();
    await expect(
      applyBeatTemplate(project.id, "custom", { replaceExisting: false }),
    ).rejects.toThrow("No beat template");
  });
});
