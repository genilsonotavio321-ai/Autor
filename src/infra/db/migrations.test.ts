import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import type { PlotBeat, Project } from "@/shared/types/database";

import { migrations } from "./migrations";

const migration = migrations[0]!;

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    [db.projects, db.plotBeats, db.structureSections, db.scenes, db.settings],
    async () => {
      await db.projects.clear();
      await db.plotBeats.clear();
      await db.structureSections.clear();
      await db.scenes.clear();
      await db.settings.clear();
    },
  );
});

async function seedLegacyProject(): Promise<void> {
  const db = getDatabase();
  const now = new Date().toISOString();
  await db.projects.add({
    id: "project-1",
    title: "Projeto legado",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  } as unknown as Project);
  for (const [index, title] of ["Beat 1", "Beat 2"].entries()) {
    await db.plotBeats.add({
      id: `beat-${index + 1}`,
      projectId: "project-1",
      title,
      order: index + 1,
      structure: "three_acts",
    } as unknown as PlotBeat);
  }
}

describe("migração 1 (estrutura em seções)", () => {
  it("cria um conjunto de seções e limpa os beats legados", async () => {
    await seedLegacyProject();
    await migration.upgrade(getDatabase());

    const db = getDatabase();
    expect(await db.structureSections.count()).toBe(3);

    const beats = await db.plotBeats.orderBy("order").toArray();
    expect(beats.every((beat) => typeof beat.sectionId === "string")).toBe(
      true,
    );
    expect(beats.some((beat) => "structure" in beat)).toBe(false);
  });

  it("não duplica seções quando roda de novo após uma falha parcial", async () => {
    await seedLegacyProject();
    const db = getDatabase();
    await migration.upgrade(db);

    // Simula um crash antes de limpar o segundo beat.
    const row = await db.plotBeats.get("beat-2");
    if (!row) throw new Error("beat-2 ausente");
    const legacy = { ...row, structure: "three_acts" } as Record<string, unknown>;
    delete legacy.sectionId;
    await db.plotBeats.put(legacy as unknown as PlotBeat);

    await migration.upgrade(db);

    expect(await db.structureSections.count()).toBe(3);
    const beat = await db.plotBeats.get("beat-2");
    expect(typeof beat?.sectionId).toBe("string");
    expect(beat && "structure" in beat).toBe(false);
  });
});
