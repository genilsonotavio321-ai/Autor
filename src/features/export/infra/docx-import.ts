import { unzipSync } from "fflate";

import type { Json } from "@/shared/types/database";

import { chapterRepository } from "@/features/projects/infra/dexie-chapter-repository";

/**
 * DOCX import — round-trip partner of `docx-export.ts`.
 *
 * A .docx file is a zip; we only read `word/document.xml` (plus
 * `word/numbering.xml` to tell bullet from ordered lists) and convert the
 * paragraphs to a Tiptap document directly — no Markdown intermediate.
 *
 * Detection mirrors what `buildDocxBlob` writes:
 * - chapter titles: bold runs sized ≥ 16pt (32 half-points). Those carry a
 *   `chapterTitle` marker so splitting trusts them over Word heading styles;
 * - Word headings (via `Heading1..6` style) also map to Tiptap headings;
 * - code blocks: runs in Courier New;
 * - blockquotes: paragraphs indented `left="480"`;
 * - lists: `w:numPr` with `ilvl`, resolved against numbering.xml's numFmt.
 */

export interface ImportedDocxChapter {
  title: string;
  content: Json;
}

const HEADING_STYLE_RE = /^heading([1-6])$/i;
/** Bold ≥ 16pt (32 half-points) — our chapter titles are written at sz=32. */
const CHAPTER_TITLE_MIN_HALF_POINTS = 32;

type XmlEl = Element;

function childrenByLocalName(parent: XmlEl, localName: string): XmlEl[] {
  const out: XmlEl[] = [];
  for (let i = 0; i < parent.children.length; i += 1) {
    const child = parent.children[i];
    if (child && child.localName === localName) out.push(child);
  }
  return out;
}

function firstChildByLocalName(parent: XmlEl, localName: string): XmlEl | undefined {
  return childrenByLocalName(parent, localName)[0];
}

function textOf(el: XmlEl): string {
  let out = "";
  const walk = (node: Element) => {
    for (let i = 0; i < node.childNodes.length; i += 1) {
      const child = node.childNodes[i];
      if (!child) continue;
      if (child.nodeType === 3) out += child.nodeValue ?? "";
      else if (child.nodeType === 1) walk(child as Element);
    }
  };
  walk(el);
  return out;
}

function attr(el: XmlEl | undefined, localName: string): string | undefined {
  if (!el) return undefined;
  if (el.hasAttribute(`w:${localName}`)) return el.getAttribute(`w:${localName}`) ?? undefined;
  // Namespace-agnostic fallback.
  for (let i = 0; i < el.attributes.length; i += 1) {
    const a = el.attributes[i];
    if (a && a.localName === localName) return a.value;
  }
  return undefined;
}

interface RunInfo {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  courier: boolean;
  /** Half-points (Word `w:sz`); undefined when unset. */
  sizeHalfPoints?: number;
}

function parseRuns(paragraph: XmlEl): RunInfo[] {
  const runs: RunInfo[] = [];
  for (const run of childrenByLocalName(paragraph, "r")) {
    const rPr = firstChildByLocalName(run, "rPr");
    const text = childrenByLocalName(run, "t")
      .map((t) => textOf(t))
      .join("");
    if (text.length === 0) continue;
    const fonts = rPr ? firstChildByLocalName(rPr, "rFonts") : undefined;
    const sz = rPr ? firstChildByLocalName(rPr, "sz") : undefined;
    const size = sz ? Number(attr(sz, "val")) : Number.NaN;
    runs.push({
      text,
      bold: rPr ? firstChildByLocalName(rPr, "b") !== undefined : false,
      italic: rPr ? firstChildByLocalName(rPr, "i") !== undefined : false,
      strike: rPr ? firstChildByLocalName(rPr, "strike") !== undefined : false,
      courier: fonts !== undefined && attr(fonts, "ascii") === "Courier New",
      sizeHalfPoints: Number.isFinite(size) ? size : undefined,
    });
  }
  return runs;
}

function runsToTiptap(runs: RunInfo[]): Json[] {
  const nodes: Json[] = [];
  for (const run of runs) {
    const marks: { type: string }[] = [];
    if (run.bold) marks.push({ type: "bold" });
    if (run.italic) marks.push({ type: "italic" });
    if (run.strike) marks.push({ type: "strike" });
    const node: Record<string, Json> = { type: "text", text: run.text };
    if (marks.length > 0) node.marks = marks;
    nodes.push(node);
  }
  return nodes;
}

/** numId → (ilvl → "bullet" | "decimal" | other) from numbering.xml. */
function parseNumbering(xmlText: string): Map<string, Map<string, string>> {
  const map = new Map<string, Map<string, string>>();
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  for (const num of Array.from(doc.getElementsByTagName("*")).filter(
    (el) => el.localName === "num",
  )) {
    const numId = attr(num, "numId");
    const abstractRef = firstChildByLocalName(num, "abstractNumId");
    const abstractId = abstractRef ? attr(abstractRef, "val") : undefined;
    if (!numId || !abstractId) continue;
    const levels = new Map<string, string>();
    for (const abstractNum of Array.from(doc.getElementsByTagName("*")).filter(
      (el) => el.localName === "abstractNum" && attr(el, "abstractNumId") === abstractId,
    )) {
      for (const lvl of childrenByLocalName(abstractNum, "lvl")) {
        const ilvl = attr(lvl, "ilvl") ?? "0";
        const numFmt = firstChildByLocalName(lvl, "numFmt");
        const fmt = numFmt ? attr(numFmt, "val") : undefined;
        if (fmt) levels.set(ilvl, fmt);
      }
    }
    map.set(numId, levels);
  }
  return map;
}

/** Convert document.xml to a Tiptap doc. Pure — exported for tests. */
export function docxXmlToTiptap(
  xmlText: string,
  numberingXml?: string,
): Json {
  const numbering = numberingXml ? parseNumbering(numberingXml) : new Map();
  const dom = new DOMParser().parseFromString(xmlText, "application/xml");
  const body =
    Array.from(dom.getElementsByTagName("*")).find((el) => el.localName === "body") ??
    dom.documentElement;

  const blocks: Json[] = [];
  // Stack of open lists. Items get appended to the deepest open list that
  // matches their level; deeper levels nest inside the last listItem.
  const openLists: { level: number; node: Record<string, Json> }[] = [];

  const closeListsBelow = (level: number) => {
    while (openLists.length > 0 && openLists[openLists.length - 1]!.level >= level) {
      openLists.pop();
    }
  };

  for (const paragraph of Array.from(body.children).filter(
    (el) => el.localName === "p",
  )) {
    const runs = parseRuns(paragraph);

    const pPr = firstChildByLocalName(paragraph, "pPr");

    // --- list item? ---
    const numPr = pPr ? firstChildByLocalName(pPr, "numPr") : undefined;
    if (numPr) {
      const ilvlEl = firstChildByLocalName(numPr, "ilvl");
      const numIdEl = firstChildByLocalName(numPr, "numId");
      const level = Math.max(0, Number(attr(ilvlEl, "val") ?? "0") || 0);
      const numId = numIdEl ? attr(numIdEl, "val") : undefined;
      const fmt = numId
        ? numbering.get(numId)?.get(String(level)) ?? "bullet"
        : "bullet";
      const listType: "bullet" | "ordered" = fmt === "decimal" ? "ordered" : "bullet";

      closeListsBelow(level);
      const paragraphNode: Json = {
        type: "paragraph",
        content: runsToTiptap(runs),
      };
      const listItem: Record<string, Json> = {
        type: "listItem",
        content: [paragraphNode],
      };

      const deepest = openLists[openLists.length - 1];
      if (deepest && deepest.level === level) {
        (deepest.node.content as Json[]).push(listItem);
      } else {
        const listNode: Record<string, Json> = {
          type: listType === "ordered" ? "orderedList" : "bulletList",
          content: [listItem],
        };
        if (deepest && deepest.level < level) {
          // Nest inside the last listItem of the parent list.
          const parentContent = deepest.node.content as Json[];
          const lastItem = parentContent[parentContent.length - 1] as
            | { content?: Json[] }
            | undefined;
          if (lastItem) {
            (lastItem.content ??= []).push(listNode);
          } else {
            blocks.push(listNode);
          }
        } else {
          blocks.push(listNode);
        }
        openLists.push({ level, node: listNode });
      }
      continue;
    }

    closeListsBelow(0);

    // --- heading by Word style ---
    const pStyle = pPr ? firstChildByLocalName(pPr, "pStyle") : undefined;
    const styleVal = (attr(pStyle, "val") ?? "").match(HEADING_STYLE_RE);
    if (styleVal) {
      blocks.push({
        type: "heading",
        attrs: { level: Number(styleVal[1]) },
        content: runsToTiptap(runs),
      });
      continue;
    }

    // --- bold big run = chapter title (direct formatting, not a Word style) ---
    if (
      runs.length > 0 &&
      runs.every((r) => r.bold) &&
      Math.max(...runs.map((r) => r.sizeHalfPoints ?? 0)) >=
        CHAPTER_TITLE_MIN_HALF_POINTS
    ) {
      blocks.push({
        type: "heading",
        attrs: { level: 1, chapterTitle: true },
        content: runsToTiptap(runs),
      });
      continue;
    }

    // --- code block (Courier New runs) ---
    if (runs.length > 0 && runs.every((r) => r.courier)) {
      blocks.push({ type: "codeBlock", content: runsToTiptap(runs) });
      continue;
    }

    // --- blockquote (left indent 480) ---
    const ind = pPr ? firstChildByLocalName(pPr, "ind") : undefined;
    const left = Number(attr(ind, "left") ?? attr(ind, "start") ?? "0");
    if (left >= 480) {
      blocks.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: runsToTiptap(runs) }],
      });
      continue;
    }

    blocks.push({
      type: "paragraph",
      content: runsToTiptap(runs),
    });
  }

  return { type: "doc", content: blocks };
}

/**
 * Split a Tiptap doc into chapters using level-1 headings as separators —
 * mirroring `splitMarkdownChapters`: the first heading becomes front-matter
 * (project title) when more chapters follow.
 */
export function splitDocxChapters(
  doc: Json,
  fallbackTitle: string,
): ImportedDocxChapter[] {
  const content = (doc as { content?: Json[] }).content;
  if (!Array.isArray(content) || content.length === 0) {
    return [{ title: fallbackTitle, content: { type: "doc", content: [] } }];
  }

  const chapters: { title: string; nodes: Json[] }[] = [];
  // Two-pass: if the doc marks chapter titles via direct formatting (our own
  // export), trust those — in-chapter Word headings (even level 1) stay put.
  // Otherwise fall back to the Word-native convention (Heading 1 splits).
  const hasChapterTitleMarkers = content.some((node) => {
    const typed = node as { type?: Json; attrs?: { chapterTitle?: Json } };
    return typed.type === "heading" && typed.attrs?.chapterTitle === true;
  });
  let current: { title: string; nodes: Json[] } | null = null;
  for (const node of content) {
    const typed = node as {
      type?: Json;
      attrs?: { level?: Json; chapterTitle?: Json };
    };
    const isTitle =
      typed.type === "heading" &&
      (hasChapterTitleMarkers
        ? typed.attrs?.chapterTitle === true
        : typed.attrs?.level === 1);
    if (isTitle) {
      const title = extractText(node).trim();
      current = { title, nodes: [] };
      chapters.push(current);
    } else {
      if (!current) {
        current = { title: "", nodes: [] };
        chapters.push(current);
      }
      current.nodes.push(node);
    }
  }

  // Drop the leading front-matter chapter when real chapters follow.
  const first = chapters[0];
  let usable = chapters;
  if (chapters.length > 1 && first) {
    if (hasChapterTitleMarkers) {
      // Our export always writes the project title as front-matter before the
      // first real chapter — mirror `splitMarkdownChapters` and drop it.
      usable = chapters.slice(1);
    } else if (first.nodes.length === 0) {
      // Word-native: drop a leading heading that has no body (a title page).
      usable = chapters.slice(1);
    }
  }

  return usable.map((chapter, index) => ({
    title: chapter.title || (index === 0 ? fallbackTitle : `Capítulo ${index + 1}`),
    content: { type: "doc", content: chapter.nodes },
  }));
}

function extractText(node: Json): string {
  const typed = node as { text?: Json; content?: Json[] };
  if (typeof typed.text === "string") return typed.text;
  if (!Array.isArray(typed.content)) return "";
  return typed.content.map((child) => extractText(child)).join("");
}

export interface ImportDocxResult {
  count: number;
  titles: string[];
}

/** Read a .docx blob, convert and persist its chapters into a project. */
export async function importDocxFile(
  projectId: string,
  filename: string,
  bytes: Uint8Array,
): Promise<ImportDocxResult> {
  const files = unzipSync(bytes);
  const documentXml = files["word/document.xml"];
  if (!documentXml) {
    throw new Error("Arquivo .docx inválido: word/document.xml ausente.");
  }
  const doc = docxXmlToTiptap(
    new TextDecoder().decode(documentXml),
    files["word/numbering.xml"]
      ? new TextDecoder().decode(files["word/numbering.xml"])
      : undefined,
  );
  const fallbackTitle = filename.replace(/\.docx$/i, "") || "Capítulo importado";
  const chapters = splitDocxChapters(doc, fallbackTitle);

  const titles: string[] = [];
  for (const chapter of chapters) {
    await chapterRepository.create({
      projectId,
      title: chapter.title,
      content: chapter.content,
    });
    titles.push(chapter.title);
  }
  return { count: chapters.length, titles };
}
