import "fake-indexeddb/auto";

import { Editor } from "@tiptap/core";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import { liveQuery } from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase } from "@/infra/db";
import type { Json, Location, Note } from "@/shared/types/database";

import { createAutosave } from "@/features/editor/application/autosave";
import { setDocumentAlignment } from "@/features/editor/domain/alignment";
import { GrifarMark } from "@/features/editor/domain/grifar-mark";
import { fitDimensions } from "@/features/editor/domain/image-file";
import { findTextRanges, previewForRange } from "@/features/editor/domain/replace";
import { detectTextIssues } from "@/features/editor/domain/review";
import { diffDocAgainstSnapshot, docToBlocks } from "@/features/editor/domain/version-diff";
import { countDocWords, countWords } from "@/features/editor/domain/word-count";
import {
  AUTO_VERSION_KEEP,
  versionRepository,
} from "@/features/editor/infra/dexie-version-repository";
import { headingLevel } from "@/features/export/domain/heading-level";
import {
  docToMarkdown,
  markdownToDoc,
  projectToMarkdown,
  splitMarkdownChapters,
} from "@/features/export/domain/markdown";
import {
  chapterToMd,
  chapterToTxt,
  notesToMd,
  notesToTxt,
  plainTextToDoc,
} from "@/features/export/domain/plain-text";
import { unzipSync, zipSync } from "fflate";

import { collapseWhitespace, extractDocText } from "@/shared/lib/text";
import { useUiStore } from "@/shared/store/ui-store";
import { TABLE_NAMES } from "@/infra/db/migrations";
import { buildDocxBlob } from "@/features/export/infra/docx-export";
import {
  docxXmlToTiptap,
  importDocxFile,
  splitDocxChapters,
} from "@/features/export/infra/docx-import";
import { buildPdf } from "@/features/export/infra/pdf-export";
import {
  buildBackupBlob,
  importBackupJson,
  parseBackup,
} from "@/features/export/infra/backup";
import {
  buildProjectPackageBlob,
  importProjectPackageJson,
} from "@/features/export/infra/project-package";

import { DexieCharacterRepository } from "@/features/characters/infra/dexie-character-repository";
import {
  FEMALE_NAMES,
  MALE_NAMES,
  buildRandomCharacter,
} from "@/features/characters/domain/random-character";
import { buildCharacterSections } from "@/features/characters/ui/character-sections";
import { FOLDER_EXIT_ID, resolveHintMode } from "@/features/folders/application/folder-drag";
import { resolveDrop, type RectLike } from "@/features/folders/domain/drop-target";
import {
  collectSubtreeIds,
  directCounts,
  effectiveParentId,
  itemsInFolder,
  rootItems,
} from "@/features/folders/domain/folder-tree";
import { DexieNoteRepository } from "@/features/notes/infra/dexie-note-repository";
import { NOTES_SORT_LABELS, sortNotes } from "@/features/notes/domain/sort";
import {
  parseNotesFile,
  parseNotesMarkdown,
  parseNotesText,
} from "@/features/notes/infra/notes-import";
import {
  applyCustomStructure,
  applyStructureTemplate,
  moveSceneToChapterEnd,
} from "@/features/plot/application/plot-service";
import {
  deriveContinuityState,
  findContinuityIssues,
  isValidStoryDate,
} from "@/features/plot/domain/continuity";
import {
  computeChapterOrder,
  computeSceneMove,
  moveItem,
  renumber,
} from "@/features/plot/domain/ordering";
import { EMPTY_SCENE_DOC } from "@/features/plot/domain/repository";
import { docToSceneBody, sceneBodyToDoc } from "@/features/plot/domain/scene-body";
import { DexieNarrativeArcRepository } from "@/features/plot/infra/dexie-narrative-arc-repository";
import { DexiePlotBeatRepository } from "@/features/plot/infra/dexie-plot-beat-repository";
import { DexieSceneRepository } from "@/features/plot/infra/dexie-scene-repository";
import { DexieTimelineEventRepository } from "@/features/plot/infra/dexie-timeline-event-repository";
import {
  autoPurgeExpiredTrash,
  emptyTrash,
  purgeTrashItem,
} from "@/features/projects/application/trash-service";
import {
  CHAPTER_STATUS_COLORS,
  CHAPTER_STATUS_DOT,
  CHAPTER_STATUS_LABELS,
} from "@/features/projects/domain/repository";
import { projectFormSchema } from "@/features/projects/domain/schemas";
import { sortProjectEntries } from "@/features/projects/domain/sorting";
import { DexieChapterRepository } from "@/features/projects/infra/dexie-chapter-repository";
import { DexieProjectRepository } from "@/features/projects/infra/dexie-project-repository";
import { attachmentRepository } from "@/features/attachments/infra/dexie-attachment-repository";
import { buildBoardExport, parseBoardExport } from "@/features/creativity/domain/board-io";
import {
  HOLD_MS,
  cardAtPoint,
  createGestureTracker,
  dragIdsFor,
} from "@/features/creativity/domain/canvas-gesture";
import {
  alignLeft,
  alignTop,
  distributeHorizontally,
  distributeVertically,
  type LayoutCard,
} from "@/features/creativity/domain/canvas-layout";
import { titleFromPlain } from "@/features/creativity/domain/card-title";
import { buildPromptExport, parsePromptExport } from "@/features/creativity/domain/prompt-io";
import {
  PROMPT_BANKS,
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  WHAT_IF_OBSTACLES,
  WHAT_IF_SETTINGS,
  WHAT_IF_SUBJECTS,
  drawFrom,
  drawPrompt,
  drawWhatIf,
} from "@/features/creativity/domain/prompt-banks";
import {
  composeSceneSummary,
  sendSceneToOutline,
} from "@/features/creativity/application/send-to-outline";
import { DexieCustomPromptRepository } from "@/features/creativity/infra/dexie-custom-prompt-repository";
import { DexieIdeaCardRepository } from "@/features/creativity/infra/dexie-idea-card-repository";
import {
  buildMentionIndex,
  findMentions,
  type MentionEntity,
} from "@/features/mentions/domain/entity-index";
import {
  isTouchDevice,
  shouldOpenMentionOnPlainClick,
} from "@/features/mentions/domain/mention-click";
import { renameMentionsInContent } from "@/features/mentions/domain/rename-mentions";
import { renameMentionsInProject } from "@/features/mentions/application/rename-mentions-service";
import {
  activityLevel,
  buildActivityDays,
  chunkWeeks,
  startOfWeekMonday,
  type ActivityDay,
} from "@/features/productivity/domain/activity-chart";
import {
  decideGoalNotification,
  decideStaleNotifications,
  latestCreatedAt,
} from "@/features/productivity/domain/notifications";
import {
  EMPTY_WRITING_LOG,
  addSprint,
  addWords,
  estimateReadingMinutes,
  summariseWriting,
  toDayKey,
  type WritingLog,
} from "@/features/productivity/domain/writing-log";
import {
  WRITING_LOG_KEY,
  getWritingLog,
  recordSprint,
  recordWords,
} from "@/features/productivity/infra/writing-log-repository";
import { buildSearchDocs } from "@/features/search/domain/search-doc";
import { createSearchIndex, searchDocs } from "@/features/search/application/search-service";
import { DexieTagRepository } from "@/features/tags/infra/dexie-tag-repository";
import { partitionLoreEntries } from "@/features/world/domain/lore-entry-collections";
import {
  DEFAULT_LORE_CATEGORY,
  MAX_LOCATION_DEPTH,
  locationDepth,
  locationParentCandidates,
} from "@/features/world/domain/repository";
import { DexieLocationRepository } from "@/features/world/infra/dexie-location-repository";
import { DexieLoreEntryRepository } from "@/features/world/infra/dexie-lore-entry-repository";

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
// Editor — autosave, alinhamento, grifar, imagens, substituição, revisão
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

    it("flush salva na hora, propaga erro e cancel descarta", async () => {
      const save = vi.fn(async () => undefined);
      const autosave = createAutosave(save, 800);
      autosave.schedule("pendente");
      await autosave.flush();
      expect(save).toHaveBeenCalledExactlyOnceWith("pendente");

      autosave.schedule("descartado");
      autosave.cancel();
      await vi.advanceTimersByTimeAsync(1000);
      expect(save).toHaveBeenCalledTimes(1);

      const failing = createAutosave(async () => {
        throw new Error("quota");
      }, 100);
      failing.schedule("x");
      await expect(failing.flush()).rejects.toThrow("quota");
    });

    it("continua salvando após uma falha", async () => {
      const save = vi.fn(async (payload: string) => {
        if (payload === "first") throw new Error("quota");
      });
      const autosave = createAutosave(save, 100);

      autosave.schedule("first");
      await vi.advanceTimersByTimeAsync(100);
      autosave.schedule("second");
      await vi.advanceTimersByTimeAsync(100);

      expect(save).toHaveBeenCalledTimes(2);
      expect(save).toHaveBeenLastCalledWith("second");
    });
  });

  describe("setDocumentAlignment", () => {
    const schema = new Schema({
      nodes: {
        doc: { content: "block+" },
        paragraph: {
          group: "block",
          content: "inline*",
          attrs: { textAlign: { default: null } },
        },
        heading: {
          group: "block",
          content: "inline*",
          attrs: { level: { default: 1 }, textAlign: { default: null } },
        },
        text: { group: "inline" },
      },
    });

    function makeState(content: Json[]) {
      return EditorState.create({
        schema,
        doc: schema.nodeFromJSON({ type: "doc", content }),
      });
    }

    function alignments(node: { toJSON: () => unknown }) {
      const json = node.toJSON() as {
        content?: { attrs?: { textAlign?: string | null } }[];
      };
      return (json.content ?? []).map((item) => item.attrs?.textAlign ?? null);
    }

    it("aplica textAlign em todos os blocos preservando level e seleção", () => {
      const state = makeState([heading(1, "Capítulo"), paragraph("Primeiro.")]);
      const next = setDocumentAlignment(state, "center");
      expect(alignments(next.doc)).toEqual(["center", "center"]);

      const selected = state.apply(
        state.tr.setSelection(TextSelection.create(state.doc, 3)),
      );
      const aligned = setDocumentAlignment(selected, "justify");
      expect(aligned.selection.from).toBe(3);
      const json = aligned.doc.toJSON() as {
        content: { attrs: { level: number; textAlign: string } }[];
      };
      expect(json.content[0]?.attrs).toMatchObject({
        level: 1,
        textAlign: "justify",
      });
      expect(aligned.doc.textContent).toBe("CapítuloPrimeiro.");
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

    it("faz parse de span.grifar existente", () => {
      const editor = makeEditor('<p><span class="grifar">destaque</span></p>');
      expect(marksOf(editor).some((mark) => mark.type === "grifar")).toBe(true);
      editor.destroy();
    });
  });

  describe("fitDimensions", () => {
    it("reduz proporcionalmente sem ampliar nem quebrar dimensões inválidas", () => {
      expect(fitDimensions(2560, 1440)).toEqual({ width: 1280, height: 720 });
      expect(fitDimensions(1440, 2880)).toEqual({ width: 640, height: 1280 });
      expect(fitDimensions(800, 600)).toEqual({ width: 800, height: 600 });
      expect(fitDimensions(2, 1, 1)).toEqual({ width: 1, height: 1 });
      expect(fitDimensions(0, 100)).toEqual({ width: 0, height: 100 });
    });
  });

  describe("findTextRanges / previewForRange", () => {
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

    it("gera contexto para prévia, sinalizando recortes", () => {
      const short = previewForRange(buildDoc("Oi Davi saiu."), { from: 4, to: 8 });
      expect(short).toMatchObject({
        match: "Davi",
        before: "Oi ",
        after: " saiu.",
        truncatedStart: false,
        truncatedEnd: false,
      });

      const long = previewForRange(
        buildDoc(`${"x".repeat(60)} Davi ${"y".repeat(60)}`),
        { from: 62, to: 66 },
        10,
      );
      expect(long.before).toHaveLength(10);
      expect(long.after).toHaveLength(10);
      expect(long.truncatedStart).toBe(true);
      expect(long.truncatedEnd).toBe(true);
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

    it("ignora caixa na repetição e ordena por posição", () => {
      expect(
        detectTextIssues("O o gato saiu").find((i) => i.type === "repeated-word")
          ?.suggestion,
      ).toBe("O");
      const positions = detectTextIssues("ola o o mundo , assim").map((i) => i.from);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });
  });

  describe("version-diff", () => {
    it("achata blocos com listas aninhadas e tolera docs inválidos", () => {
      const blocks = docToBlocks(
        doc(heading(2, "Capítulo"), paragraph("Era uma vez."), paragraph("")),
      );
      expect(blocks).toEqual([
        { kind: "heading", level: 2, text: "Capítulo" },
        { kind: "paragraph", text: "Era uma vez." },
        { kind: "paragraph", text: "" },
      ]);

      const nested = docToBlocks(
        doc({
          type: "bulletList",
          content: [
            { type: "listItem", content: [paragraph("Um")] },
            {
              type: "listItem",
              content: [
                paragraph("Dois"),
                {
                  type: "bulletList",
                  content: [{ type: "listItem", content: [paragraph("Sub")] }],
                },
              ],
            },
          ],
        }),
      );
      expect(nested.map((block) => block.text)).toEqual([
        "- Um",
        "- Dois",
        "  - Sub",
      ]);
      expect(docToBlocks(null)).toEqual([]);
      expect(docToBlocks({ type: "doc" })).toEqual([]);
    });

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

  describe("word-count", () => {
    it("conta palavras de texto e de documentos", () => {
      expect(countWords("  era   uma vez  ")).toBe(3);
      expect(countWords("   \n ")).toBe(0);
      expect(
        countDocWords(
          doc(
            { type: "paragraph", content: [{ type: "text", text: "era uma vez" }] },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "um " },
                { type: "text", marks: [{ type: "bold" }], text: "herói" },
              ],
            },
          ),
        ),
      ).toBe(5);
      expect(countDocWords({ type: "doc", content: [] })).toBe(0);
    });
  });

  describe("DexieVersionRepository", () => {
    it("poda snapshots automáticos mantendo os manuais", async () => {
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

      await versionRepository.deleteByEntity("chapter-1");
      expect(await versionRepository.listByEntity("chapter-1")).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Export — markdown, texto puro, níveis de título e contexto para IA
// ---------------------------------------------------------------------------

describe("export", () => {
  describe("docToMarkdown", () => {
    it("serializa títulos, marcas, listas, citações e código", () => {
      expect(
        docToMarkdown(
          doc(
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
          ),
        ),
      ).toBe("# Título\n\nUm **forte** e *ênfase*.");

      expect(
        docToMarkdown(
          doc(
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [paragraph("um")] },
                { type: "listItem", content: [paragraph("dois")] },
              ],
            },
            {
              type: "orderedList",
              content: [{ type: "listItem", content: [paragraph("primeiro")] }],
            },
          ),
        ),
      ).toBe("- um\n- dois\n\n1. primeiro");

      expect(
        docToMarkdown(
          doc({
            type: "paragraph",
            content: [
              { type: "text", text: "Ênfase", marks: [{ type: "bold" }, { type: "italic" }] },
            ],
          }),
        ),
      ).toBe("***Ênfase***");

      expect(
        docToMarkdown(
          doc(
            { type: "blockquote", content: [paragraph("citação")] },
            { type: "codeBlock", content: [{ type: "text", text: "const x = 1;" }] },
          ),
        ),
      ).toBe("> citação\n\n```\nconst x = 1;\n```");
    });
  });

  describe("markdownToDoc", () => {
    it("interpreta títulos, listas e ***negrito itálico***", () => {
      const parsed = markdownToDoc("# Título\n\nUm **forte** e *ênfase*.\n\n- um\n- dois");
      expect(collapseWhitespace(extractDocText(parsed))).toBe(
        "Título Um forte e ênfase . um dois",
      );
      const blocks = (parsed as Record<string, Json>).content as Json[];
      expect(blocks[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
      expect(blocks[2]).toMatchObject({ type: "bulletList" });

      const marked = markdownToDoc("Um ***trecho marcado*** no meio.");
      const runs = ((marked as Record<string, Json>).content as Json[])[0] as Record<
        string,
        Json
      >;
      const run = (runs.content as Array<Record<string, Json>>).find(
        (item) => Array.isArray(item.marks) && item.marks.length > 0,
      );
      expect(run?.text).toBe("trecho marcado");
      expect(run?.marks).toEqual([{ type: "bold" }, { type: "italic" }]);
    });

    it("faz round-trip doc → markdown → doc preservando o texto", () => {
      const original = doc(
        heading(2, "Cena da caverna"),
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Ana " },
            { type: "text", text: "acenou", marks: [{ type: "italic" }] },
            { type: "text", text: " e partiu." },
          ],
        },
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [paragraph("espada")] },
            { type: "listItem", content: [paragraph("escudo")] },
          ],
        },
      );
      expect(extractDocText(markdownToDoc(docToMarkdown(original)))).toBe(
        extractDocText(original),
      );
    });
  });

  describe("projectToMarkdown / splitMarkdownChapters", () => {
    const project = {
      id: "p1",
      title: "Romance",
      subtitle: "Uma jornada",
      author: "Ana",
      description: "Breve descrição.",
      status: "active" as const,
      settings: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    function chapter(id: string, order: number, title: string) {
      return {
        id,
        projectId: "p1",
        title,
        order,
        status: "draft" as const,
        wordCount: 0,
        content: doc(paragraph(`Conteúdo de ${title}`)),
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      };
    }

    it("emite capa, capítulos em ordem e divide de volta", () => {
      const md = projectToMarkdown({
        project,
        chapters: [chapter("c2", 2, "Dois"), chapter("c1", 1, "Um")],
      });
      expect(md).toContain("# Romance");
      expect(md).toContain("Autor: Ana");
      expect(md.indexOf("# 1. Um")).toBeLessThan(md.indexOf("# 2. Dois"));

      const chunks = splitMarkdownChapters(md);
      expect(chunks.map((chunk) => chunk.title)).toEqual(["Um", "Dois"]);
      expect(extractDocText(markdownToDoc(chunks[1]!.markdown))).toContain(
        "Conteúdo de Dois",
      );

      const single = splitMarkdownChapters("Só texto, sem títulos.");
      expect(single).toHaveLength(1);
      expect(single[0]?.title).toBe("");
    });
  });

  describe("plain-text", () => {
    const note = (title: string, content: string) => ({
      id: `note-${title}`,
      projectId: "p1",
      title,
      content,
      pinned: false,
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    it("renderiza capítulo em txt e markdown", () => {
      const chapter = {
        title: "Capítulo 1",
        content: doc(paragraph("Era uma vez."), paragraph("Fim.")),
      };
      expect(chapterToTxt(chapter)).toBe("Capítulo 1\n\nEra uma vez.\n\nFim.\n");
      expect(
        chapterToMd({
          title: "Capítulo 1",
          content: doc(paragraph("negrito"), {
            type: "paragraph",
            content: [{ type: "text", text: "Importante", marks: [{ type: "bold" }] }],
          }),
        }),
      ).toBe("# Capítulo 1\n\nnegrito\n\n**Importante**\n");
      expect(chapterToTxt({ title: "", content: doc(paragraph("Só texto.")) })).toBe(
        "Só texto.\n",
      );
    });

    it("junta notas e converte texto puro em doc", () => {
      const notes = [note("Ideia", "Um encontro à meia-noite."), note("Revisar", "")];
      expect(notesToTxt(notes)).toBe(
        "Ideia\n\nUm encontro à meia-noite.\n\nRevisar\n",
      );
      expect(notesToMd(notes)).toBe(
        "## Ideia\n\nUm encontro à meia-noite.\n\n## Revisar\n",
      );
      expect(notesToMd([])).toBe("");

      expect(plainTextToDoc("Primeiro\r\nlinha 2\n\nSegundo")).toEqual(
        doc(
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Primeiro" },
              { type: "hardBreak" },
              { type: "text", text: "linha 2" },
            ],
          },
          paragraph("Segundo"),
        ),
      );
      expect(plainTextToDoc("   \n\n  ")).toEqual({
        type: "doc",
        content: [{ type: "paragraph" }],
      });
    });
  });

  describe("headingLevel", () => {
    it("lê attrs, cai para o nível legado e limita a 1–6", () => {
      expect(headingLevel({ type: "heading", attrs: { level: 3 } })).toBe(3);
      expect(headingLevel({ type: "heading", level: 2 })).toBe(2);
      expect(headingLevel({ type: "heading", attrs: { level: 2 }, level: 1 })).toBe(2);
      expect(headingLevel({ type: "heading" })).toBe(1);
      expect(headingLevel({ type: "heading", attrs: { level: "dois" } })).toBe(1);
      expect(headingLevel({ type: "heading", attrs: { level: 9 } })).toBe(6);
    });
  });

});

// ---------------------------------------------------------------------------
// Plot — ordenação, continuidade, cenas, beats, linha do tempo e arcos
// ---------------------------------------------------------------------------

describe("plot", () => {
  const projectRepository = new DexieProjectRepository();
  const chapterRepository = new DexieChapterRepository();
  const sceneRepository = new DexieSceneRepository();
  const beatRepository = new DexiePlotBeatRepository();
  const eventRepository = new DexieTimelineEventRepository();
  const arcRepository = new DexieNarrativeArcRepository();

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

    it("computeSceneMove reordena e atravessa capítulos", () => {
      const scene = (id: string, chapterId: string, order: number) =>
        ({ id, chapterId, order }) as never;
      const map = new Map([
        ["ch1", [scene("s1", "ch1", 1), scene("s2", "ch1", 2), scene("s3", "ch1", 3)]],
      ]);
      expect(computeSceneMove(map, "s3", "ch1", 0)).toEqual([
        { id: "s3", chapterId: "ch1", order: 1 },
        { id: "s1", chapterId: "ch1", order: 2 },
        { id: "s2", chapterId: "ch1", order: 3 },
      ]);

      const cross = new Map([
        ["ch1", [scene("s1", "ch1", 1), scene("s2", "ch1", 2)]],
        ["ch2", [scene("s3", "ch2", 1)]],
      ]);
      const updates = computeSceneMove(cross, "s2", "ch2", 1);
      expect(
        updates.filter((update) => update.chapterId === "ch2"),
      ).toEqual([
        { id: "s3", chapterId: "ch2", order: 1 },
        { id: "s2", chapterId: "ch2", order: 2 },
      ]);
      expect(computeSceneMove(cross, "ghost", "ch1", 0)).toEqual([]);
    });
  });

  describe("continuity", () => {
    it("valida datas de história", () => {
      for (const date of ["0012", "1889", "1889-05", "1889-05-12"]) {
        expect(isValidStoryDate(date)).toBe(true);
      }
      for (const date of ["1889-13", "1889-02-30", "1889/05"]) {
        expect(isValidStoryDate(date)).toBe(false);
      }
    });

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

    it("deriva estado de personagem e posse de itens", () => {
      const events = [
        {
          id: "arrival",
          projectId: "p1",
          date: "1889-05-12",
          title: "arrival",
          characterIds: ["ana"],
          locationId: "castle",
          stateChanges: [
            {
              kind: "character",
              characterId: "ana",
              motivation: "Encontrar a irmã",
              physicalCondition: "Ferida",
            },
          ],
        },
        {
          id: "transfer",
          projectId: "p1",
          date: "1890-01-01",
          title: "transfer",
          characterIds: [],
          stateChanges: [
            { kind: "item", action: "transfer", itemId: "sword", characterId: "rui" },
          ],
        },
      ] as never;
      const sword = { id: "sword", name: "Espada", initialOwnerId: "ana" } as never;

      const atArrival = deriveContinuityState(events, [sword], "arrival");
      expect(atArrival.characters.get("ana")).toMatchObject({
        locationId: "castle",
        motivation: "Encontrar a irmã",
        physicalCondition: "Ferida",
        inventoryItemIds: ["sword"],
      });
      expect(atArrival.items.get("sword")?.ownerCharacterId).toBe("ana");

      const latest = deriveContinuityState(events, [sword]);
      expect(latest.items.get("sword")?.ownerCharacterId).toBe("rui");
      expect(latest.characters.get("ana")?.inventoryItemIds).toEqual([]);
    });
  });

  describe("scene-body", () => {
    it("converte texto em parágrafos e faz round-trip", () => {
      expect(sceneBodyToDoc("Ana entra.\nEla hesita.")).toEqual({
        type: "doc",
        content: [paragraph("Ana entra."), paragraph("Ela hesita.")],
      });
      expect(docToSceneBody(sceneBodyToDoc("Linha um.\nLinha dois."))).toBe(
        "Linha um.\nLinha dois.",
      );
      expect(sceneBodyToDoc("  \n \n")).toEqual(EMPTY_SCENE_DOC);
      expect(docToSceneBody(null)).toBe("");
      expect(docToSceneBody("texto solto")).toBe("");
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

    it("soft-delete, lixeira e restauração", async () => {
      const project = await seedProject();
      const chapter = await chapterRepository.create({ projectId: project.id });
      const scene = await sceneRepository.create({ chapterId: chapter.id });

      await sceneRepository.softDelete(scene.id);
      expect(await sceneRepository.listByChapter(chapter.id)).toHaveLength(0);
      expect((await sceneRepository.listDeleted()).map((s) => s.id)).toEqual([scene.id]);

      await sceneRepository.restore(scene.id);
      expect(await sceneRepository.listDeleted()).toEqual([]);
      expect(await sceneRepository.listByChapter(chapter.id)).toHaveLength(1);
    });
  });

  describe("moveSceneToChapterEnd", () => {
    it("move a cena para o fim e valida a existência", async () => {
      const project = await seedProject();
      const chapterA = await chapterRepository.create({ projectId: project.id });
      const chapterB = await chapterRepository.create({ projectId: project.id });
      const s1 = await sceneRepository.create({ chapterId: chapterA.id });
      const s2 = await sceneRepository.create({ chapterId: chapterA.id });

      await moveSceneToChapterEnd(s1.id, chapterA.id);
      expect((await sceneRepository.listByChapter(chapterA.id)).map((s) => s.id)).toEqual([
        s2.id,
        s1.id,
      ]);
      await moveSceneToChapterEnd(s2.id, chapterB.id);
      expect((await sceneRepository.listByChapter(chapterB.id)).map((s) => s.id)).toEqual([
        s2.id,
      ]);

      await expect(moveSceneToChapterEnd("ghost", "ch")).rejects.toThrow(
        "Scene not found",
      );
    });
  });

  describe("DexiePlotBeatRepository", () => {
    it("lista por ordem, limpa situação Polti e move entre seções", async () => {
      const project = await seedProject();
      const b1 = await beatRepository.create({
        projectId: project.id,
        scope: "main",
        sectionId: "sec-1",
        title: "Um",
      });
      const b2 = await beatRepository.create({
        projectId: project.id,
        scope: "main",
        sectionId: "sec-1",
        title: "Dois",
      });

      await beatRepository.update(b1.id, { poltiSituation: "polti_1" });
      expect((await beatRepository.listByProject(project.id))[0]?.poltiSituation).toBe(
        "polti_1",
      );
      await beatRepository.update(b1.id, { poltiSituation: null });
      const cleared = (await beatRepository.listByProject(project.id))[0];
      expect(cleared?.poltiSituation).toBeUndefined();
      expect(cleared && "poltiSituation" in cleared).toBe(false);

      await beatRepository.applyMoves([
        { id: b1.id, sectionId: "sec-2", order: 1 },
        { id: b2.id, order: 1 },
      ]);
      const beats = await beatRepository.listByProject(project.id);
      expect(beats.find((beat) => beat.id === b1.id)?.sectionId).toBe("sec-2");
      expect(beats.find((beat) => beat.id === b2.id)?.sectionId).toBe("sec-1");

      await beatRepository.softDelete(b2.id);
      expect(await beatRepository.listByProject(project.id)).toHaveLength(1);
      expect((await beatRepository.listDeleted()).map((beat) => beat.id)).toEqual([b2.id]);
      await beatRepository.restore(b2.id);
      expect(await beatRepository.listDeleted()).toEqual([]);
    });

    it("aplica templates e estrutura personalizada", async () => {
      const project = await seedProject();
      const three = await applyStructureTemplate(project.id, "three_acts", {
        replaceExisting: false,
      });
      expect(three).toMatchObject({ sections: 3, beats: 10, replaced: 0 });

      const sections = await getDatabase()
        .structureSections.filter((section) => section.projectId === project.id)
        .toArray();
      expect(sections).toHaveLength(3);
      expect(sections.sort((a, b) => a.order - b.order)[0]?.title).toBe("Ato I — Setup");
      const beats = await beatRepository.listByProject(project.id);
      expect(beats[0]?.title).toBe("Mundo comum");
      expect(beats.every((beat) => beat.scope === "main" && Boolean(beat.sectionId))).toBe(
        true,
      );

      const custom = await applyCustomStructure(project.id, [
        { title: "Começo" },
        { title: "Fim" },
      ]);
      expect(custom.sections).toBe(2);
      const saved = await projectRepository.getById(project.id);
      expect(saved?.settings.structureTemplateId).toBe("custom");
      await expect(applyCustomStructure(project.id, [])).rejects.toThrow(
        "pelo menos uma seção",
      );
    });
  });

  describe("DexieTimelineEventRepository", () => {
    it("ordena por data e limpa vínculos com null", async () => {
      const project = await seedProject();
      await eventRepository.create({ projectId: project.id, date: "1900", title: "Depois" });
      await eventRepository.create({
        projectId: project.id,
        date: "1889-05",
        title: "Meio",
      });
      await eventRepository.create({
        projectId: project.id,
        date: "1889-05-01",
        title: "Antes",
      });
      expect(
        (await eventRepository.listByProject(project.id)).map((event) => event.title),
      ).toEqual(["Meio", "Antes", "Depois"]);

      const event = await eventRepository.create({
        projectId: project.id,
        date: "1889-05-12",
        time: "10:00",
        title: "Chegada",
        characterIds: ["ana"],
        locationId: "castle",
        linkedChapterId: "chapter-1",
        linkedSceneId: "scene-1",
        arcIds: ["arc-1"],
        stateChanges: [{ kind: "character", characterId: "ana", motivation: "Ir" }],
      });
      const updated = await eventRepository.update(event.id, {
        time: null,
        locationId: null,
        linkedSceneId: null,
        linkedChapterId: null,
        arcIds: [],
        characterIds: [],
        stateChanges: [],
      });
      expect("time" in updated).toBe(false);
      expect("locationId" in updated).toBe(false);
      expect("linkedSceneId" in updated).toBe(false);
      expect("linkedChapterId" in updated).toBe(false);
      expect(updated.arcIds).toEqual([]);
    });
  });

  describe("DexieNarrativeArcRepository", () => {
    it("cria ordenado, limpa opcionais e remove referências no hard delete", async () => {
      const project = await seedProject();
      const first = await arcRepository.create({
        projectId: project.id,
        name: "  Jornada de Ana  ",
        description: "Rascunho",
        color: "#123456",
      });
      const second = await arcRepository.create({
        projectId: project.id,
        name: "Arco de Rui",
      });
      expect(first.name).toBe("Jornada de Ana");
      expect(first.order).toBeLessThan(second.order);
      expect(await arcRepository.listByProject(project.id)).toEqual([first, second]);

      const cleared = await arcRepository.update(first.id, {
        description: null,
        color: null,
      });
      expect(cleared.description).toBeUndefined();
      expect(cleared.color).toBeUndefined();

      const event = await eventRepository.create({
        projectId: project.id,
        date: "1889",
        title: "Início",
        arcIds: [first.id],
      });
      await arcRepository.hardDelete(first.id);
      expect((await getDatabase().timelineEvents.get(event.id))?.arcIds).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// Projetos — schema, ordenação, capítulos, projetos e lixeira
// ---------------------------------------------------------------------------

describe("projects", () => {
  const projectRepository = new DexieProjectRepository();
  const chapterRepository = new DexieChapterRepository();

  describe("projectFormSchema", () => {
    it("valida título e status", () => {
      expect(
        projectFormSchema.safeParse({ title: "Meu romance", status: "draft" }).success,
      ).toBe(true);
      expect(
        projectFormSchema.parse({ title: "  Meu romance  ", status: "active" }).title,
      ).toBe("Meu romance");
      expect(
        projectFormSchema.safeParse({ title: "   ", status: "draft" }).success,
      ).toBe(false);
      expect(
        projectFormSchema.safeParse({ title: "Ok", status: "published" }).success,
      ).toBe(false);
    });
  });

  describe("sortProjectEntries", () => {
    const entry = (
      title: string,
      project: Record<string, unknown> = {},
      stats: Record<string, number> = {},
    ) =>
      ({
        project: {
          id: title,
          title,
          status: "active",
          settings: {},
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-01T00:00:00.000Z",
          ...project,
        },
        chapterCount: 1,
        wordCount: 100,
        readingMinutes: 1,
        ...stats,
      }) as never;

    it("ordena por data, título sem acento, palavras e leitura sem mutar", () => {
      const entries = [
        entry("Antigo", { updatedAt: "2024-01-01T00:00:00.000Z" }),
        entry("Novo", { updatedAt: "2024-06-01T00:00:00.000Z" }),
      ] as never;
      expect(sortProjectEntries(entries, "updated-desc").map((e) => e.project.title)).toEqual(
        ["Novo", "Antigo"],
      );

      const dates = [
        entry("B", { createdAt: "2024-02-01T00:00:00.000Z" }),
        entry("A", { createdAt: "2024-01-01T00:00:00.000Z" }),
      ] as never;
      expect(sortProjectEntries(dates, "created-asc").map((e) => e.project.title)).toEqual([
        "A",
        "B",
      ]);
      expect(
        sortProjectEntries(dates, "created-desc").map((e) => e.project.title),
      ).toEqual(["B", "A"]);

      const titles = [entry("Órbita"), entry("Água"), entry("Bola")] as never;
      expect(sortProjectEntries(titles, "title-asc").map((e) => e.project.title)).toEqual([
        "Água",
        "Bola",
        "Órbita",
      ]);

      const stats = [
        entry("Curto", {}, { wordCount: 50, readingMinutes: 1 }),
        entry("Longo", {}, { wordCount: 500, readingMinutes: 3 }),
      ] as never;
      expect(sortProjectEntries(stats, "words-desc").map((e) => e.project.title)).toEqual([
        "Longo",
        "Curto",
      ]);
      expect(sortProjectEntries(stats, "reading-desc")[0]?.project.title).toBe("Longo");

      const input = [entry("A"), entry("B")] as never;
      const copy = [...input];
      sortProjectEntries(input, "title-asc");
      expect(input).toEqual(copy);
    });
  });

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

  describe("DexieProjectRepository", () => {
    it("cria, lista por updatedAt, faz soft delete/restore e guarda lastEdit", async () => {
      const project = await projectRepository.create({
        title: "Meu romance",
        status: "draft",
      });
      expect(project.settings).toEqual({});
      expect(project.deletedAt).toBeUndefined();
      expect(project.createdAt).toBe(project.updatedAt);

      const second = await projectRepository.create({ title: "B", status: "draft" });
      await new Promise((resolve) => setTimeout(resolve, 5));
      await projectRepository.update(project.id, { title: "A2" });
      expect((await projectRepository.listActive()).map((item) => item.id)).toEqual([
        project.id,
        second.id,
      ]);

      const lastEdit = {
        chapterId: "chapter-1",
        cursorOffset: 42,
        scrollY: 100,
        updatedAt: new Date().toISOString(),
      };
      await projectRepository.updateLastEdit(project.id, lastEdit);
      expect((await projectRepository.getById(project.id))?.lastEdit).toEqual(lastEdit);

      await projectRepository.softDelete(project.id);
      expect(await projectRepository.listActive()).toHaveLength(1);
      expect(await projectRepository.listDeleted()).toHaveLength(1);
      await projectRepository.restore(project.id);
      expect(await projectRepository.listActive()).toHaveLength(2);
      expect((await projectRepository.getById(project.id))?.deletedAt).toBeUndefined();

      await expect(projectRepository.update("nope", { title: "X" })).rejects.toThrow();
    });
  });

  describe("DexieChapterRepository", () => {
    it("ordena ignorando a lixeira e conta palavras do conteúdo", async () => {
      const project = await projectRepository.create({ title: "R", status: "draft" });
      const first = await chapterRepository.create({ projectId: project.id });
      const second = await chapterRepository.create({ projectId: project.id });
      expect(first.order).toBe(1);
      expect(first.title).toBe("Novo capítulo");
      expect(second.order).toBe(2);

      const content = markdownToDoc("# Capítulo\n\nEra uma vez.");
      const imported = await chapterRepository.create({
        projectId: project.id,
        title: "Importado",
        content,
      });
      expect(imported.wordCount).toBe(countDocWords(content));

      await chapterRepository.softDelete(imported.id);
      const next = await chapterRepository.create({ projectId: project.id });
      expect(next.order).toBe(3);

      expect((await chapterRepository.listDeleted()).map((c) => c.id)).toEqual([
        imported.id,
      ]);
      await chapterRepository.restore(imported.id);
      expect(await chapterRepository.listDeleted()).toEqual([]);
      expect(await chapterRepository.listByProject(project.id)).toHaveLength(4);
    });
  });

  describe("trash-service", () => {
    it("purga capítulo com cenas ativas/lixeira e versões", async () => {
      const project = await projectRepository.create({ title: "R", status: "draft" });
      const chapter = await chapterRepository.create({ projectId: project.id });
      const sceneRepository = new DexieSceneRepository();
      const active = await sceneRepository.create({ chapterId: chapter.id });
      const trashed = await sceneRepository.create({ chapterId: chapter.id });
      await sceneRepository.softDelete(trashed.id);
      await versionRepository.create({
        entityType: "chapter",
        entityId: chapter.id,
        snapshot: {},
        auto: false,
      });

      await purgeTrashItem("chapter", chapter.id);

      expect(await chapterRepository.getById(chapter.id)).toBeUndefined();
      expect(await sceneRepository.getById(active.id)).toBeUndefined();
      expect(await sceneRepository.getById(trashed.id)).toBeUndefined();
      expect(await versionRepository.listByEntity(chapter.id)).toHaveLength(0);
      expect(await projectRepository.getById(project.id)).toBeDefined();
    });

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
      const beat = await beatRepository.create({
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

    it("purga nota única mantendo anexos das irmãs", async () => {
      const noteRepository = new DexieNoteRepository();
      const { attachmentRepository } = await import(
        "@/features/attachments/infra/dexie-attachment-repository"
      );
      const project = await projectRepository.create({ title: "R", status: "draft" });
      const kept = await noteRepository.create({ projectId: project.id, title: "Manter" });
      const trashed = await noteRepository.create({ projectId: project.id, title: "Apagar" });
      await noteRepository.softDelete(trashed.id);
      for (const [entityId, dataUrl] of [
        [trashed.id, "data:image/jpeg;base64,aaa"],
        [kept.id, "data:image/jpeg;base64,bbb"],
      ] as const) {
        await attachmentRepository.add({
          projectId: project.id,
          entityType: "note",
          entityId,
          dataUrl,
        });
      }

      await purgeTrashItem("note", trashed.id);

      expect(await noteRepository.getById(trashed.id)).toBeUndefined();
      expect(await attachmentRepository.listByEntity("note", trashed.id)).toHaveLength(0);
      expect(await attachmentRepository.listByEntity("note", kept.id)).toHaveLength(1);
    });

    it("purga arcos e expira automaticamente itens antigos", async () => {
      const arcRepository = new DexieNarrativeArcRepository();
      const project = await projectRepository.create({ title: "R", status: "draft" });
      const active = await arcRepository.create({ projectId: project.id, name: "Ativo" });
      const trashed = await arcRepository.create({ projectId: project.id, name: "Lixo" });
      await arcRepository.softDelete(trashed.id);

      await emptyTrash();
      expect(await arcRepository.getById(active.id)).toBeDefined();
      expect(await arcRepository.getById(trashed.id)).toBeUndefined();

      const expired = await arcRepository.create({ projectId: project.id, name: "Expirado" });
      await arcRepository.softDelete(expired.id);
      await getDatabase().storyArcs.update(expired.id, {
        deletedAt: "2000-01-01T00:00:00.000Z",
      });
      expect(await autoPurgeExpiredTrash(0)).toBeGreaterThanOrEqual(1);
      expect(await arcRepository.getById(expired.id)).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Personagens, notas e pastas
// ---------------------------------------------------------------------------

describe("characters", () => {
  const repository = new DexieCharacterRepository();
  const projectId = "project-1";

  it("cria com defaults, reordena, atualiza e restaura", async () => {
    const character = await repository.create({ projectId, name: "  Ana  " });
    expect(character.name).toBe("Ana");
    expect(character.role).toBe("supporting");
    expect(character.traits).toEqual([]);
    expect((await repository.create({ projectId, name: "   " })).name).toBe("Sem nome");

    const bruno = await repository.create({ projectId, name: "Bruno" });
    await repository.create({ projectId, name: "Carla" });
    expect((await repository.listByProject(projectId)).map((item) => item.name)).toEqual([
      "Ana",
      "Sem nome",
      "Bruno",
      "Carla",
    ]);
    await repository.applyMoves([{ id: bruno.id, order: 10 }]);
    expect((await repository.listByProject(projectId)).map((item) => item.name)).toEqual([
      "Ana",
      "Sem nome",
      "Carla",
      "Bruno",
    ]);

    const updated = await repository.update(character.id, {
      role: "protagonist",
      traits: ["corajosa"],
    });
    expect(updated.role).toBe("protagonist");
    expect(updated.updatedAt >= character.updatedAt).toBe(true);
    await expect(repository.update("ghost", { name: "X" })).rejects.toThrow(
      "Character not found",
    );

    await repository.softDelete(character.id);
    expect((await repository.listByProject(projectId)).map((i) => i.id)).not.toContain(
      character.id,
    );
    expect((await repository.listDeleted()).map((item) => item.id)).toEqual([character.id]);
    await repository.restore(character.id);
    expect(await repository.listDeleted()).toEqual([]);
  });

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

  it("monta as seções da ficha em português", () => {
    const character = {
      id: "char-1",
      projectId: "p1",
      name: "Aurora",
      role: "antagonist",
      description: "Protagonista da história",
      backstory: "Cresceu no porto",
      goals: "Reencontrar o irmão",
      fears: "Água funda",
      traits: ["corajosa", "teimosa"],
      relationships: [
        { targetId: "char-2", type: "family", note: "irmã" },
        { targetId: "sumiu", type: "other" },
      ],
      tags: ["tag-1", "tag-2"],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } as never;
    const sections = buildCharacterSections(character, {
      tags: [{ id: "tag-1", projectId: "p1", name: "Elenco" }],
      characters: [{ id: "char-2", name: "Bento" }] as never,
    });
    expect(sections.map((section) => section.label)).toEqual([
      "Papel",
      "Descrição",
      "História",
      "Objetivos",
      "Medos",
      "Traços",
      "Relações",
      "Tags",
    ]);
    const value = (label: string) =>
      sections.find((section) => section.label === label)?.value;
    expect(value("Papel")).toBe("Antagonista");
    expect(value("Relações")).toBe("Bento — Família (irmã)\nPersonagem — Outro");
    expect(value("Tags")).toBe("Elenco");

    expect(
      buildCharacterSections({
        id: "char-9",
        projectId: "p1",
        name: "Nina",
        role: "protagonist",
        traits: [],
        relationships: [],
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }).map((section) => section.label),
    ).toContain("Papel");
  });
});

describe("notes", () => {
  const repository = new DexieNoteRepository();
  const projectRepository = new DexieProjectRepository();

  it("cria com ordem incremental, fixa e restaura em lote", async () => {
    const project = await projectRepository.create({ title: "R", status: "draft" });
    const other = await projectRepository.create({ title: "O", status: "draft" });
    const first = await repository.create({ projectId: project.id });
    const second = await repository.create({ projectId: project.id, title: "Importante" });
    expect(first.title).toBe("Sem título");
    expect(first.order).toBe(0);
    expect(second.order).toBe(1);

    await repository.togglePinned(second.id, true);
    const list = await repository.listByProject(project.id);
    expect(list.map((note) => note.id)).toEqual([second.id, first.id]);

    await repository.softDelete(second.id);
    expect((await repository.listDeleted()).map((note) => note.id)).toEqual([second.id]);
    const third = await repository.create({ projectId: project.id });
    expect(third.order).toBe(1);

    const untouched = await repository.create({ projectId: other.id, title: "Outro" });
    const ids = await repository.softDeleteByProject(project.id);
    expect(ids.sort()).toEqual([first.id, third.id].sort());
    expect(await repository.listByProject(other.id)).toHaveLength(1);
    await repository.restoreMany(ids);
    expect(await repository.listByProject(project.id)).toHaveLength(2);
    expect((await repository.getById(untouched.id))?.deletedAt).toBeUndefined();
  });

  it("persiste ordens legadas ausentes em listByProject", async () => {
    const project = await projectRepository.create({ title: "R", status: "draft" });
    const now = new Date().toISOString();
    await getDatabase().notes.bulkAdd([
      {
        id: "legacy-1",
        projectId: project.id,
        title: "Antiga A",
        content: "",
        pinned: false,
        tags: [],
        createdAt: now,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "legacy-2",
        projectId: project.id,
        title: "Antiga B",
        content: "",
        pinned: false,
        tags: [],
        createdAt: now,
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ] as never);

    const list = await repository.listByProject(project.id);
    expect(list.map((note) => note.id)).toEqual(["legacy-2", "legacy-1"]);
    expect((await getDatabase().notes.get("legacy-1"))?.order).toBe(1);
  });

  it("ordena por todos os modos com fixadas primeiro", async () => {
    const note = (id: string, patch: Record<string, unknown>) =>
      ({
        id,
        projectId: "p1",
        title: id,
        content: "",
        pinned: false,
        tags: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        ...patch,
      }) as unknown as Note;
    const a = note("a", {
      title: "Abelha",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    });
    const b = note("b", {
      title: "Beso",
      createdAt: "2026-01-02T00:00:00.000Z",
      updatedAt: "2026-01-04T00:00:00.000Z",
    });
    const c = note("c", {
      title: "Casa",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(NOTES_SORT_LABELS.updated).toBe("Última atualizada");
    expect(sortNotes([a, b, c], "updated").map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(sortNotes([a, b, c], "created-asc").map((item) => item.id)).toEqual([
      "c",
      "b",
      "a",
    ]);
    expect(sortNotes([a, b, c], "title-desc").map((item) => item.id)).toEqual([
      "c",
      "b",
      "a",
    ]);

    const manual = [note("x", { order: 2 }), note("y", {}), note("z", { order: 1 })] as never;
    expect(sortNotes(manual, "manual").map((item) => item.id)).toEqual(["y", "z", "x"]);

    const pinnedC = note("c", { title: "Casa", pinned: true });
    for (const mode of [
      "updated",
      "created-desc",
      "created-asc",
      "title-asc",
      "title-desc",
      "manual",
    ] as const) {
      expect(sortNotes([a, b, pinnedC], mode)[0]?.id).toBe("c");
    }

    const input: Note[] = [c, a, b];
    sortNotes(input, "title-asc");
    expect(input.map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("importa markdown, texto e decide pela extensão", () => {
    expect(parseNotesMarkdown("## Ideias\n\nPrimeira nota.\nSegunda linha.\n")).toEqual([
      { title: "Ideias", content: "Primeira nota.\nSegunda linha." },
    ]);
    expect(parseNotesMarkdown("Solto no topo.\n\n## Título\n\nCorpo.")).toEqual([
      { content: "Solto no topo." },
      { title: "Título", content: "Corpo." },
    ]);
    expect(parseNotesMarkdown("\n\n  \n")).toEqual([]);

    expect(parseNotesText("Título A\nCorpo A\n\nTítulo B")).toEqual([
      { title: "Título A", content: "Corpo A" },
      { title: "Título B", content: "" },
    ]);
    expect(parseNotesFile("notas.txt", "A\r\n\r\n\r\nB\r\n")).toEqual([
      { title: "A", content: "" },
      { title: "B", content: "" },
    ]);
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

  it("resolve soltar no centro como criar pasta", () => {
    const over: RectLike = { left: 0, top: 0, width: 100, height: 100 };
    const centered = (x: number, y: number): RectLike => ({
      left: x - 5,
      top: y - 5,
      width: 10,
      height: 10,
    });
    expect(resolveDrop(centered(50, 50), over)).toBe("into");
    expect(resolveDrop(centered(20, 50), over)).toBe("reorder");
    expect(resolveDrop(null, over)).toBe("reorder");
  });

  it("anuncia a ação do arrasto de pastas", () => {
    const centered = { left: 45, top: 45, width: 10, height: 10 };
    const edge = { left: 0, top: 0, width: 10, height: 10 };
    const over = { left: 0, top: 0, width: 100, height: 100 };
    expect(
      resolveHintMode({
        viewFolderIds: ["f1"],
        activeId: "a",
        overId: undefined,
        activeRect: centered,
        overRect: over,
      }),
    ).toBeNull();
    expect(
      resolveHintMode({
        viewFolderIds: ["f1"],
        activeId: "a",
        overId: FOLDER_EXIT_ID,
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("exit");
    expect(
      resolveHintMode({
        viewFolderIds: [],
        activeId: "a",
        overId: "b",
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("create");
    expect(
      resolveHintMode({
        viewFolderIds: ["f0", "f1"],
        activeId: "f0",
        overId: "f1",
        activeRect: centered,
        overRect: over,
      }),
    ).toBe("nested");
    expect(
      resolveHintMode({
        viewFolderIds: [],
        activeId: "a",
        overId: "b",
        activeRect: edge,
        overRect: over,
      }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Criatividade — prompts, canvas, quadros e cards de ideia
// ---------------------------------------------------------------------------

describe("creativity", () => {
  const projectRepository = new DexieProjectRepository();
  const chapterRepository = new DexieChapterRepository();
  const sceneRepository = new DexieSceneRepository();

  async function seedProjectId() {
    const project = await projectRepository.create({ title: "R", status: "draft" });
    return project.id;
  }

  it("mantém bancos e eixos do 'e se' preenchidos e únicos", () => {
    expect(PROMPT_CATEGORIES).toEqual(["enredo", "personagem", "mundo", "conflito"]);
    for (const category of PROMPT_CATEGORIES) {
      expect(PROMPT_BANKS[category].length).toBeGreaterThan(3);
      expect(PROMPT_CATEGORY_LABELS[category].length).toBeGreaterThan(0);
      expect(new Set(PROMPT_BANKS[category]).size).toBe(PROMPT_BANKS[category].length);
    }
    for (const axis of [WHAT_IF_SUBJECTS, WHAT_IF_OBSTACLES, WHAT_IF_SETTINGS]) {
      expect(new Set(axis).size).toBe(axis.length);
      for (const item of axis) expect(item.trim()).not.toBe("");
    }
  });

  it("sorteia por módulo sem repetir o último", () => {
    const items = ["a", "b", "c"];
    expect(drawFrom(items, 0)).toBe("a");
    expect(drawFrom(items, 4)).toBe("b");
    expect(drawFrom(items, -1)).toBe("c");
    expect(drawFrom(items, 0, "a")).toBe("b");
    expect(drawFrom(items, 1, "a")).toBe("b");

    expect(PROMPT_BANKS.enredo).toContain(drawPrompt("enredo", 2));
    expect(drawWhatIf(0)).toBe(
      `E se ${WHAT_IF_SUBJECTS[0]} ${WHAT_IF_OBSTACLES[1]}, ${WHAT_IF_SETTINGS[2]}?`,
    );
    expect(drawWhatIf(0, drawWhatIf(0))).not.toBe(drawWhatIf(0));
  });

  it("usa fichas, concorda gênero e substitui placeholders", () => {
    const character = (patch: Record<string, unknown> = {}) =>
      ({
        id: "char-1",
        projectId: "p-1",
        name: "Aurora",
        role: "protagonist",
        traits: [],
        relationships: [],
        tags: [],
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        ...patch,
      }) as never;
    const location = (name: string) =>
      ({ id: "loc-1", projectId: "p-1", name, type: "povoado", tags: [] }) as never;

    expect(drawWhatIf(3, undefined, [character({ gender: "feminino" })])).toBe(
      "E se Aurora fosse obrigada a voltar ao lugar que jurou nunca mais pisar, na véspera da batalha final?",
    );
    expect(
      drawWhatIf(3, undefined, [character({ name: "Bento", gender: "masculino" })]),
    ).toBe(
      "E se Bento fosse obrigado a voltar ao lugar que jurou nunca mais pisar, na véspera da batalha final?",
    );
    expect(drawWhatIf(3)).toContain("fosse obrigado a voltar");

    expect(
      drawPrompt("personagem", 6, undefined, [character()]),
    ).toContain("Aurora");

    const custom = ["descobrisse um segredo antigo"];
    expect(drawWhatIf(5, undefined, undefined, custom, undefined, 0)).toBe(
      "E se o protagonista descobrisse que a pessoa em quem mais confia mente desde o início, diante de todos os aliados?",
    );
    expect(
      drawPrompt("enredo", 5, undefined, undefined, undefined, custom, 0),
    ).toContain("O que aconteceria se o protagonista falhasse");
    expect(drawWhatIf(5, undefined, undefined, custom, undefined, 1)).toBe(
      "E se o protagonista descobrisse um segredo antigo, diante de todos os aliados?",
    );
    expect(
      drawWhatIf(
        5,
        undefined,
        [character({ name: "Bento", gender: "masculino" })],
        ["E se {personagem} sumisse sem deixar rastro em {local}?"],
        [location("Taverna do Porco")],
        1,
      ),
    ).toBe("E se Bento sumisse sem deixar rastro em Taverna do Porco?");
  });

  it("reconhece tap, hold e arrasto com slop", () => {
    vi.useFakeTimers();
    try {
      const onTap = vi.fn();
      const tracker = createGestureTracker({ onTap });
      tracker.start({ x: 0, y: 0, pointerId: 1 });
      tracker.move({ x: 3, y: 2, pointerId: 1 });
      tracker.end({ x: 3, y: 2, pointerId: 1 });
      expect(onTap).toHaveBeenCalledWith({ x: 3, y: 2 });

      const onHold = vi.fn();
      const onDragStart = vi.fn();
      const onDragEnd = vi.fn();
      const held = createGestureTracker({ onHold, onDragStart, onDragEnd });
      held.start({ x: 0, y: 0, pointerId: 1 });
      vi.advanceTimersByTime(HOLD_MS);
      expect(onHold).toHaveBeenCalledTimes(1);
      held.move({ x: 50, y: 0, pointerId: 1 });
      expect(onDragStart).not.toHaveBeenCalled();
      held.end({ x: 50, y: 0, pointerId: 1 });

      const dragged = createGestureTracker({ onDragStart, onDragEnd });
      dragged.start({ x: 0, y: 0, pointerId: 1 });
      dragged.move({ x: 7, y: 0, pointerId: 1 });
      expect(onDragStart).toHaveBeenCalledTimes(1);
      dragged.end({ x: 7, y: 0, pointerId: 1 });
      expect(onDragEnd).toHaveBeenCalledWith({ x: 7, y: 0 });

      const edge = createGestureTracker({ onTap, onDragStart });
      edge.start({ x: 0, y: 0, pointerId: 1 });
      edge.move({ x: 6, y: 0, pointerId: 1 });
      edge.end({ x: 6, y: 0, pointerId: 1 });
      expect(onDragStart).toHaveBeenCalledTimes(1);
      expect(onTap).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("arrasta grupos/seleção e acha o card no ponto", () => {
    const card = (id: string, groupId?: string) => ({ id, groupId }) as never;
    const cards = [card("a", "g"), card("b", "g"), card("c")];
    expect(dragIdsFor(cards[0]!, cards, new Set(["c"]))).toEqual(["a", "b"]);
    expect(dragIdsFor(cards[2]!, cards, new Set(["a", "b"]))).toEqual(["c"]);

    const rects = {
      a: { x: 16, y: 16, width: 224, height: 120 },
      b: { x: 40, y: 56, width: 224, height: 120 },
    };
    expect(cardAtPoint(rects, { x: 100, y: 50 })).toBe("a");
    expect(cardAtPoint(rects, { x: 240, y: 136 })).toBe("a");
    expect(cardAtPoint(rects, { x: 500, y: 500 })).toBeNull();
  });

  it("alinha e distribui cards no canvas", () => {
    const cards: LayoutCard[] = [
      { id: "a", x: 10, y: 40 },
      { id: "b", x: 30, y: 10 },
      { id: "c", x: 20, y: 100 },
    ];
    expect(alignTop(cards)).toEqual([
      { id: "a", from: { x: 10, y: 40 }, to: { x: 10, y: 10 } },
      { id: "c", from: { x: 20, y: 100 }, to: { x: 20, y: 10 } },
    ]);
    expect(alignLeft(cards).map((move) => move.id)).toEqual(["b", "c"]);
    expect(
      distributeVertically(cards).find((move) => move.id === "a")?.to,
    ).toEqual({ x: 10, y: 55 });
    expect(distributeHorizontally(cards.slice(0, 2))).toEqual([]);
    expect(alignLeft([{ id: "a", x: 5, y: 7 }])).toEqual([]);
  });

  it("deriva título curto do texto", () => {
    expect(titleFromPlain("O labirinto\nresto")).toBe("O labirinto");
    expect(titleFromPlain("   \n \n")).toBe("Sem título");
    expect(titleFromPlain("x".repeat(80))).toBe(`${"x".repeat(60)}…`);
  });

  it("exporta e valida quadros e prompts", () => {
    const items = [
      { key: "card-1", title: "Desbloqueio", content: "E se...", color: "yellow", x: 16, y: 32 },
      { key: "card-2", title: "Vilão", content: "", x: 300, y: 120, links: ["card-1"] },
    ] as never;
    expect(buildBoardExport(items)).toEqual({
      app: "autor",
      type: "idea-canvas",
      formatVersion: 1,
      items,
    });
    expect(parseBoardExport(buildBoardExport(items))).toEqual(items);
    expect(() =>
      parseBoardExport({ app: "outro", type: "idea-canvas", formatVersion: 1 }),
    ).toThrow("Arquivo de quadro inválido");
    expect(() =>
      parseBoardExport({
        app: "autor",
        type: "idea-canvas",
        formatVersion: 1,
        items: [{ key: " ", title: "T", content: "", x: 0, y: 0 }],
      }),
    ).toThrow("Item inválido na posição 1");

    const prompt = {
      id: "p1",
      kind: "question",
      category: "enredo",
      variants: ["O que muda se {local} queimar?"],
      enabled: true,
      order: 0,
    } as never;
    expect(parsePromptExport(buildPromptExport([prompt]))).toEqual([prompt]);
    expect(() => parsePromptExport(null)).toThrow(/inválido/);
    expect(() =>
      parsePromptExport({ app: "autor", type: "prompts", formatVersion: 2, items: [] }),
    ).toThrow(/inválido/);
  });

  it("compõe resumo e envia cena para o roteiro", async () => {
    expect(
      composeSceneSummary({
        goal: " Fugir do castelo ",
        conflict: "Guardas no portão",
        turn: "Túnel secreto",
      }),
    ).toBe("Objetivo: Fugir do castelo\nConflito: Guardas no portão\nVirada: Túnel secreto");
    expect(composeSceneSummary({})).toBeUndefined();

    const project = await projectRepository.create({ title: "R", status: "draft" });
    const chapter = await chapterRepository.create({ projectId: project.id });
    await sceneRepository.create({ chapterId: chapter.id, title: "Existente" });

    const scene = await sendSceneToOutline({
      chapterId: chapter.id,
      title: "Perseguição",
      summary: "Objetivo: Fugir",
      povCharacterId: "char-1",
      locationId: "loc-1",
    });
    expect(scene.order).toBe(2);
    expect(scene.povCharacterId).toBe("char-1");
    expect((await sceneRepository.getById(scene.id))?.locationId).toBe("loc-1");
  });

  describe("DexieIdeaCardRepository", () => {
    const repository = new DexieIdeaCardRepository();

    it("cria com defaults, move com clamp e liga cards dos dois lados", async () => {
      const projectId = await seedProjectId();
      const card = await repository.create({ projectId });
      expect(card.title).toBe("Sem título");
      expect(card.x).toBe(16);
      expect(card.y).toBe(16);

      const named = await repository.create({
        projectId,
        title: "  Perseguição  ",
        refType: "character",
        refId: "char-1",
        w: 320,
        h: 200,
      });
      expect(named.title).toBe("Perseguição");
      expect(named.w).toBe(320);

      await repository.move(card.id, -50, -20);
      const moved = await repository.getById(card.id);
      expect(moved?.x).toBe(0);
      expect(moved?.y).toBe(0);

      await repository.update(card.id, { sentSceneId: "scene-1" });
      expect((await repository.update(card.id, { sentSceneId: null }))?.sentSceneId).toBe(
        undefined,
      );

      const a = await repository.create({ projectId, title: "A" });
      const b = await repository.create({ projectId, title: "B" });
      await repository.link(a.id, b.id);
      expect((await repository.getById(a.id))?.links).toEqual([b.id]);
      expect((await repository.getById(b.id))?.links).toEqual([a.id]);
      await repository.unlink(a.id, b.id);
      expect((await repository.getById(b.id))?.links).toEqual([]);
      const solo = await repository.create({ projectId, title: "Solo" });
      await repository.link(solo.id, solo.id);
      expect((await repository.getById(solo.id))?.links).toBeUndefined();
      await expect(repository.link(a.id, "sumiu")).rejects.toThrow();
    });

    it("lista ativos e purga na lixeira", async () => {
      const projectId = await seedProjectId();
      const a = await repository.create({ projectId, title: "A" });
      const b = await repository.create({ projectId, title: "B" });
      await repository.softDelete(b.id);
      expect((await repository.listByProject(projectId)).map((card) => card.id)).toEqual([
        a.id,
      ]);
      await repository.restore(b.id);
      expect(await repository.listByProject(projectId)).toHaveLength(2);
      await repository.softDelete(b.id);
      await repository.hardDelete(b.id);
      expect(await repository.listDeleted()).toEqual([]);
    });
  });

  describe("DexieCustomPromptRepository", () => {
    const repository = new DexieCustomPromptRepository();

    it("trimma variantes, rejeita vazias e lista em ordem de criação", async () => {
      const prompt = await repository.create({
        kind: "question",
        category: "enredo",
        variants: ["  O que muda?  ", "E se falhar?"],
      });
      expect(prompt.variants).toEqual(["O que muda?", "E se falhar?"]);
      expect(prompt.enabled).toBe(true);
      expect(prompt.order).toBe(0);

      const whatIf = await repository.create({
        kind: "whatIf",
        variants: ["perdesse a voz"],
      });
      expect(whatIf.category).toBeUndefined();
      expect(whatIf.order).toBe(1);

      await expect(
        repository.create({ kind: "question", category: "mundo", variants: [" "] }),
      ).rejects.toThrow(/variante/);
      await expect(repository.update("nope", { variants: ["x"] })).rejects.toThrow(
        /not found/,
      );

      expect((await repository.list()).map((item) => item.id)).toEqual([
        prompt.id,
        whatIf.id,
      ]);
      await repository.hardDelete(prompt.id);
      expect((await repository.list()).map((item) => item.id)).toEqual([whatIf.id]);
    });
  });
});

// ---------------------------------------------------------------------------
// Menções e produtividade
// ---------------------------------------------------------------------------

describe("mentions", () => {
  const projectRepository = new DexieProjectRepository();
  const sceneRepository = new DexieSceneRepository();

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

  it("indexa nomes e encontra menções mais longas", () => {
    const entity = (id: string, name: string, type: "character" | "location" = "character") =>
      ({ id, type, name }) as MentionEntity;
    expect(buildMentionIndex([entity("1", "  Alice  "), entity("2", "A")])).toEqual([
      entity("1", "Alice"),
    ]);

    const index = buildMentionIndex([
      entity("alice", "Alice"),
      entity("porto", "Porto de Ana", "location"),
      entity("ana", "Ana"),
    ]);
    expect(index.map((item) => item.name)).toEqual(["Porto de Ana", "Alice", "Ana"]);
    expect(findMentions("alice viu Ana.", index)).toHaveLength(2);
    expect(findMentions("Analice", index)).toHaveLength(0);
    const overlap = findMentions("Fui ao Porto de Ana ontem.", index);
    expect(overlap).toHaveLength(1);
    expect(overlap[0]?.entity.id).toBe("porto");
    expect(findMentions("Ana e Alice", index).map((match) => match.start)).toEqual([0, 6]);
    expect(findMentions("", index)).toEqual([]);
    expect(findMentions("texto", [])).toEqual([]);
  });

  it("decide abrir a ficha ao clicar/tocar", () => {
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: true,
        hasModifier: false,
        selectionCollapsed: true,
      }),
    ).toBe(true);
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: true,
        hasModifier: false,
        selectionCollapsed: false,
      }),
    ).toBe(false);
    expect(
      shouldOpenMentionOnPlainClick({
        isTouch: false,
        hasModifier: false,
        selectionCollapsed: true,
      }),
    ).toBe(false);
    expect(isTouchDevice()).toBe(false);
  });

  it("renomeia no projeto recalculando palavras e isolando outros projetos", async () => {
    const chapterRepository = new DexieChapterRepository();
    const doc = (text: string): Json => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text }] }],
    });
    const project = await projectRepository.create({ title: "R", status: "draft" });
    const chapter = await chapterRepository.create({
      projectId: project.id,
      content: doc("Davi chegou."),
    });
    const scene = await sceneRepository.create({ chapterId: chapter.id });
    await sceneRepository.update(scene.id, { content: doc("Davi saiu.") });

    expect(await renameMentionsInProject(project.id, "Davi", "Davi Silva")).toBe(2);
    const updated = await chapterRepository.getById(chapter.id);
    expect(updated?.content).toEqual(doc("Davi Silva chegou."));
    expect(updated?.wordCount).toBe(countDocWords(doc("Davi Silva chegou.")));

    expect(await renameMentionsInProject(project.id, "A", "Alberto")).toBe(0);
    expect(await renameMentionsInProject(project.id, "Davi", "Davi")).toBe(0);
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

describe("attachments", () => {
  it("adiciona, lista por entidade e remove em cascata", async () => {
    const first = await attachmentRepository.add({
      projectId: "p1",
      entityType: "note",
      entityId: "n1",
      dataUrl: "data:image/jpeg;base64,1",
      name: "a.jpg",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await attachmentRepository.add({
      projectId: "p1",
      entityType: "note",
      entityId: "n1",
      dataUrl: "data:image/jpeg;base64,2",
    });
    await attachmentRepository.add({
      projectId: "p2",
      entityType: "event",
      entityId: "e1",
      dataUrl: "data:image/jpeg;base64,3",
    });

    const list = await attachmentRepository.listByEntity("note", "n1");
    expect(list.map((item) => item.id)).toEqual([first.id, second.id]);
    expect(list[0]?.name).toBe("a.jpg");

    await attachmentRepository.remove(first.id);
    expect(await attachmentRepository.listByEntity("note", "n1")).toHaveLength(1);
    await attachmentRepository.removeByEntityId("n1");
    expect(await attachmentRepository.listByEntity("note", "n1")).toHaveLength(0);

    await attachmentRepository.removeByProject("p2");
    expect(await attachmentRepository.listByProject("p2")).toHaveLength(0);
  });
});

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

  it("monta docs por entidade ignorando deletados e projetos apagados", () => {
    const docs = buildSearchDocs({
      projects: [project("p1", "Romance")],
      chapters: [
        chapter("c1", "Capítulo 1", "Era uma vez um dragão."),
        Object.assign(chapter("c2", "Rascunho", "segredo") as object, {
          deletedAt: now,
        }) as never,
      ],
      scenes: [],
      characters: [],
      locations: [],
      loreEntries: [],
      notes: [],
    });
    expect(docs).toHaveLength(2);
    expect(docs.find((doc) => doc.type === "chapter")?.href).toBe("/read?chapter=c1");
    expect(docs.find((doc) => doc.type === "project")?.href).toBe("/projects/p1");

    expect(
      buildSearchDocs({
        projects: [project("p1", "Romance", { deletedAt: now })],
        chapters: [chapter("c1", "Capítulo 1", "texto")],
        scenes: [],
        characters: [],
        locations: [],
        loreEntries: [],
        notes: [],
      }),
    ).toHaveLength(0);
  });

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

describe("tags", () => {
  const repository = new DexieTagRepository();
  const projectRepository = new DexieProjectRepository();
  const characterRepository = new DexieCharacterRepository();

  it("cria, reordena alfabeticamente, funde e remove referências", async () => {
    const project = await projectRepository.create({ title: "R", status: "draft" });
    await repository.create({ projectId: project.id, name: "Zelador" });
    const source = await repository.create({ projectId: project.id, name: "fonte" });
    const target = await repository.create({ projectId: project.id, name: "destino" });
    expect((await repository.listByProject(project.id)).map((tag) => tag.name)).toEqual([
      "destino",
      "fonte",
      "Zelador",
    ]);
    expect((await repository.create({ projectId: project.id, name: " " })).name).toBe(
      "Sem nome",
    );

    const character = await characterRepository.create({
      projectId: project.id,
      name: "Ana",
    });
    await getDatabase().characters.update(character.id, {
      tags: [source.id, target.id],
    });
    await repository.merge(source.id, target.id);
    expect((await getDatabase().characters.get(character.id))?.tags).toEqual([target.id]);
    expect(await repository.getById(source.id)).toBeUndefined();

    await repository.remove(target.id);
    expect((await getDatabase().characters.get(character.id))?.tags).toEqual([]);
    expect(await repository.getById(target.id)).toBeUndefined();

    const other = await projectRepository.create({ title: "O", status: "draft" });
    const kept = await repository.create({ projectId: other.id, name: "tema" });
    await repository.deleteByProject(project.id);
    expect(await repository.listByProject(project.id)).toHaveLength(0);
    expect(await repository.getById(kept.id)).toBeDefined();
  });
});

describe("world", () => {
  const projectRepository = new DexieProjectRepository();

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

  it("cria locais com defaults, reordena e restaura", async () => {
    const repository = new DexieLocationRepository();
    const project = await projectRepository.create({ title: "R", status: "draft" });
    const zara = await repository.create({ projectId: project.id, name: "  Zara  " });
    const aurora = await repository.create({ projectId: project.id, name: "Aurora" });
    expect(zara.name).toBe("Zara");
    expect(zara.type).toBe("Local");
    expect(zara.tags).toEqual([]);

    const deleted = await repository.create({ projectId: project.id, name: "Duna" });
    await repository.softDelete(deleted.id);
    expect((await repository.listByProject(project.id)).map((item) => item.name)).toEqual([
      "Zara",
      "Aurora",
    ]);
    await repository.applyMoves([{ id: zara.id, order: 10 }]);
    expect((await repository.listByProject(project.id)).map((item) => item.name)).toEqual([
      "Aurora",
      "Zara",
    ]);

    const updated = await repository.update(aurora.id, { type: "Castelo" });
    expect(updated.type).toBe("Castelo");
    expect((await repository.listDeleted()).map((item) => item.id)).toEqual([deleted.id]);
    await repository.restore(deleted.id);
    expect(await repository.listDeleted()).toEqual([]);
    await expect(repository.update("ghost", { name: "X" })).rejects.toThrow(
      "Location not found",
    );
  });

  it("cria Lore com defaults, reordena e limpa dono inicial", async () => {
    const repository = new DexieLoreEntryRepository();
    const project = await projectRepository.create({ title: "R", status: "draft" });
    const entry = await repository.create({ projectId: project.id, title: "  Coroa  " });
    expect(entry.title).toBe("Coroa");
    expect(entry.category).toBe(DEFAULT_LORE_CATEGORY);
    expect(entry.content).toBe("");
    expect(entry.linkedIds).toEqual([]);

    const zodiaco = await repository.create({
      projectId: project.id,
      title: "Zodíaco",
      category: "Mitologia",
    });
    expect((await repository.listByProject(project.id))[0]?.id).toBe(entry.id);
    await repository.applyMoves([{ id: zodiaco.id, order: -1 }]);
    expect((await repository.listByProject(project.id))[0]?.id).toBe(zodiaco.id);

    const item = await repository.create({
      projectId: project.id,
      title: "Espada",
      isTrackableItem: true,
      initialOwnerId: "ana",
    });
    expect(item.initialOwnerId).toBe("ana");
    const cleared = await repository.update(item.id, {
      isTrackableItem: false,
      initialOwnerId: null,
    });
    expect(cleared.initialOwnerId).toBeUndefined();
    await expect(repository.update("ghost", { title: "X" })).rejects.toThrow(
      "LoreEntry not found",
    );
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

  describe("quota", () => {
    it("reconhece erros de quota e ignora os demais", async () => {
      const { isQuotaExceededError, QUOTA_WARNING_THRESHOLD } = await import(
        "@/infra/storage/quota"
      );
      expect(isQuotaExceededError(new DOMException("quota", "QuotaExceededError"))).toBe(
        true,
      );
      expect(isQuotaExceededError({ name: "NS_ERROR_DOM_QUOTA_REACHED" })).toBe(true);
      expect(isQuotaExceededError({ code: 22 })).toBe(true);
      expect(isQuotaExceededError(new Error("boom"))).toBe(false);
      expect(isQuotaExceededError(null)).toBe(false);
      expect(isQuotaExceededError("quota")).toBe(false);
      expect(QUOTA_WARNING_THRESHOLD).toBeGreaterThan(0);
      expect(QUOTA_WARNING_THRESHOLD).toBeLessThan(1);
    });
  });

  describe("createId", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("gera UUID v4 e funciona sem crypto.randomUUID", async () => {
      const { createId } = await import("@/shared/lib/id");
      const UUID_V4 =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
      expect(createId()).toMatch(UUID_V4);
      expect(createId()).not.toBe(createId());

      vi.stubGlobal("crypto", {
        getRandomValues: (array: Uint8Array) => {
          for (let index = 0; index < array.length; index += 1) {
            array[index] = index * 7 + 1;
          }
          return array;
        },
      });
      expect(createId()).toMatch(UUID_V4);

      vi.stubGlobal("crypto", undefined);
      expect(createId()).toMatch(UUID_V4);
    });
  });

  describe("handleDialogEnter", () => {
    function makeEvent(
      key: string,
      target: HTMLElement,
      modifiers: { shift?: boolean; ctrl?: boolean; alt?: boolean; composing?: boolean } = {},
    ) {
      return {
        key,
        shiftKey: Boolean(modifiers.shift),
        ctrlKey: Boolean(modifiers.ctrl),
        altKey: Boolean(modifiers.alt),
        nativeEvent: { isComposing: Boolean(modifiers.composing) },
        target,
        preventDefault: vi.fn(),
      } as unknown as Parameters<
        typeof import("@/shared/lib/keyboard").handleDialogEnter
      >[0];
    }

    it("salva no Enter simples e ignora textarea, botão, atalhos, IME e Tiptap", async () => {
      const { handleDialogEnter } = await import("@/shared/lib/keyboard");
      const input = document.createElement("input");
      document.body.append(input);

      const onSave = vi.fn();
      const event = makeEvent("Enter", input);
      handleDialogEnter(event, onSave);
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(event.preventDefault).toHaveBeenCalled();

      const ignored = vi.fn();
      const textarea = document.createElement("textarea");
      const button = document.createElement("button");
      document.body.append(textarea, button);
      handleDialogEnter(makeEvent("Enter", textarea), ignored);
      handleDialogEnter(makeEvent("Enter", button), ignored);
      handleDialogEnter(makeEvent("Enter", input, { shift: true }), ignored);
      handleDialogEnter(makeEvent("Enter", input, { composing: true }), ignored);
      handleDialogEnter(makeEvent("Escape", input), ignored);

      const tiptap = document.createElement("div");
      tiptap.className = "tiptap";
      const inner = document.createElement("p");
      tiptap.append(inner);
      document.body.append(tiptap);
      handleDialogEnter(makeEvent("Enter", inner), ignored);

      expect(ignored).not.toHaveBeenCalled();
    });
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

  it("mapeia estilos do DOCX para o documento Tiptap", () => {
    const xml = `<?xml version="1.0"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Capítulo 1</w:t></w:r></w:p>
          <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Sub</w:t></w:r></w:p>
          <w:p><w:pPr><w:ind w:left="480"/></w:pPr><w:r><w:t>Citado.</w:t></w:r></w:p>
          <w:p><w:r><w:rPr><w:rFonts w:ascii="Courier New"/></w:rPr><w:t>code();</w:t></w:r></w:p>
          <w:p><w:r><w:t>Corpo.</w:t></w:r></w:p>
        </w:body>
      </w:document>`;
    const parsed = docxXmlToTiptap(xml) as {
      content: { type: string; attrs?: { level: number } }[];
    };
    expect(parsed.content[0]?.type).toBe("heading");
    expect(parsed.content[1]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(parsed.content[2]?.type).toBe("blockquote");
    expect(parsed.content[3]?.type).toBe("codeBlock");
    expect(parsed.content[4]?.type).toBe("paragraph");

    expect(splitDocxChapters(parsed as never, "Arquivo").map((c) => c.title)).toEqual([
      "Capítulo 1",
    ]);
    expect(
      splitDocxChapters(
        docxXmlToTiptap(
          '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Sem títulos.</w:t></w:r></w:p></w:body></w:document>',
        ),
        "Meu arquivo",
      )[0]?.title,
    ).toBe("Meu arquivo");
  });

  it("gera PDF com citações, listas, estilos e alinhamentos", async () => {
    const pdfBlob = buildPdf({
      title: "Título",
      cover: false,
      chapters: [
        {
          title: "Capítulo",
          content: doc(
            heading(1, "TituloUm"),
            heading(2, "TituloDois"),
            {
              type: "paragraph",
              attrs: { textAlign: "center" },
              content: [{ type: "text", text: "ParagrafoCentro" }],
            },
            {
              type: "paragraph",
              content: [
                { type: "text", text: "Normal " },
                { type: "text", text: "Negrito", marks: [{ type: "bold" }] },
              ],
            },
            { type: "blockquote", content: [paragraph("CitacaoMista")] },
            {
              type: "bulletList",
              content: [
                {
                  type: "listItem",
                  content: [
                    paragraph("ItemA"),
                    {
                      type: "bulletList",
                      content: [{ type: "listItem", content: [paragraph("ItemB")] }],
                    },
                  ],
                },
              ],
            },
            {
              type: "orderedList",
              content: [{ type: "listItem", content: [paragraph("ItemNumerado")] }],
            },
            { type: "horizontalRule" },
          ),
        },
      ],
    });
    const pdf = new TextDecoder("latin1").decode(
      new Uint8Array(await pdfBlob.arrayBuffer()),
    );
    expect(pdf).toMatch(/\b20 Tf\b/);
    expect(pdf).toMatch(/\b16 Tf\b/);
    expect(pdf).toContain("(TituloUm) Tj");
    expect(pdf).toContain("(ParagrafoCentro) Tj");
    expect(pdf).toContain("(Negrito) Tj");
    expect(pdf).toContain("(CitacaoMista) Tj");
    expect(pdf).toContain("(- ItemA) Tj");
    expect(pdf).toContain("(- ItemB) Tj");
    expect(pdf).toContain("(1. ItemNumerado) Tj");
    expect(pdf).toMatch(/[\d.]+ [\d.]+ m\s+[\d.]+ [\d.]+ l/);
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

  it("copia um projeto completo remapeando ids e preservando configurações", async () => {
    const db = getDatabase();
    const timestamp = "2026-10-01T12:00:00.000Z";
    await db.projects.add({
      id: "src-project",
      title: "Pacote",
      status: "active",
      settings: { editor: { fontSize: 16 } },
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    await db.chapters.add({
      id: "src-chapter",
      projectId: "src-project",
      title: "Capítulo 1",
      order: 0,
      status: "draft",
      wordCount: 0,
      content: { type: "doc", content: [] },
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    await db.characters.add({
      id: "src-ana",
      projectId: "src-project",
      name: "Ana",
      role: "protagonist",
      traits: [],
      relationships: [],
      tags: ["src-tag"],
      folderId: "src-folder",
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    await db.tags.add({
      id: "src-tag",
      projectId: "src-project",
      name: "Importante",
      color: "#123456",
    } as never);
    await db.folders.add({
      id: "src-folder",
      projectId: "src-project",
      kind: "character",
      name: "Principais",
      createdAt: timestamp,
      updatedAt: timestamp,
    } as never);
    await db.settings.put({ key: "app-setting", value: "keep" });

    const json = await (await buildProjectPackageBlob("src-project")).text();
    const parsed = JSON.parse(json) as { tables: Record<string, unknown[]> };
    expect(JSON.parse(json)).toMatchObject({
      app: "autor",
      kind: "project",
      formatVersion: 1,
    });
    expect(parsed.tables).not.toHaveProperty("settings");

    const imported = await importProjectPackageJson(json);
    expect(imported.id).not.toBe("src-project");
    expect(imported.settings).toEqual({ editor: { fontSize: 16 } });

    const character = (
      await db.characters.where("projectId").equals(imported.id).toArray()
    )[0]!;
    const tag = (await db.tags.where("projectId").equals(imported.id).toArray())[0]!;
    const folder = (await db.folders.where("projectId").equals(imported.id).toArray())[0]!;
    expect(character).toMatchObject({ tags: [tag.id], folderId: folder.id });
    expect(await db.settings.get("app-setting")).toEqual({
      key: "app-setting",
      value: "keep",
    });
    expect(await db.projects.count()).toBe(2);

    await expect(importProjectPackageJson("{not json")).rejects.toThrow(
      "Arquivo de projeto inválido.",
    );
    expect(await db.projects.count()).toBe(2);
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

  it("alterna sidebar e paleta persistindo só o estado durável", () => {
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);
    useUiStore.getState().openCommandPalette();
    expect(useUiStore.getState().commandPaletteOpen).toBe(true);

    const raw = localStorage.getItem("autor-ui");
    expect(raw).toBeTruthy();
    expect(raw).toContain("sidebarCollapsed");
    expect(raw).not.toContain("commandPaletteOpen");
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

  it("conclui o sprint zerando o cronômetro e contando a sessão", () => {
    useUiStore.getState().toggleSprintRunning();
    useUiStore.getState().completeSprint();
    const state = useUiStore.getState();
    expect(state.sprintRunning).toBe(false);
    expect(state.sprintCompleted).toBe(1);
    expect(state.sprintRemaining).toBe(25 * 60);
    expect(state.focusMode).toBe(false);

    useUiStore.getState().setSprintMinutes(200);
    expect(useUiStore.getState().sprintMinutes).toBe(120);
    useUiStore.getState().resetSprint();
    expect(useUiStore.getState().sprintRemaining).toBe(120 * 60);
  });
});
