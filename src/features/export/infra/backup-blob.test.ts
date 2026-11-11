// @vitest-environment node
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { TABLE_NAMES } from "@/infra/db/migrations";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { buildBackupBlob, importBackupJson } from "./backup";

const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  await ensureDbReady();
  const db = getDatabase();
  await db.transaction("rw", [...TABLE_NAMES], async () => {
    for (const tableName of TABLE_NAMES) {
      await db.table(tableName).clear();
    }
  });
});

describe("full backup images", () => {
  it("preserves project covers and character avatars across restore", async () => {
    const db = getDatabase();
    const timestamp = "2026-10-01T12:00:00.000Z";
    const project = await projectRepository.create({
      title: "Projeto com imagens",
      status: "active",
    });
    await db.projects.update(project.id, {
      coverBlob: new Blob(["cover-image"], { type: "image/png" }),
    });
    await db.characters.add({
      id: "backup-character",
      projectId: project.id,
      name: "Ana",
      role: "protagonist",
      traits: [],
      relationships: [],
      avatarBlob: new Blob(["avatar-image"], { type: "image/jpeg" }),
      tags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const { blob } = await buildBackupBlob();
    const json = await blob.text();
    const backup = JSON.parse(json) as {
      tables: Record<string, Record<string, unknown>[]>;
    };
    expect(backup.tables.projects?.[0]?.coverBlob).toMatchObject({
      __autorBlob: "blob",
      mimeType: "image/png",
    });
    expect(backup.tables.characters?.[0]?.avatarBlob).toMatchObject({
      __autorBlob: "blob",
      mimeType: "image/jpeg",
    });

    await importBackupJson(json);

    const restoredProject = await db.projects.get(project.id);
    const restoredCharacter = await db.characters.get("backup-character");
    expect(restoredProject?.coverBlob).toBeInstanceOf(Blob);
    expect(await restoredProject?.coverBlob?.text()).toBe("cover-image");
    expect(restoredCharacter?.avatarBlob).toBeInstanceOf(Blob);
    expect(await restoredCharacter?.avatarBlob?.text()).toBe("avatar-image");
  });
});
