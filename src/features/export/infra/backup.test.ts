import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { TABLE_NAMES } from "@/infra/db/migrations";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import { DexieNarrativeArcRepository } from "@/features/plot/infra/dexie-narrative-arc-repository";

import {
  buildBackupBlob,
  importBackupJson,
  parseBackup,
} from "./backup";

const projectRepository = new DexieProjectRepository();
const arcRepository = new DexieNarrativeArcRepository();

function emptyTables(): Record<string, unknown[]> {
  return Object.fromEntries(TABLE_NAMES.map((name) => [name, []]));
}

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    db.projects,
    db.chapters,
    db.characters,
    db.storyArcs,
    db.settings,
    async () => {
      await db.projects.clear();
      await db.chapters.clear();
      await db.characters.clear();
      await db.storyArcs.clear();
      await db.settings.clear();
    },
  );
});

describe("parseBackup", () => {
  it("rejects non-backup payloads with a pt-BR error", () => {
    expect(() => parseBackup(null)).toThrow("Arquivo de backup inválido.");
    expect(() => parseBackup({ tables: "nope" })).toThrow(
      "Arquivo de backup inválido.",
    );
    expect(() => parseBackup({ tables: { projects: {} } })).toThrow(
      "Arquivo de backup inválido.",
    );
  });

  it("rejects files that are not Autor backups", () => {
    expect(() => parseBackup({ tables: emptyTables() })).toThrow(
      "Arquivo de backup inválido.",
    );
    expect(() =>
      parseBackup({ app: "autor", formatVersion: 2, tables: emptyTables() }),
    ).toThrow("Arquivo de backup inválido.");
  });

  it("rejects backups missing a table or carrying malformed rows", () => {
    expect(() =>
      parseBackup({ app: "autor", formatVersion: 1, tables: {} }),
    ).toThrow("Arquivo de backup inválido.");

    const tables = emptyTables();
    tables.projects = [{ title: "Sem id" }];
    expect(() =>
      parseBackup({ app: "autor", formatVersion: 1, tables }),
    ).toThrow("Arquivo de backup inválido.");

    const badRows = emptyTables();
    badRows.chapters = [{ id: "chapter-1" }];
    expect(() =>
      parseBackup({ app: "autor", formatVersion: 1, tables: badRows }),
    ).toThrow("Arquivo de backup inválido.");
  });

  it("accepts a well-formed backup", () => {
    const tables = emptyTables();
    tables.projects = [{ id: "project-1", title: "Projeto" }];
    const parsed = parseBackup({
      app: "autor",
      formatVersion: 1,
      exportedAt: "2026-01-01T00:00:00.000Z",
      tables,
    });
    expect(parsed.tables.projects).toHaveLength(1);
  });
});

describe("backup round-trip", () => {
  it("exports every table and restores them on import", async () => {
    const project = await projectRepository.create({
      title: "Projeto backup",
      status: "active",
    });
    const arc = await arcRepository.create({
      projectId: project.id,
      name: "Jornada",
    });

    const { blob, filename } = await buildBackupBlob();
    expect(filename).toMatch(/^autor-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const json = await blob.text();
    expect(JSON.parse(json)).toMatchObject({
      app: "autor",
      formatVersion: 1,
    });

    // Wipe everything, then restore from the backup.
    const wiped = await projectRepository.listActive();
    expect(wiped).toHaveLength(1);
    await projectRepository.softDelete(project.id);
    expect(await projectRepository.listActive()).toHaveLength(0);

    const counts = await importBackupJson(json);
    expect(counts.projects).toBe(1);
    expect(counts.storyArcs).toBe(1);

    const restored = await projectRepository.listActive();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.title).toBe("Projeto backup");
    expect(await arcRepository.getById(arc.id)).toMatchObject({
      name: "Jornada",
      projectId: project.id,
    });
  });

  it("throws a pt-BR error for malformed JSON", async () => {
    await expect(importBackupJson("{not json")).rejects.toThrow(
      "Arquivo de backup inválido.",
    );
  });
});
