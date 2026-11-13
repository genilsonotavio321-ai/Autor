import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import { AUTO_VERSION_KEEP, versionRepository } from "./dexie-version-repository";

beforeEach(async () => {
  await getDatabase().versions.clear();
});

describe("DexieVersionRepository", () => {
  it("prunes old auto snapshots and keeps manual versions", async () => {
    for (let index = 0; index < AUTO_VERSION_KEEP + 5; index += 1) {
      await versionRepository.create({
        entityType: "chapter",
        entityId: "chapter-1",
        snapshot: { index } as never,
        auto: true,
      });
    }
    await versionRepository.create({
      entityType: "chapter",
      entityId: "chapter-1",
      snapshot: {} as never,
      label: "Manual",
      auto: false,
    });

    const versions = await versionRepository.listByEntity("chapter-1");
    expect(versions.filter((version) => version.auto)).toHaveLength(
      AUTO_VERSION_KEEP,
    );
    expect(versions.filter((version) => !version.auto)).toHaveLength(1);
  });

  it("lists and deletes versions of an entity", async () => {
    await versionRepository.create({
      entityType: "chapter",
      entityId: "chapter-2",
      snapshot: {} as never,
      auto: false,
    });
    expect(await versionRepository.listByEntity("chapter-2")).toHaveLength(1);

    await versionRepository.deleteByEntity("chapter-2");
    expect(await versionRepository.listByEntity("chapter-2")).toHaveLength(0);
  });
});
