import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import type { Folder } from "@/shared/types/database";

import { FOLDER_EXIT_ID, resolveFolderDragEnd } from "../application/folder-drag";
import {
  createFolderWith,
  deleteFolderCascade,
  restoreFolderCascade,
} from "../application/folder-service";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import {
  DexieFolderRepository,
  folderRepository,
  setEntityFolderId,
} from "./dexie-folder-repository";

const repository = new DexieFolderRepository();
const projectRepository = new DexieProjectRepository();

beforeEach(async () => {
  const db = getDatabase();
  await db.transaction(
    "rw",
    db.projects,
    db.characters,
    db.folders,
    async () => {
      await db.projects.clear();
      await db.characters.clear();
      await db.folders.clear();
    },
  );
});

/** Card centrado no alvo (drop "dentro"). */
const centered = { left: 45, top: 45, width: 10, height: 10 };
const edge = { left: 0, top: 0, width: 10, height: 10 };
const over = { left: 0, top: 0, width: 100, height: 100 };

describe("DexieFolderRepository", () => {
  it("cria com nome padrão, ordena por insertion e renomeia", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const first = await repository.create({
      projectId: project.id,
      kind: "character",
    });
    const second = await repository.create({
      projectId: project.id,
      kind: "character",
      name: "  Heróis  ",
    });

    expect(first.name).toBe("Nova pasta");
    expect(second.name).toBe("Heróis");

    const renamed = await repository.rename(first.id, "Vilões");
    expect(renamed.name).toBe("Vilões");

    const list = await repository.listByProject(project.id);
    expect(list.map((folder) => folder.id)).toEqual([first.id, second.id]);
  });

  it("soft-delete/restore/hard-delete e setParent (undefined = raiz)", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const parent = await repository.create({
      projectId: project.id,
      kind: "note",
    });
    const child = await repository.create({
      projectId: project.id,
      kind: "note",
      parentId: parent.id,
    });

    await repository.softDelete(parent.id);
    expect(await repository.listByProject(project.id)).toEqual([child]);
    expect(await repository.listDeleted()).toHaveLength(1);

    await repository.restore(parent.id);
    expect(await repository.listByProject(project.id)).toHaveLength(2);

    await repository.setParent(child.id, undefined);
    const after = await repository.getById(child.id);
    expect(after?.parentId).toBeUndefined();

    await repository.hardDelete(child.id);
    expect(await repository.getById(child.id)).toBeUndefined();
  });

  it("setEntityFolderId grava e limpa o folderId da ficha", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const hero = await characterRepository.create({
      projectId: project.id,
      name: "Aurora",
    });
    const folder = await repository.create({
      projectId: project.id,
      kind: "character",
    });

    await setEntityFolderId("character", hero.id, folder.id);
    expect((await characterRepository.getById(hero.id))?.folderId).toBe(
      folder.id,
    );

    await setEntityFolderId("character", hero.id, undefined);
    expect((await characterRepository.getById(hero.id))?.folderId).toBeUndefined();
  });
});

describe("resolveFolderDragEnd", () => {
  async function setup() {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const a = await characterRepository.create({
      projectId: project.id,
      name: "Aurora",
    });
    const b = await characterRepository.create({
      projectId: project.id,
      name: "Bento",
    });
    return { project, a, b };
  }

  it("card sobre card (zona central) cria pasta com os dois", async () => {
    const { project, a, b } = await setup();
    const outcome = await resolveFolderDragEnd({
      kind: "character",
      projectId: project.id,
      folders: [],
      viewFolderIds: [],
      openFolderId: null,
      activeId: a.id,
      overId: b.id,
      activeRect: centered,
      overRect: over,
    });
    expect(outcome).toBe("created");

    const folders = await repository.listByProject(project.id);
    expect(folders).toHaveLength(1);
    expect(folders[0]?.name).toBe("Nova pasta");
    expect((await characterRepository.getById(a.id))?.folderId).toBe(
      folders[0]?.id,
    );
    expect((await characterRepository.getById(b.id))?.folderId).toBe(
      folders[0]?.id,
    );
  });

  it("card sobre pasta move para dentro; borda entre cards reordena", async () => {
    const { project, a, b } = await setup();
    const folder = await createFolderWith({
      kind: "character",
      projectId: project.id,
      entityIds: [b.id],
    });
    expect(
      await resolveFolderDragEnd({
        kind: "character",
        projectId: project.id,
        folders: [folder],
        viewFolderIds: [folder.id],
        openFolderId: null,
        activeId: a.id,
        overId: folder.id,
        activeRect: edge,
        overRect: over,
      }),
    ).toBe("moved");
    expect((await characterRepository.getById(a.id))?.folderId).toBe(folder.id);

    expect(
      await resolveFolderDragEnd({
        kind: "character",
        projectId: project.id,
        folders: [folder],
        viewFolderIds: [],
        openFolderId: folder.id,
        activeId: a.id,
        overId: b.id,
        activeRect: edge,
        overRect: over,
      }),
    ).toBe("reorder");
  });

  it("pasta sobre a própria filha é ignorada (sem ciclo)", async () => {
    const { project } = await setup();
    const parent = await repository.create({
      projectId: project.id,
      kind: "character",
    });
    const child = await repository.create({
      projectId: project.id,
      kind: "character",
      parentId: parent.id,
    });
    expect(
      await resolveFolderDragEnd({
        kind: "character",
        projectId: project.id,
        folders: [parent, child],
        viewFolderIds: [parent.id, child.id],
        openFolderId: null,
        activeId: parent.id,
        overId: child.id,
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("ignored");
    expect((await repository.getById(parent.id))?.parentId).toBeUndefined();
  });

  it("soltar na seta voltar devolve a ficha para a pasta pai", async () => {
    const { project, a } = await setup();
    const parent = await repository.create({
      projectId: project.id,
      kind: "character",
    });
    await setEntityFolderId("character", a.id, parent.id);

    expect(
      await resolveFolderDragEnd({
        kind: "character",
        projectId: project.id,
        folders: [parent],
        viewFolderIds: [],
        openFolderId: parent.id,
        activeId: a.id,
        overId: FOLDER_EXIT_ID,
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("exited");
    expect(
      (await characterRepository.getById(a.id))?.folderId,
    ).toBeUndefined();
  });

  it("reordenar pastas persiste a nova ordem", async () => {
    const { project } = await setup();
    const first = await repository.create({
      projectId: project.id,
      kind: "character",
      name: "A",
    });
    const second = await repository.create({
      projectId: project.id,
      kind: "character",
      name: "B",
    });
    expect(
      await resolveFolderDragEnd({
        kind: "character",
        projectId: project.id,
        folders: [first, second],
        viewFolderIds: [first.id, second.id],
        openFolderId: null,
        activeId: second.id,
        overId: first.id,
        activeRect: edge,
        overRect: over,
      }),
    ).toBe("reordered");
    const list = await repository.listByProject(project.id);
    expect(list.map((folder) => folder.id)).toEqual([second.id, first.id]);
  });
});

describe("deleteFolderCascade / restoreFolderCascade", () => {
  it("apaga e restaura a pasta, as internas e as fichas contidas", async () => {
    const project = await projectRepository.create({
      title: "Romance",
      status: "draft",
    });
    const hero = await characterRepository.create({
      projectId: project.id,
      name: "Aurora",
    });
    const villain = await characterRepository.create({
      projectId: project.id,
      name: "Kinger",
    });
    const outsider = await characterRepository.create({
      projectId: project.id,
      name: "Bento",
    });
    const parent = await createFolderWith({
      kind: "character",
      projectId: project.id,
      entityIds: [hero.id, villain.id],
    });
    const child: Folder = await folderRepository.create({
      projectId: project.id,
      kind: "character",
      parentId: parent.id,
    });
    await setEntityFolderId("character", villain.id, child.id);

    await deleteFolderCascade(parent);
    expect(await repository.listByProject(project.id)).toHaveLength(0);
    expect(await characterRepository.listByProject(project.id)).toEqual([
      outsider,
    ]);
    expect(await repository.listDeleted()).toHaveLength(2);
    expect(await characterRepository.listDeleted()).toHaveLength(2);

    await restoreFolderCascade(parent.id);
    const folders = await repository.listByProject(project.id);
    expect(folders.map((folder) => folder.id).sort()).toEqual(
      [parent.id, child.id].sort(),
    );
    const characters = await characterRepository.listByProject(project.id);
    expect(characters.map((character) => character.id).sort()).toEqual(
      [hero.id, villain.id, outsider.id].sort(),
    );
    expect(
      (await characterRepository.getById(villain.id))?.folderId,
    ).toBe(child.id);
  });
});
