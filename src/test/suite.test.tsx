import "fake-indexeddb/auto";

import { Editor } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import StarterKit from "@tiptap/starter-kit";
import { liveQuery } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase } from "@/infra/db";
import type { Json, Location } from "@/shared/types/database";
import { extractDocText } from "@/shared/lib/text";
import { docToMarkdown, markdownToDoc } from "@/features/export/domain/markdown";

import { createAutosave } from "@/features/editor/application/autosave";
import { GrifarMark } from "@/features/editor/domain/grifar-mark";
import { findTextRanges } from "@/features/editor/domain/replace";
import { detectTextIssues } from "@/features/editor/domain/review";
import { diffDocAgainstSnapshot } from "@/features/editor/domain/version-diff";
import { unzipSync, zipSync } from "fflate";

import { useUiStore } from "@/shared/store/ui-store";
import { TABLE_NAMES } from "@/infra/db/migrations";
import { buildDocxBlob } from "@/features/export/infra/docx-export";
import { importDocxFile } from "@/features/export/infra/docx-import";
import { buildBackupBlob, importBackupJson, parseBackup } from "@/features/export/infra/backup";

import { DexieCharacterRepository } from "@/features/characters/infra/dexie-character-repository";
import { FEMALE_NAMES, MALE_NAMES, buildRandomCharacter } from "@/features/characters/domain/random-character";
import { collectSubtreeIds, directCounts, effectiveParentId, itemsInFolder, rootItems } from "@/features/folders/domain/folder-tree";
import { DexieNoteRepository } from "@/features/notes/infra/dexie-note-repository";
import { findContinuityIssues } from "@/features/plot/domain/continuity";
import { computeChapterOrder, computeSceneMove, moveItem, renumber } from "@/features/plot/domain/ordering";
import { DexiePlotBeatRepository } from "@/features/plot/infra/dexie-plot-beat-repository";
import { DexieSceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { emptyTrash } from "@/features/projects/application/trash-service";
import { CHAPTER_STATUS_COLORS, CHAPTER_STATUS_DOT, CHAPTER_STATUS_LABELS } from "@/features/projects/domain/repository";
import { DexieChapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import { renameMentionsInContent } from "@/features/mentions/domain/rename-mentions";
import { activityLevel, buildActivityDays, chunkWeeks, startOfWeekMonday, type ActivityDay } from "@/features/productivity/domain/activity-chart";
import { decideGoalNotification, decideStaleNotifications, latestCreatedAt } from "@/features/productivity/domain/notifications";
import { EMPTY_WRITING_LOG, addSprint, addWords, estimateReadingMinutes, summariseWriting, toDayKey, type WritingLog } from "@/features/productivity/domain/writing-log";
import { WRITING_LOG_KEY, getWritingLog, recordSprint, recordWords } from "@/features/productivity/infra/writing-log-repository";
import { buildSearchDocs } from "@/features/search/domain/search-doc";
import { createSearchIndex, searchDocs } from "@/features/search/application/search-service";
import { partitionLoreEntries } from "@/features/world/domain/lore-entry-collections";
import { MAX_LOCATION_DEPTH, locationDepth, locationParentCandidates } from "@/features/world/domain/repository";

// ---------------------------------------------------------------------------
// Helpers compartilhados
// ---------------------------------------------------------------------------

// O Blob do jsdom não expõe arrayBuffer(); os backups serializam imagens com ele.
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(this);
    });
  };
}

/** Limpa todas as tabelas do banco antes de cada teste. */
beforeEach(async () => {
  const db = getDatabase();
  const names = db.tables.map((table) => table.name);
  await db.transaction("rw", names.map((name) => db.table(name)), async () => {
    for (const name of names) await db.table(name).clear();
  });
});

function doc(...content: Json[]): Json {
  return { type: "doc", content };
}

function paragraph(text: string): Json {
  return { type: "paragraph", content: text ? [{ type: "text", text }] : [] };
}

function heading(level: number, text: string): Json {
  return { type: "heading", attrs: { level }, content: [{ type: "text", text }] };
}

// ---------------------------------------------------------------------------
// Editor — autosave, grifo, busca, revisão e diff
// ---------------------------------------------------------------------------

describe("editor", () => {
  describe("createAutosave", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("salva uma vez com o último payload depois do debounce", async () => {
      const save = vi.fn(async () => undefined);
      const autosave = createAutosave(save, 800);

      autosave.schedule("a");
      autosave.schedule("ab");
      autosave.schedule("abc");
      expect(save).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(800);
      expect(save).toHaveBeenCalledExactlyOnceWith("abc");
    });

  });

  describe("GrifarMark", () => {
    function makeEditor(content: unknown = "<p>texto de teste</p>") {
      return new Editor({
        extensions: [StarterKit, GrifarMark],
        content: content as never,
      });
    }

    function marksOf(editor: Editor) {
      const json = editor.getJSON() as {
        content: Array<{
          content?: Array<{ marks?: Array<{ type: string }> }>;
        }>;
      };
      return json.content[0]?.content?.[0]?.marks ?? [];
    }

    it("aplica, serializa como span.grifar e remove a marca", () => {
      const editor = makeEditor();
      editor.commands.setTextSelection({ from: 1, to: 5 });
      editor.commands.setMark("grifar");
      expect(marksOf(editor).some((mark) => mark.type === "grifar")).toBe(true);
      expect(editor.getHTML()).toContain('class="grifar"');

      editor.commands.unsetMark("grifar");
      expect(marksOf(editor).some((mark) => mark.type === "grifar")).toBe(false);
      editor.destroy();
    });

  });

  describe("findTextRanges", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: { group: "block", content: "inline*" },
        heading: { group: "block", content: "inline*" },
        text: { group: "inline" },
      },
    });

    function buildDoc(...blocks: string[]) {
      return schema.node(
        "doc",
        null,
        blocks.map((text) => schema.node("paragraph", null, text ? [schema.text(text)] : [])),
      );
    }

    it("encontra ocorrências com acento, respeita caixa e nunca cruza blocos", () => {
      const document = buildDoc("Água, água e ÁGUA.");
      expect(findTextRanges(document, "água")).toHaveLength(3);
      expect(findTextRanges(document, "água", { caseSensitive: true })).toEqual([
        { from: 7, to: 11 },
      ]);
      expect(findTextRanges(buildDoc("abc", "def"), "cd")).toEqual([]);
      expect(findTextRanges(buildDoc("qualquer texto"), "")).toEqual([]);
      expect(findTextRanges(buildDoc("Preço (R$) final"), "(R$)")).toEqual([
        { from: 7, to: 11 },
      ]);
    });

  });

  describe("detectTextIssues", () => {
    it("sinaliza palavra repetida, espaços e pontuação", () => {
      const repeated = detectTextIssues("eu vi o o gato").filter(
        (issue) => issue.type === "repeated-word",
      );
      expect(repeated).toHaveLength(1);
      expect(repeated[0]?.suggestion).toBe("o");

      expect(detectTextIssues("o orfanato")).toHaveLength(0);
      expect(
        detectTextIssues("ela  correu rápido").filter((i) => i.type === "spacing"),
      ).toHaveLength(1);
      expect(
        detectTextIssues("ela chegou , tarde").find((i) => i.type === "punctuation")
          ?.suggestion,
      ).toBe(",");
      expect(detectTextIssues("no fim..")).toHaveLength(1);
      expect(detectTextIssues("no fim...")).toHaveLength(0);
    });

  });

  describe("version-diff", () => {

    it("compara com LCS marcando removidos e adicionados", () => {
      const snapshot = doc(paragraph("A"), paragraph("B"), paragraph("C"));
      const current = doc(paragraph("A"), paragraph("X"), paragraph("B"), paragraph("C"));
      expect(
        diffDocAgainstSnapshot(current, snapshot).map(
          (line) => `${line.type}:${line.block.text}`,
        ),
      ).toEqual(["same:A", "removed:X", "same:B", "same:C"]);

      const levelChange = diffDocAgainstSnapshot(
        doc(heading(2, "Título")),
        doc(heading(1, "Título")),
      );
      expect(levelChange.map((line) => line.type)).toEqual(["removed", "added"]);
    });
  });

});

// ---------------------------------------------------------------------------
// Export — markdown
// ---------------------------------------------------------------------------

describe("markdown", () => {
  it("serializa e relê títulos, marcas, listas e citação", () => {
    const original = doc(
      heading(1, "Título"),
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Um " },
          { type: "text", text: "forte", marks: [{ type: "bold" }] },
          { type: "text", text: " e " },
          { type: "text", text: "ênfase", marks: [{ type: "italic" }] },
          { type: "text", text: "." },
        ],
      },
      {
        type: "bulletList",
        content: [
          { type: "listItem", content: [paragraph("um")] },
          { type: "listItem", content: [paragraph("dois")] },
        ],
      },
      { type: "blockquote", content: [paragraph("citação")] },
    );

    const markdown = docToMarkdown(original);
    expect(markdown).toContain("# Título");
    expect(markdown).toContain("Um **forte** e *ênfase*.");
    expect(markdown).toContain("- um\n- dois");
    expect(markdown).toContain("> citação");
    expect(extractDocText(markdownToDoc(markdown))).toBe(
      extractDocText(original),
    );
  });
});

// ---------------------------------------------------------------------------
// Plot — ordenação, continuidade e cenas
// ---------------------------------------------------------------------------

describe("plot", () => {
  const projectRepository = new DexieProjectRepository();
  const chapterRepository = new DexieChapterRepository();
  const sceneRepository = new DexieSceneRepository();

  async function seedProject() {
    return projectRepository.create({ title: "Romance", status: "draft" });
  }

  describe("ordering", () => {
    it("move/renumber sem mutar e reordena capítulos", () => {
      const original = ["a", "b", "c"];
      expect(moveItem(original, 2, 0)).toEqual(["c", "a", "b"]);
      expect(original).toEqual(["a", "b", "c"]);
      expect(renumber([{ id: "x" }, { id: "y" }])).toEqual([
        { id: "x", order: 1 },
        { id: "y", order: 2 },
      ]);

      const chapters = [
        { id: "c1", order: 1 },
        { id: "c2", order: 2 },
        { id: "c3", order: 3 },
      ] as never;
      expect(computeChapterOrder(chapters, "c3", "c1")).toEqual([
        { id: "c3", order: 1 },
        { id: "c1", order: 2 },
        { id: "c2", order: 3 },
      ]);
      expect(computeChapterOrder(chapters, "nope", "c1")).toEqual([]);
      expect(computeChapterOrder(chapters, "c1", "c1")).toEqual([]);
    });

  });

  describe("continuity", () => {

    it("detecta conflitos de local e uso de item destruído", () => {
      const event = (id: string, date: string, patch: Record<string, unknown>) =>
        ({
          id,
          projectId: "p1",
          date,
          title: id,
          characterIds: [],
          tags: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          ...patch,
        }) as never;

      const exact = findContinuityIssues([
        event("a", "1889-05-12", { time: "10:00", characterIds: ["ana"], locationId: "castle" }),
        event("b", "1889-05-12", { time: "10:00", characterIds: ["ana"], locationId: "forest" }),
      ]);
      expect(exact).toContainEqual(
        expect.objectContaining({
          kind: "location-conflict",
          severity: "confirmed",
          characterId: "ana",
          eventId: "b",
          relatedEventId: "a",
        }),
      );

      const possible = findContinuityIssues([
        event("a", "1889-05-12", { characterIds: ["ana"], locationId: "castle" }),
        event("b", "1889-05-12", { characterIds: ["ana"], locationId: "forest" }),
      ]);
      expect(possible).toContainEqual(
        expect.objectContaining({ kind: "location-conflict", severity: "possible" }),
      );

      expect(
        findContinuityIssues([
          event("a", "1889-05-12", { time: "10:00", characterIds: ["ana"], locationId: "castle" }),
          event("b", "1889-05-12", { time: "11:00", characterIds: ["ana"], locationId: "forest" }),
        ]),
      ).toEqual([]);

      const destroyed = findContinuityIssues([
        event("destroy", "1889-05-12", {
          stateChanges: [{ kind: "item", action: "destroy", itemId: "sword" }],
        }),
        event("use", "1890-01-01", {
          stateChanges: [{ kind: "item", action: "use", itemId: "sword", characterId: "ana" }],
        }),
      ]);
      expect(destroyed).toContainEqual(
        expect.objectContaining({
          kind: "item-used-after-destruction",
          severity: "confirmed",
          eventId: "use",
          relatedEventId: "destroy",
          itemId: "sword",
        }),
      );
    });

  });

  describe("DexieSceneRepository", () => {
    it("cria com defaults, reordena entre capítulos e lê por projeto", async () => {
      const project = await seedProject();
      const chapterA = await chapterRepository.create({ projectId: project.id });
      const chapterB = await chapterRepository.create({ projectId: project.id });
      const s1 = await sceneRepository.create({ chapterId: chapterA.id });
      const s2 = await sceneRepository.create({ chapterId: chapterB.id });
      const s3 = await sceneRepository.create({ chapterId: chapterA.id });

      expect(s1.title).toBe("Cena 1");
      expect(s1.order).toBe(1);
      expect(s1.status).toBe("todo");
      expect((await sceneRepository.listByChapter(chapterA.id)).map((s) => s.id)).toEqual([
        s1.id,
        s3.id,
      ]);
      expect((await sceneRepository.listByProject(project.id)).map((s) => s.id)).toEqual([
        s1.id,
        s3.id,
        s2.id,
      ]);

      const current = new Map([
        [chapterA.id, await sceneRepository.listByChapter(chapterA.id)],
        [chapterB.id, await sceneRepository.listByChapter(chapterB.id)],
      ]);
      await sceneRepository.applyMoves(computeSceneMove(current, s3.id, chapterB.id, 1));
      expect((await sceneRepository.listByChapter(chapterB.id)).map((s) => s.id)).toEqual([
        s2.id,
        s3.id,
      ]);

      await chapterRepository.softDelete(chapterB.id);
      expect((await sceneRepository.listByProject(project.id)).map((s) => s.id)).toEqual([
        s1.id,
      ]);
    });

  });

});

// ---------------------------------------------------------------------------
// Projetos — schema, ordenação, capítulos, projetos e lixeira
// ---------------------------------------------------------------------------

describe("projects", () => {
  const projectRepository = new DexieProjectRepository();
  const chapterRepository = new DexieChapterRepository();

  it("define rótulo, cor e ponto distintos para cada status de capítulo", () => {
    const colors = new Set<string>();
    for (const status of ["todo", "draft", "revising", "done"] as const) {
      expect(CHAPTER_STATUS_LABELS[status]).toBeTruthy();
      expect(CHAPTER_STATUS_COLORS[status]).toBeTruthy();
      expect(CHAPTER_STATUS_DOT[status]).toBeTruthy();
      colors.add(CHAPTER_STATUS_COLORS[status]);
    }
    expect(colors.size).toBe(4);
  });

  describe("trash-service", () => {

    it("purga projeto em cascata e emptyTrash preserva projeto sadio", async () => {
      const characterRepository = new DexieCharacterRepository();
      const noteRepository = new DexieNoteRepository();
      const beatRepository = new DexiePlotBeatRepository();
      const { tagRepository } = await import("@/features/tags/infra/dexie-tag-repository");
      const { attachmentRepository } = await import(
        "@/features/attachments/infra/dexie-attachment-repository"
      );

      const trashedProject = await projectRepository.create({
        title: "Apagado",
        status: "draft",
      });
      const activeChapter = await chapterRepository.create({
        projectId: trashedProject.id,
      });
      const character = await characterRepository.create({
        projectId: trashedProject.id,
        name: "Davi",
      });
      const note = await noteRepository.create({
        projectId: trashedProject.id,
        title: "Rascunho",
      });
      const tag = await tagRepository.create({
        projectId: trashedProject.id,
        name: "arco",
      });
      await beatRepository.create({
        projectId: trashedProject.id,
        scope: "main",
        title: "Ato I",
      });
      await attachmentRepository.add({
        projectId: trashedProject.id,
        entityType: "character",
        entityId: character.id,
        dataUrl: "data:image/jpeg;base64,ccc",
      });
      await projectRepository.softDelete(trashedProject.id);

      const healthy = await projectRepository.create({ title: "Vivo", status: "draft" });
      const healthyChapter = await chapterRepository.create({ projectId: healthy.id });
      const trashedNote = await noteRepository.create({
        projectId: healthy.id,
        title: "Lixeira",
      });
      await noteRepository.softDelete(trashedNote.id);

      await emptyTrash();

      expect(await projectRepository.listDeleted()).toHaveLength(0);
      expect(await chapterRepository.getById(activeChapter.id)).toBeUndefined();
      expect(await chapterRepository.getById(healthyChapter.id)).toBeDefined();
      expect(await characterRepository.getById(character.id)).toBeUndefined();
      expect(await noteRepository.getById(note.id)).toBeUndefined();
      expect(await tagRepository.getById(tag.id)).toBeUndefined();
      expect(await beatRepository.listByProject(trashedProject.id)).toHaveLength(0);
      expect(await attachmentRepository.listByProject(trashedProject.id)).toHaveLength(0);
      expect(await noteRepository.listDeleted()).toHaveLength(0);
      expect(await projectRepository.getById(healthy.id)).toBeDefined();
    });

  });
});

// ---------------------------------------------------------------------------
// Personagens, notas e pastas
// ---------------------------------------------------------------------------

describe("characters", () => {
  it("gera fichas determinísticas sem repetir nomes", () => {
    const sequence = (values: number[]) => {
      let index = 0;
      return () => {
        const value = values[index] ?? 0;
        index = (index + 1) % values.length;
        return value;
      };
    };
    const draws = [0.5, 0.9, 0.4, 0.1, 0.2, 0.5, 0.7, 0.75];
    const first = buildRandomCharacter([], sequence(draws));
    expect(buildRandomCharacter([], sequence(draws))).toEqual(first);
    expect(FEMALE_NAMES).toContain(first.name);
    expect(first.gender).toBe("feminino");
    expect(first.traits).toHaveLength(3);
    expect(first.relationships).toEqual([]);

    const existing = [
      {
        id: "c-1",
        projectId: "p1",
        name: "Aurêlio",
        role: "supporting",
        traits: [],
        relationships: [],
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ] as never;
    const duplicate = buildRandomCharacter(existing, sequence([0]));
    expect(duplicate.gender).toBe("masculino");
    expect(duplicate.name).toBe("Aurêlio II");
    expect(MALE_NAMES).toContain(duplicate.name.replace(" II", ""));
  });

});

describe("folders", () => {
  const folder = (overrides: Record<string, unknown> = {}) =>
    ({
      id: "f-1",
      projectId: "p-1",
      kind: "character",
      name: "Pasta",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...overrides,
    }) as never;

  it("coleta subárvores, trata órfãs e conta membros diretos", () => {
    const folders = [
      folder({ id: "a" }),
      folder({ id: "b", parentId: "a" }),
      folder({ id: "c", parentId: "b" }),
      folder({ id: "d" }),
    ] as never;
    expect(collectSubtreeIds(folders, "a")).toEqual(["a", "b", "c"]);

    const live = new Set<string>(["a"]);
    expect(effectiveParentId(folder({ parentId: "a" }), live)).toBe("a");
    expect(effectiveParentId(folder({ parentId: "ghost" }), live)).toBeNull();
    expect(effectiveParentId(folder({}), live)).toBeNull();

    const items = [{ id: "1" }, { id: "2", folderId: "a" }, { id: "3", folderId: "ghost" }];
    expect(rootItems(items, live).map((item) => item.id)).toEqual(["1", "3"]);
    expect(itemsInFolder(items, "a").map((item) => item.id)).toEqual(["2"]);

    expect(directCounts(folders, [{ folderId: "a" }, { folderId: "b" }, {}]).get("a")).toBe(
      2,
    );
  });

});

// ---------------------------------------------------------------------------
// Criatividade — prompts, canvas, quadros e cards de ideia
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Menções e produtividade
// ---------------------------------------------------------------------------

describe("mentions", () => {
  it("renomeia ocorrências inteiras preservando caixa, marcas e o input", () => {
    const doc = (text: string): Json => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const textOf = (content: Json) =>
      ((content as { content: { content: { text: string }[] }[] }).content[0]
        ?.content[0]?.text ?? "");

    const result = renameMentionsInContent(
      doc("Davi chegou. davi saiu. DAVI voltou."),
      "Davi",
      "Davi Silva",
    );
    expect(result.count).toBe(3);
    expect(textOf(result.content)).toBe(
      "Davi Silva chegou. davi silva saiu. DAVI SILVA voltou.",
    );
    expect(
      renameMentionsInContent(doc("Davi Silva chegou."), "Davi", "Davi Silva").count,
    ).toBe(0);
    expect(
      renameMentionsInContent(doc("Davirado viu Davi."), "Davi", "Ana").count,
    ).toBe(1);
    expect(renameMentionsInContent(doc("A chegou."), "A", "Alberto").count).toBe(0);

    const marked: Json = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Oi " },
            { type: "text", text: "Davi", marks: [{ type: "bold" }] },
          ],
        },
      ],
    };
    const renamed = renameMentionsInContent(marked, "Davi", "Ana");
    const nodes = (renamed.content as { content: { content: Json[] }[] }).content[0]
      ?.content;
    expect(nodes?.[1]).toEqual({ type: "text", text: "Ana", marks: [{ type: "bold" }] });

    const original = doc("Davi chegou.");
    renameMentionsInContent(original, "Davi", "Davi Silva");
    expect(textOf(original)).toBe("Davi chegou.");
  });

});

describe("productivity", () => {
  it("calcula níveis, semanas e blocos do gráfico de atividade", () => {
    expect(activityLevel(0, 500)).toBe(0);
    expect(activityLevel(120, 0)).toBe(1);
    expect(activityLevel(200, 500)).toBe(1);
    expect(activityLevel(400, 500)).toBe(2);
    expect(activityLevel(1200, 500)).toBe(4);

    const monday = startOfWeekMonday(new Date(2026, 9, 14, 15, 30));
    expect(monday.getDay()).toBe(1);
    expect(monday.getDate()).toBe(12);

    const log: WritingLog = { "2026-10-12": { words: 300, sprints: 1 } };
    const days = buildActivityDays(log, new Date(2026, 9, 14), 2, 500);
    expect(days).toHaveLength(10);
    expect(days[7]?.dayKey).toBe("2026-10-12");
    expect(days[7]?.level).toBe(2);
    expect(days[9]?.level).toBe(0);
    expect(
      buildActivityDays({}, new Date(2026, 9, 14), 1, 500).map((day) => day.date.getDate()),
    ).toEqual([12, 13, 14]);

    const cells: ActivityDay[] = Array.from({ length: 10 }, (_, index) => ({
      dayKey: `d${index}`,
      date: new Date(2026, 0, index + 1),
      words: 0,
      level: 0,
    }));
    expect(chunkWeeks(cells).map((week) => week.length)).toEqual([7, 3]);
  });

  it("decide notificações de meta e de escrita parada", () => {
    const evening = new Date("2026-10-29T20:00:00");
    expect(decideGoalNotification(100, 500, evening)).toEqual({
      kind: "goal",
      body: "Você ainda não bateu a meta de 500 palavras hoje.",
    });
    expect(decideGoalNotification(0, 500, new Date("2026-10-29T09:00:00"))).toBeNull();
    expect(decideGoalNotification(500, 500, evening)).toBeNull();

    const flags = { character: true, scene: true, chapter: true };
    const results = decideStaleNotifications(
      {
        character: "2026-10-01T00:00:00.000Z",
        scene: undefined,
        chapter: "2026-10-28T00:00:00.000Z",
      },
      7,
      evening,
      flags,
    );
    expect(results.map((item) => item.kind)).toEqual(["character"]);
    expect(
      decideStaleNotifications(
        { character: "2020-01-01T00:00:00.000Z" },
        7,
        evening,
        { ...flags, character: false },
      ),
    ).toEqual([]);
    expect(
      latestCreatedAt([undefined, "2026-01-02T00:00:00.000Z", null, "2026-02-10T00:00:00.000Z"]),
    ).toBe("2026-02-10T00:00:00.000Z");
  });

  it("soma o diário de escrita, sequência e leitura", () => {
    expect(toDayKey(new Date(2026, 9, 17))).toBe("2026-10-17");
    let log = addWords(EMPTY_WRITING_LOG, "2026-10-17", 120);
    log = addWords(log, "2026-10-17", 80);
    log = addSprint(log, "2026-10-17");
    expect(log["2026-10-17"]).toEqual({ words: 200, sprints: 1 });
    expect(addWords(EMPTY_WRITING_LOG, "2026-10-17", 0)).toEqual({});

    const summary = summariseWriting(
      {
        "2026-10-17": { words: 300, sprints: 1 },
        "2026-10-16": { words: 100, sprints: 0 },
        "2026-10-11": { words: 50, sprints: 0 },
        "2026-10-10": { words: 999, sprints: 0 },
      },
      new Date(2026, 9, 17),
    );
    expect(summary).toMatchObject({ today: 300, week: 450, total: 1449, sprintsToday: 1 });
    expect(
      summariseWriting(
        {
          "2026-10-17": { words: 10, sprints: 0 },
          "2026-10-16": { words: 10, sprints: 0 },
          "2026-10-15": { words: 10, sprints: 0 },
          "2026-10-13": { words: 10, sprints: 0 },
        },
        new Date(2026, 9, 17),
      ).streak,
    ).toBe(3);

    expect(estimateReadingMinutes(0)).toBe(0);
    expect(estimateReadingMinutes(201)).toBe(2);
    expect(estimateReadingMinutes(10_000)).toBe(50);
  });

  it("persiste o diário em settings ignorando valores malformados", async () => {
    expect(await getWritingLog()).toEqual({});
    await recordWords("2026-10-17", 150);
    await recordWords("2026-10-17", 50);
    await recordWords("2026-10-16", 20);
    await recordSprint("2026-10-17");
    expect((await getWritingLog())["2026-10-17"]).toEqual({ words: 200, sprints: 1 });

    await getDatabase().settings.put({
      key: WRITING_LOG_KEY,
      value: { "2026-10-17": "not-an-object", "2026-10-16": { words: 5 } },
    });
    expect(await getWritingLog()).toEqual({ "2026-10-16": { words: 5, sprints: 0 } });
  });
});

// ---------------------------------------------------------------------------
// Anexos, busca, tags e mundo
// ---------------------------------------------------------------------------

describe("search", () => {
  const now = "2026-01-01T00:00:00.000Z";
  const project = (id: string, title: string, patch: Record<string, unknown> = {}) =>
    ({
      id,
      title,
      subtitle: "",
      author: "",
      description: "",
      status: "active",
      settings: {},
      createdAt: now,
      updatedAt: now,
      ...patch,
    }) as never;
  const chapter = (id: string, title: string, text: string) =>
    ({
      id,
      projectId: "p1",
      title,
      order: 1,
      status: "draft",
      wordCount: 0,
      content: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text }] }],
      },
      createdAt: now,
      updatedAt: now,
    }) as never;

  it("busca sem acento, prioriza título e respeita limite", () => {
    const index = createSearchIndex(
      buildSearchDocs({
        projects: [project("p1", "Romance")],
        chapters: [
          chapter("c1", "Capítulo 1", "O dragão místico guardava a floresta"),
          chapter("c2", "Encontro", "Ela olhou para as estrelas"),
        ],
        scenes: [],
        characters: [
          {
            id: "ch1",
            projectId: "p1",
            name: "Dragão Azul",
            role: "protagonist",
            description: "Herói da história",
            traits: [],
            relationships: [],
            tags: [],
            createdAt: now,
            updatedAt: now,
          } as never,
        ],
        locations: [],
        loreEntries: [],
        notes: [],
      }),
    );

    expect(searchDocs(index, "dragão")).toHaveLength(2);
    expect(searchDocs(index, "dragao")).toHaveLength(2);
    const results = searchDocs(index, "dragão");
    expect(results[0]?.doc.id).toBe("ch1");
    expect(results[0]?.matchedTitle).toBe(true);
    expect(results[1]?.matchedTitle).toBe(false);
    expect(searchDocs(index, "dragão", 1)).toHaveLength(1);
    expect(searchDocs(index, "   ")).toEqual([]);
    expect(searchDocs(null, "dragão")).toEqual([]);
  });
});

describe("world", () => {
  it("separa Lore de itens rastreáveis", () => {
    const entry = (id: string, isTrackableItem = false) =>
      ({
        id,
        projectId: "p1",
        title: id,
        category: "Geral",
        content: "",
        tags: [],
        linkedIds: [],
        isTrackableItem,
      }) as never;
    expect(partitionLoreEntries([entry("lore"), entry("item", true)])).toEqual({
      lore: [entry("lore")],
      items: [entry("item", true)],
    });
  });

  it("calcula profundidade e candidatos a ficha-mãe", () => {
    const location = (id: string, parentId: string | null = null) =>
      ({
        id,
        projectId: "p1",
        name: id,
        type: "Cidade",
        parentId,
        order: 0,
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }) as unknown as Location;
    expect(MAX_LOCATION_DEPTH).toBe(3);
    const root = location("root");
    const child = location("child", "root");
    const grandchild = location("grandchild", "child");
    const deep = location("deep", "grandchild");
    const locations = [root, child, grandchild, deep];
    const byId = new Map(locations.map((item) => [item.id, item]));

    expect(locationDepth(root, byId)).toBe(1);
    expect(locationDepth(child, byId)).toBe(2);
    expect(locationDepth(grandchild, byId)).toBe(3);
    expect(locationDepth(location("b", "missing"), new Map())).toBe(1);
    const cycleA = location("a", "b");
    const cycleB = location("b", "a");
    expect(
      locationDepth(cycleA, new Map([
        ["a", cycleA],
        ["b", cycleB],
      ])),
    ).toBe(2);

    expect(locationParentCandidates(null, locations).map((item) => item.id)).toEqual([
      "root",
      "child",
    ]);
    const forChild = locationParentCandidates(child, locations).map((item) => item.id);
    expect(forChild).toContain("root");
    expect(forChild).not.toContain("child");
    expect(forChild).not.toContain("deep");
    const forDeep = locationParentCandidates(deep, locations).map((item) => item.id);
    expect(forDeep).toContain("grandchild");
    expect(forDeep).not.toContain("deep");
  });

});

// ---------------------------------------------------------------------------
// Infra — banco, migrações, quota, ids, teclado
// ---------------------------------------------------------------------------

describe("infra", () => {
  it("ensureDbReady é idempotente e mantém o liveQuery vivo", async () => {
    const { ensureDbReady } = await import("@/infra/db/ready");
    const { DexieProjectRepository } = await import(
      "@/features/projects/infra/dexie-project-repository"
    );
    const repository = new DexieProjectRepository();

    await ensureDbReady();
    await expect(ensureDbReady()).resolves.toBeUndefined();

    const emissions: string[][] = [];
    const subscription = liveQuery(() => repository.listActive()).subscribe({
      next: (projects) => emissions.push(projects.map((project) => project.title)),
    });
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    await wait(50);
    const project = await repository.create({ title: "A", status: "draft" });
    await wait(200);
    await repository.softDelete(project.id);
    await wait(200);
    subscription.unsubscribe();

    expect(emissions).toEqual([[], ["A"], []]);
  });

  it("migração 1 cria seções sem duplicar em reexecução", async () => {
    const { migrations } = await import("@/infra/db/migrations");
    const db = getDatabase();
    const now = new Date().toISOString();
    await db.projects.add({
      id: "project-1",
      title: "Projeto legado",
      status: "draft",
      createdAt: now,
      updatedAt: now,
    } as never);
    for (const [index, title] of ["Beat 1", "Beat 2"].entries()) {
      await db.plotBeats.add({
        id: `beat-${index + 1}`,
        projectId: "project-1",
        title,
        order: index + 1,
        structure: "three_acts",
      } as never);
    }

    const migration = migrations[0]!;
    await migration.upgrade(db);
    expect(await db.structureSections.count()).toBe(3);

    const row = await db.plotBeats.get("beat-2");
    const legacy = { ...row, structure: "three_acts" } as Record<string, unknown>;
    delete legacy.sectionId;
    await db.plotBeats.put(legacy as never);

    await migration.upgrade(db);
    expect(await db.structureSections.count()).toBe(3);
    const beat = await db.plotBeats.get("beat-2");
    expect(typeof beat?.sectionId).toBe("string");
    expect(beat && "structure" in beat).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// Exportação binária — DOCX, PDF, backup e pacote de projeto
// ---------------------------------------------------------------------------

describe("export infra", () => {
  const projectRepository = new DexieProjectRepository();

  it("exporta DOCX com níveis de título e reimporta o texto", async () => {
    const blob = await buildDocxBlob({ title: "Romance" } as never, [
      {
        title: "Capítulo 1",
        content: doc(
          heading(2, "Cena"),
          heading(3, "Cena menor"),
          paragraph("Era uma vez, num lugar distante."),
        ),
      },
    ]);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const xml = new TextDecoder().decode(files["word/document.xml"]);
    expect(xml).toContain("Heading2");
    expect(xml).toContain("Heading3");
    expect(xml).not.toContain("Heading1");

    const project = await projectRepository.create({ title: "R", status: "draft" });
    const result = await importDocxFile(
      project.id,
      "romance.docx",
      new Uint8Array(await blob.arrayBuffer()),
    );
    expect(result.count).toBe(1);
    const saved = await getDatabase()
      .chapters.where("projectId")
      .equals(project.id)
      .toArray();
    expect(JSON.stringify(saved[0]?.content)).toContain(
      "Era uma vez, num lugar distante.",
    );

    await expect(
      importDocxFile(
        project.id,
        "x.docx",
        zipSync({ "word/other.xml": new TextEncoder().encode("<w:x/>") }),
      ),
    ).rejects.toThrow("word/document.xml");
  });

  it("valida o envelope de backup e restaura as tabelas", async () => {
    const empty = Object.fromEntries(TABLE_NAMES.map((name) => [name, []]));
    expect(() => parseBackup(null)).toThrow("Arquivo de backup inválido.");
    expect(() => parseBackup({ tables: empty })).toThrow("Arquivo de backup inválido.");
    expect(() =>
      parseBackup({ app: "autor", formatVersion: 2, tables: empty }),
    ).toThrow("Arquivo de backup inválido.");
    expect(() =>
      parseBackup({ app: "autor", formatVersion: 1, tables: { ...empty, projects: [{}] } }),
    ).toThrow("Arquivo de backup inválido.");
    expect(
      parseBackup({
        app: "autor",
        formatVersion: 1,
        tables: { ...empty, projects: [{ id: "p1", title: "P" }] },
      }).tables.projects,
    ).toHaveLength(1);

    const project = await projectRepository.create({ title: "Backup", status: "active" });
    const { blob, filename } = await buildBackupBlob();
    expect(filename).toMatch(/^autor-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const json = await blob.text();
    expect(JSON.parse(json)).toMatchObject({ app: "autor", formatVersion: 1 });

    await projectRepository.softDelete(project.id);
    expect(await projectRepository.listActive()).toHaveLength(0);
    const counts = await importBackupJson(json);
    expect(counts.projects).toBe(1);
    const restored = await projectRepository.listActive();
    expect(restored[0]?.title).toBe("Backup");
    await expect(importBackupJson("{not json")).rejects.toThrow(
      "Arquivo de backup inválido.",
    );
  });

});

// ---------------------------------------------------------------------------
// Store de UI — sidebar, paleta, seções da home e sprint
// ---------------------------------------------------------------------------

describe("ui-store", () => {
  beforeEach(() => {
    localStorage.clear();
    useUiStore.setState({
      sidebarCollapsed: false,
      commandPaletteOpen: false,
      focusMode: false,
      sprintMinutes: 25,
      sprintRemaining: 25 * 60,
      sprintRunning: false,
      sprintCompleted: 0,
      sprintFocusEngaged: false,
    });
  });

  it("guarda preferências com clamp e padrões do app", () => {
    expect(useUiStore.getState().homeSections).not.toContain("continue");
    expect(useUiStore.getState().promptCustomWeight).toBe(0.5);
    expect(useUiStore.getState().panelTabVisible).toBe(false);
    expect(useUiStore.getState().unblockCloseOnSave).toBe(true);

    useUiStore.getState().setPromptCustomWeight(2);
    expect(useUiStore.getState().promptCustomWeight).toBe(1);
    useUiStore.getState().setPromptCustomWeight(-1);
    expect(useUiStore.getState().promptCustomWeight).toBe(0);
    expect(localStorage.getItem("autor-ui")).toContain("promptCustomWeight");

    useUiStore.getState().setHomeSections(["search", "continue", "projects"]);
    expect(localStorage.getItem("autor-ui")).toContain('"continue"');
    useUiStore.getState().setMentionHighlightReadEnabled(false);
    expect(useUiStore.getState().mentionHighlightReadEnabled).toBe(false);
  });

  it("liga o foco no sprint e restaura ao pausar, respeitando o modo manual", () => {
    useUiStore.getState().toggleSprintRunning();
    expect(useUiStore.getState().sprintRunning).toBe(true);
    expect(useUiStore.getState().focusMode).toBe(true);
    useUiStore.getState().toggleSprintRunning();
    expect(useUiStore.getState().focusMode).toBe(false);

    useUiStore.setState({ focusMode: true, sprintFocusEngaged: false });
    useUiStore.getState().toggleSprintRunning();
    useUiStore.getState().toggleSprintRunning();
    expect(useUiStore.getState().focusMode).toBe(true);
  });

});
