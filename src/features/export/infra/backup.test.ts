import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import {
  buildBackupBlob,
  importBackupJson,
  parseBackup,
} from "./backup";

const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    db.projects,
    db.chapters,
    db.characters,
    db.settings,
    async () => {
      await db.projects.clear();
      await db.chapters.clear();
      await db.characters.clear();
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
});

describe("backup round-trip", () => {
  it("exports every table and restores them on import", async () => {
    const project = await projectRepository.create({
      title: "Projeto backup",
      status: "active",
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

    const restored = await projectRepository.listActive();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.title).toBe("Projeto backup");
  });

  it("throws a pt-BR error for malformed JSON", async () => {
    await expect(importBackupJson("{not json")).rejects.toThrow(
      "Arquivo de backup inválido.",
    );
  });
});
