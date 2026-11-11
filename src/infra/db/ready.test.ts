import "fake-indexeddb/auto";

import { liveQuery } from "dexie";
import { beforeEach, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { ensureDbReady } from "./ready";

const repository = new DexieProjectRepository();

beforeEach(async () => {
  await ensureDbReady();
  await getDatabase().projects.clear();
});

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

it("ensureDbReady keeps liveQuery change tracking alive", async () => {
  const emissions: string[][] = [];

  const subscription = liveQuery(() => repository.listActive()).subscribe({
    next: (projects) => emissions.push(projects.map((project) => project.title)),
    error: (error) => console.error("liveQuery error", error),
  });

  await wait(100);
  const project = await repository.create({ title: "A", status: "draft" });
  await wait(300);
  await repository.softDelete(project.id);
  await wait(300);

  subscription.unsubscribe();

  // Initial emission + create + soft-delete.
  expect(emissions).toEqual([[], ["A"], []]);
});

it("restore removes deletedAt so the row leaves the trash", async () => {
  const project = await repository.create({ title: "B", status: "draft" });
  await repository.softDelete(project.id);
  expect(await repository.listDeleted()).toHaveLength(1);

  await repository.restore(project.id);

  expect(await repository.listDeleted()).toHaveLength(0);
  const restored = await repository.getById(project.id);
  expect(restored?.deletedAt).toBeUndefined();
});

it("ensures migrations can run multiple times safely", async () => {
  await expect(ensureDbReady()).resolves.toBeUndefined();
  await expect(ensureDbReady()).resolves.toBeUndefined();
});
