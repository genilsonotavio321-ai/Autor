import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieCharacterRepository } from "@/features/characters/infra/dexie-character-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DexieTagRepository } from "./dexie-tag-repository";

const repository = new DexieTagRepository();
const projectRepository = new DexieProjectRepository();
const characterRepository = new DexieCharacterRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    db.projects,
    db.characters,
    db.tags,
    async () => {
      await db.projects.clear();
      await db.characters.clear();
      await db.tags.clear();
    },
  );
});

describe("DexieTagRepository", () => {
  it("creates tags with defaults and lists them sorted", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    await repository.create({ projectId: project.id, name: "Zelador" });
    await repository.create({ projectId: project.id, name: "arco" });

    const list = await repository.listByProject(project.id);
    expect(list.map((tag) => tag.name)).toEqual(["arco", "Zelador"]);
    expect(list[0]?.color).toBeTruthy();

    const blank = await repository.create({ projectId: project.id, name: "  " });
    expect(blank.name).toBe("Sem nome");
  });

  it("renames and recolors tags", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const tag = await repository.create({
      projectId: project.id,
      name: "vilão",
    });
    const updated = await repository.update(tag.id, {
      name: "antagonista",
      color: "#ef4444",
    });
    expect(updated.name).toBe("antagonista");
    expect(updated.color).toBe("#ef4444");
  });

  it("merges a tag into another and drops the source", async () => {
    const db = getDatabase();
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const source = await repository.create({
      projectId: project.id,
      name: "fonte",
    });
    const target = await repository.create({
      projectId: project.id,
      name: "destino",
    });
    const character = await characterRepository.create({
      projectId: project.id,
      name: "Ana",
    });
    await db.characters.update(character.id, {
      tags: [source.id, target.id],
    });

    await repository.merge(source.id, target.id);

    const stored = await db.characters.get(character.id);
    expect(stored?.tags).toEqual([target.id]);
    expect(await repository.getById(source.id)).toBeUndefined();
    expect(await repository.listByProject(project.id)).toHaveLength(1);
  });

  it("removes a tag and strips its references", async () => {
    const db = getDatabase();
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const tag = await repository.create({ projectId: project.id, name: "solto" });
    const character = await characterRepository.create({
      projectId: project.id,
      name: "Bruno",
    });
    await db.characters.update(character.id, { tags: [tag.id] });

    await repository.remove(tag.id);

    const stored = await db.characters.get(character.id);
    expect(stored?.tags).toEqual([]);
    expect(await repository.getById(tag.id)).toBeUndefined();
  });
});
