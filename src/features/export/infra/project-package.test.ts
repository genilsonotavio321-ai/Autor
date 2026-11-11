// @vitest-environment node
import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";

import {
  buildProjectPackageBlob,
  importProjectPackageJson,
} from "./project-package";

const projectTables = [
  "projects",
  "chapters",
  "scenes",
  "characters",
  "locations",
  "loreEntries",
  "plotBeats",
  "timelineEvents",
  "storyArcs",
  "notes",
  "tags",
  "snippets",
  "attachments",
  "versions",
  "ideaCards",
  "ideaGroups",
  "ideaBoards",
  "folders",
] as const;

beforeEach(async () => {
  await ensureDbReady();
  const db = getDatabase();
  await db.transaction(
    "rw",
    [...projectTables, "settings", "promptItems"],
    async () => {
      for (const tableName of [...projectTables, "settings", "promptItems"]) {
        await db.table(tableName).clear();
      }
    },
  );
});

describe("project package", () => {
  it("round-trips complete project data with remapped references and blobs", async () => {
    const db = getDatabase();
    const timestamp = "2026-10-01T12:00:00.000Z";
    const projectId = "source-project";
    const chapterId = "source-chapter";
    const sceneId = "source-scene";
    const characterId = "source-character";
    const friendId = "source-friend";
    const locationId = "source-location";
    const loreId = "source-lore";
    const linkedLoreId = "source-linked-lore";
    const tagId = "source-tag";
    const folderId = "source-folder";
    const arcId = "source-arc";
    const ideaCardId = "source-idea-card";
    const linkedIdeaCardId = "source-linked-idea-card";
    const groupId = "source-group";

    await db.projects.add({
      id: projectId,
      title: "Projeto completo",
      status: "active",
      settings: { editor: { fontSize: 16 } },
      lastEdit: { chapterId, sceneId, cursorOffset: 2, scrollY: 10, updatedAt: timestamp },
      coverBlob: new Blob(["cover-image"], { type: "image/png" }),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const rows: Record<string, object[]> = {
      chapters: [
        {
          id: chapterId,
          projectId,
          title: "Capítulo 1",
          order: 0,
          status: "draft",
          wordCount: 10,
          content: { type: "doc", content: [] },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      scenes: [
        {
          id: sceneId,
          chapterId,
          title: "Cena 1",
          order: 0,
          status: "draft",
          povCharacterId: characterId,
          locationId,
          content: { type: "doc", content: [] },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      characters: [
        {
          id: characterId,
          projectId,
          name: "Ana",
          role: "protagonist",
          traits: [],
          relationships: [{ targetId: friendId, type: "friend" }],
          tags: [tagId],
          folderId,
          avatarBlob: new Blob(["avatar-image"], { type: "image/jpeg" }),
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: friendId,
          projectId,
          name: "Bia",
          role: "supporting",
          traits: [],
          relationships: [],
          tags: [],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      locations: [
        {
          id: locationId,
          projectId,
          name: "Taverna",
          type: "building",
          tags: [tagId],
          folderId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      loreEntries: [
        {
          id: loreId,
          projectId,
          title: "Chave",
          category: "Objeto",
          content: "",
          tags: [tagId],
          linkedIds: [linkedLoreId],
          isTrackableItem: true,
          initialOwnerId: characterId,
          folderId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: linkedLoreId,
          projectId,
          title: "Lenda",
          category: "Geral",
          content: "",
          tags: [],
          linkedIds: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: timestamp,
        },
      ],
      plotBeats: [
        {
          id: "source-beat",
          projectId,
          structure: "three_acts",
          title: "Incidente",
          order: 0,
          linkedChapterId: chapterId,
          linkedSceneId: sceneId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      timelineEvents: [
        {
          id: "source-event",
          projectId,
          date: "2026",
          title: "A chave aparece",
          characterIds: [characterId],
          locationId,
          linkedChapterId: chapterId,
          linkedSceneId: sceneId,
          arcIds: [arcId],
          stateChanges: [
            { kind: "character", characterId, motivation: "Proteger a chave" },
            { kind: "item", action: "transfer", itemId: loreId, characterId },
          ],
          tags: [tagId],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      storyArcs: [
        {
          id: arcId,
          projectId,
          name: "Jornada",
          order: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      notes: [
        {
          id: "source-note",
          projectId,
          title: "Nota",
          content: "Lembrar da chave",
          pinned: false,
          tags: [tagId],
          folderId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      tags: [{ id: tagId, projectId, name: "Importante", color: "#123456" }],
      snippets: [
        {
          id: "source-snippet",
          projectId,
          title: "Frase",
          content: "Uma frase reutilizável",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      attachments: [
        {
          id: "source-attachment",
          projectId,
          entityType: "character",
          entityId: characterId,
          dataUrl: "data:image/png;base64,aW1hZ2U=",
          createdAt: timestamp,
        },
        {
          id: "orphan-attachment",
          projectId,
          entityType: "character",
          entityId: "missing-character",
          dataUrl: "data:image/png;base64,aW1hZ2U=",
          createdAt: timestamp,
        },
      ],
      versions: [
        {
          id: "source-version",
          entityType: "chapter",
          entityId: chapterId,
          snapshot: { characterId, chapterId },
          auto: false,
          createdAt: timestamp,
        },
      ],
      ideaCards: [
        {
          id: ideaCardId,
          projectId,
          title: "Ideia",
          content: "Abrir a porta",
          x: 10,
          y: 20,
          sentSceneId: sceneId,
          links: [linkedIdeaCardId],
          groupId,
          refType: "character",
          refId: characterId,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        {
          id: linkedIdeaCardId,
          projectId,
          title: "Ideia ligada",
          content: "",
          x: 30,
          y: 40,
          links: [ideaCardId],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      ideaGroups: [
        {
          id: groupId,
          projectId,
          name: "Ato 1",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      ideaBoards: [
        {
          id: "source-board",
          projectId,
          name: "Quadro salvo",
          items: [
            {
              key: "item-a",
              title: "Cartão",
              content: "",
              x: 0,
              y: 0,
              links: ["item-b"],
              refType: "character",
              refId: characterId,
            },
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
      folders: [
        {
          id: folderId,
          projectId,
          kind: "character",
          name: "Principais",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      ],
    };

    await db.transaction(
      "rw",
      [...projectTables, "settings", "promptItems"],
      async () => {
        for (const [tableName, tableRows] of Object.entries(rows)) {
          await db.table(tableName).bulkAdd(tableRows as never[]);
        }
        await db.settings.put({ key: "app-setting", value: "keep" });
        await db.promptItems.add({
          id: "global-prompt",
          kind: "whatIf",
          variants: ["Global"],
          enabled: true,
          order: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      },
    );

    const packageBlob = await buildProjectPackageBlob(projectId);
    const packageJson = await packageBlob.text();
    const parsed = JSON.parse(packageJson) as {
      app: string;
      kind: string;
      formatVersion: number;
      tables: Record<string, unknown[]>;
    };
    expect(parsed).toMatchObject({
      app: "autor",
      kind: "project",
      formatVersion: 1,
    });
    expect(parsed.tables).not.toHaveProperty("settings");
    expect(parsed.tables).not.toHaveProperty("promptItems");
    expect(parsed.tables.loreEntries).toHaveLength(2);
    expect(parsed.tables.attachments).toHaveLength(1);

    const imported = await importProjectPackageJson(packageJson);
    expect(imported.id).not.toBe(projectId);
    expect(imported.title).toBe("Projeto completo");
    expect(imported.coverBlob).toBeInstanceOf(Blob);
    expect(await imported.coverBlob?.text()).toBe("cover-image");

    const importedChapters = await db.chapters
      .where("projectId")
      .equals(imported.id)
      .toArray();
    const importedScenes = await db.scenes
      .where("chapterId")
      .equals(importedChapters[0]!.id)
      .toArray();
    const importedCharacters = await db.characters
      .where("projectId")
      .equals(imported.id)
      .toArray();
    const importedAna = importedCharacters.find(
      (character) => character.name === "Ana",
    )!;
    const importedBia = importedCharacters.find(
      (character) => character.name === "Bia",
    )!;
    const importedLocations = await db.locations
      .where("projectId")
      .equals(imported.id)
      .toArray();
    const importedLore = await db.loreEntries
      .where("projectId")
      .equals(imported.id)
      .toArray();
    const importedEvent = (await db.timelineEvents
      .where("projectId")
      .equals(imported.id)
      .first())!;
    const importedIdeaCards = await db.ideaCards
      .where("projectId")
      .equals(imported.id)
      .toArray();
    const importedIdea = importedIdeaCards.find(
      (card) => card.title === "Ideia",
    )!;
    const importedLinkedIdea = importedIdeaCards.find(
      (card) => card.title === "Ideia ligada",
    )!;
    const importedArc = (await db.storyArcs
      .where("projectId")
      .equals(imported.id)
      .first())!;
    const importedVersion = (await db.versions
      .filter((version) => version.entityId === importedChapters[0]!.id)
      .first())!;
    const importedAttachment = (await db.attachments
      .where("projectId")
      .equals(imported.id)
      .first())!;
    const importedBoard = (await db.ideaBoards
      .where("projectId")
      .equals(imported.id)
      .first())!;
    const importedGroup = (await db.ideaGroups
      .where("projectId")
      .equals(imported.id)
      .first())!;
    const importedFolder = (await db.folders
      .where("projectId")
      .equals(imported.id)
      .first())!;
    const importedTag = (await db.tags
      .where("projectId")
      .equals(imported.id)
      .first())!;

    expect(importedScenes[0]).toMatchObject({
      chapterId: importedChapters[0]!.id,
      povCharacterId: importedAna.id,
      locationId: importedLocations[0]!.id,
    });
    expect(importedAna).toMatchObject({
      relationships: [{ targetId: importedBia.id, type: "friend" }],
      tags: [importedTag.id],
      folderId: importedFolder.id,
      avatarBlob: expect.any(Blob),
    });
    expect(await importedAna.avatarBlob?.text()).toBe("avatar-image");
    expect(importedLore.find((entry) => entry.title === "Chave")).toMatchObject({
      linkedIds: [importedLore.find((entry) => entry.title === "Lenda")!.id],
      initialOwnerId: importedAna.id,
      folderId: importedFolder.id,
      tags: [importedTag.id],
    });
    expect(imported).toMatchObject({
      lastEdit: {
        chapterId: importedChapters[0]!.id,
        sceneId: importedScenes[0]!.id,
      },
    });
    expect(importedEvent).toMatchObject({
      characterIds: [importedAna.id],
      locationId: importedLocations[0]!.id,
      linkedChapterId: importedChapters[0]!.id,
      linkedSceneId: importedScenes[0]!.id,
      arcIds: [importedArc.id],
      stateChanges: [
        { kind: "character", characterId: importedAna.id },
        {
          kind: "item",
          itemId: importedLore.find((entry) => entry.title === "Chave")!.id,
          characterId: importedAna.id,
        },
      ],
      tags: [importedTag.id],
    });
    expect(importedIdea).toMatchObject({
      sentSceneId: importedScenes[0]!.id,
      links: [importedLinkedIdea.id],
      groupId: importedGroup.id,
      refId: importedAna.id,
    });
    expect(importedVersion).toMatchObject({
      snapshot: { chapterId: importedChapters[0]!.id, characterId: importedAna.id },
    });
    expect(importedAttachment).toMatchObject({
      entityType: "character",
      entityId: importedAna.id,
    });
    expect(importedBoard.items[0]).toMatchObject({
      key: "item-a",
      links: ["item-b"],
      refId: importedAna.id,
    });
    expect(await db.settings.get("app-setting")).toEqual({
      key: "app-setting",
      value: "keep",
    });
    expect(await db.promptItems.get("global-prompt")).toBeDefined();
    expect(await db.projects.count()).toBe(2);
  });

  it("rejects malformed or unsupported packages without changing existing data", async () => {
    const db = getDatabase();
    await db.projects.add({
      id: "existing-project",
      title: "Preservado",
      status: "active",
      settings: {},
      createdAt: "2026-10-01T12:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
    });

    await expect(importProjectPackageJson("{not json")).rejects.toThrow(
      "Arquivo de projeto inválido.",
    );
    await expect(
      importProjectPackageJson(
        JSON.stringify({ app: "autor", kind: "project", formatVersion: 2, tables: {} }),
      ),
    ).rejects.toThrow("Arquivo de projeto inválido.");

    expect(await db.projects.count()).toBe(1);
    expect(await db.projects.get("existing-project")).toMatchObject({
      title: "Preservado",
    });
  });
});
