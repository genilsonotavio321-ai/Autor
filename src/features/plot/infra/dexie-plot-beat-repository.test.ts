import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import {
  applyCustomStructure,
  applyStructureTemplate,
} from "../application/plot-service";
import { DexiePlotBeatRepository } from "./dexie-plot-beat-repository";

const repository = new DexiePlotBeatRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    [db.projects, db.plotBeats, db.structureSections, db.scenes],
    async () => {
      await db.projects.clear();
      await db.plotBeats.clear();
      await db.structureSections.clear();
      await db.scenes.clear();
    },
  );
});

async function seedProject() {
  return projectRepository.create({ title: "Romance", status: "draft" });
}

describe("DexiePlotBeatRepository", () => {
  it("lists beats sorted by order", async () => {
    const project = await seedProject();
    const b1 = await repository.create({
      projectId: project.id,
      scope: "main",
      title: "Um",
    });
    const b2 = await repository.create({
      projectId: project.id,
      scope: "main",
      title: "Dois",
    });

    expect(
      (await repository.listByProject(project.id)).map((b) => b.id),
    ).toEqual([b1.id, b2.id]);
  });

  it("clears a Polti situation when patched with null", async () => {
    const project = await seedProject();
    const beat = await repository.create({
      projectId: project.id,
      scope: "main",
      title: "Beat",
    });

    await repository.update(beat.id, { poltiSituation: "polti_1" });
    expect(
      (await repository.listByProject(project.id))[0]?.poltiSituation,
    ).toBe("polti_1");

    await repository.update(beat.id, { poltiSituation: null });
    const updated = (await repository.listByProject(project.id))[0];
    expect(updated?.poltiSituation).toBeUndefined();
    expect("poltiSituation" in (updated ?? {})).toBe(false);
  });

  it("reorders and moves beats between sections via applyMoves", async () => {
    const project = await seedProject();
    const b1 = await repository.create({
      projectId: project.id,
      scope: "main",
      sectionId: "sec-1",
      title: "Um",
    });
    const b2 = await repository.create({
      projectId: project.id,
      scope: "main",
      sectionId: "sec-1",
      title: "Dois",
    });

    await repository.applyMoves([
      { id: b1.id, sectionId: "sec-2", order: 1 },
      { id: b2.id, order: 1 },
    ]);

    const beats = await repository.listByProject(project.id);
    expect(beats.find((beat) => beat.id === b1.id)?.sectionId).toBe("sec-2");
    expect(beats.find((beat) => beat.id === b2.id)?.sectionId).toBe("sec-1");
  });

  it("soft-deletes, lists trash and restores", async () => {
    const project = await seedProject();
    const beat = await repository.create({
      projectId: project.id,
      scope: "main",
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

describe("applyStructureTemplate", () => {
  it("creates sections and every suggested beat", async () => {
    const project = await seedProject();

    const result = await applyStructureTemplate(project.id, "three_acts", {
      replaceExisting: false,
    });

    expect(result.sections).toBe(3);
    expect(result.beats).toBe(10);
    expect(result.replaced).toBe(0);

    const db = getDatabase();
    const sections = (
      await db.structureSections
        .filter((section) => section.projectId === project.id)
        .toArray()
    ).sort((a, b) => a.order - b.order);
    expect(sections).toHaveLength(3);
    expect(sections[0]?.title).toBe("Ato I — Setup");

    const beats = await repository.listByProject(project.id);
    expect(beats).toHaveLength(10);
    expect(beats[0]?.title).toBe("Mundo comum");
    expect(beats.every((beat) => beat.scope === "main")).toBe(true);
    expect(beats.every((beat) => Boolean(beat.sectionId))).toBe(true);

    const saved = await projectRepository.getById(project.id);
    expect(saved?.settings.structureTemplateId).toBe("three_acts");
  });

  it("replaces existing beats when asked", async () => {
    const project = await seedProject();
    await applyStructureTemplate(project.id, "kishotenketsu", {
      replaceExisting: false,
    });

    const result = await applyStructureTemplate(project.id, "save_the_cat", {
      replaceExisting: true,
    });

    expect(result.replaced).toBe(4);
    expect(result.beats).toBe(15);
    const beats = await repository.listByProject(project.id);
    expect(beats).toHaveLength(15);
  });
});

describe("applyCustomStructure", () => {
  it("creates custom sections and redistributes existing beats", async () => {
    const project = await seedProject();
    await applyStructureTemplate(project.id, "kishotenketsu", {
      replaceExisting: false,
    });

    const result = await applyCustomStructure(project.id, [
      { title: "Começo" },
      { title: "Meio" },
      { title: "Fim" },
    ]);

    expect(result.sections).toBe(3);
    const db = getDatabase();
    const sections = await db.structureSections
      .filter((section) => section.projectId === project.id)
      .toArray();
    expect(sections.map((section) => section.title).sort()).toEqual([
      "Começo",
      "Fim",
      "Meio",
    ]);

    const beats = await repository.listByProject(project.id);
    expect(beats).toHaveLength(4);
    expect(beats.every((beat) => Boolean(beat.sectionId))).toBe(true);
    const saved = await projectRepository.getById(project.id);
    expect(saved?.settings.structureTemplateId).toBe("custom");
  });

  it("rejects an empty structure", async () => {
    const project = await seedProject();
    await expect(applyCustomStructure(project.id, [])).rejects.toThrow(
      "pelo menos uma seção",
    );
  });
});
