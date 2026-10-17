import { extractDocText } from "@/shared/lib/text";
import type { Chapter, Json, Project, Scene } from "@/shared/types/database";

function renderInlineFromJson(node: Json): string {
  if (Array.isArray(node)) {
    return node.map(renderInlineFromJson).join("");
  }
  if (node === null || typeof node !== "object") return "";
  const record = node as Record<string, Json>;

  if (record.type === "text" && typeof record.text === "string") {
    const marks = (record.marks ?? []) as Array<Record<string, unknown>>;
    let text = record.text;
    const has = (name: string) => marks.some((mark) => mark.type === name);
    if (has("code")) text = `\`${text}\``;
    if (has("bold")) text = `**${text}**`;
    if (has("italic")) text = `*${text}*`;
    if (has("strike")) text = `~~${text}~~`;
    return text;
  }

  return renderBlockChildren(record, 0).trimEnd();
}

function inlineContent(node: Record<string, Json>): string {
  return renderInlineFromJson(node.content ?? []);
}

function renderBlockChildren(
  record: Record<string, Json>,
  depth: number,
): string {
  const indent = "  ".repeat(depth);
  const content = Array.isArray(record.content) ? record.content : [];

  switch (record.type) {
    case "paragraph":
      return `${inlineContent(record)}\n\n`;
    case "heading": {
      const level = Math.min(Math.max(Number(record.level ?? 1), 1), 6);
      return `${"#".repeat(level)} ${inlineContent(record)}\n\n`;
    }
    case "hardBreak":
      return "\n";
    case "horizontalRule":
      return "---\n\n";
    case "codeBlock": {
      const text = extractDocText({ content: content });
      return `\`\`\`\n${text}\n\`\`\`\n\n`;
    }
    case "blockquote": {
      const inner = content
        .map((child) => renderBlockChildren(child as Record<string, Json>, depth))
        .join("")
        .trimEnd();
      const quoted = inner
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
      return `${quoted}\n\n`;
    }
    case "bulletList":
    case "orderedList": {
      const marker = record.type === "bulletList" ? "-" : "1.";
      const items = content
        .map((child) => {
          const item = child as Record<string, Json>;
          const paragraphs = Array.isArray(item.content) ? item.content : [];
          const lines: string[] = [];
          paragraphs.forEach((paragraph, index) => {
            const p = paragraph as Record<string, Json>;
            const text =
              p.type === "paragraph" || p.type === "heading"
                ? inlineContent(p)
                : renderBlockChildren(p, depth + 1).trimEnd();
            if (index === 0) {
              lines.push(`${indent}${marker} ${text}`);
            } else if (text) {
              lines.push(`${indent}  ${text}`);
            }
          });
          return lines.join("\n");
        })
        .filter(Boolean)
        .join("\n");
      return `${items}\n\n`;
    }
    case "listItem":
      return `${inlineContent(record)}\n`;
    default: {
      // Unknown block: fall back to rendering its children.
      return content.map(renderInlineFromJson).join("");
    }
  }
}

/** Serializes a Tiptap document JSON to Markdown (headings 1–3, lists, quotes, code). */
export function docToMarkdown(doc: Json): string {
  const content = (doc as Record<string, Json>).content;
  const blocks = Array.isArray(content) ? content : [];
  return blocks
    .map((node) => renderBlockChildren(node as Record<string, Json>, 0))
    .join("")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ---------------------------------------------------------------------------
// Markdown → Tiptap (mini parser, covers what docToMarkdown emits)
// ---------------------------------------------------------------------------

function parseInline(line: string): Json[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|`[^`]+`)/g;
  const nodes: Json[] = [];
  for (const part of line.split(pattern)) {
    if (!part) continue;
    let marks: Array<{ type: string }> | undefined;
    let text = part;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      marks = [{ type: "bold" }];
      text = part.slice(2, -2);
    } else if (part.startsWith("~~") && part.endsWith("~~") && part.length > 4) {
      marks = [{ type: "strike" }];
      text = part.slice(2, -2);
    } else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      marks = [{ type: "code" }];
      text = part.slice(1, -1);
    } else if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      marks = [{ type: "italic" }];
      text = part.slice(1, -1);
    }
    nodes.push(
      marks ? { type: "text", text, marks } : { type: "text", text },
    );
  }
  return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
}

function paragraphNode(text: string): Json {
  const content = parseInline(text);
  const only = content.length === 1;
  if (only && (content[0] as { text?: string }).text === "") {
    return { type: "paragraph" };
  }
  return { type: "paragraph", content };
}

/**
 * Parses a Markdown subset (headings, paragraphs, bullet/ordered lists,
 * blockquotes, fenced code, horizontal rules) into a Tiptap document.
 */
export function markdownToDoc(markdown: string): Json {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: Json[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";

    if (line.trim() === "") {
      index += 1;
      continue;
    }

    // Fenced code block
    if (line.trimStart().startsWith("```")) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !(lines[index] ?? "").trimStart().startsWith("```")) {
        code.push(lines[index] ?? "");
        index += 1;
      }
      index += 1; // closing fence
      blocks.push({
        type: "codeBlock",
        content: code.length > 0 ? [{ type: "text", text: code.join("\n") }] : [],
      });
      continue;
    }

    // Heading
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({
        type: "heading",
        level: Math.min(heading[1]?.length ?? 1, 3),
        content: parseInline(heading[2] ?? ""),
      });
      index += 1;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      blocks.push({ type: "horizontalRule" });
      index += 1;
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const quoted: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quoted.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({
        type: "blockquote",
        content: [paragraphNode(quoted.join(" "))],
      });
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: Json[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index] ?? "")) {
        items.push({
          type: "listItem",
          content: [paragraphNode((lines[index] ?? "").replace(/^[-*]\s+/, ""))],
        });
        index += 1;
      }
      blocks.push({ type: "bulletList", content: items });
      continue;
    }

    // Ordered list
    if (/^\d+[.)]\s+/.test(line)) {
      const items: Json[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index] ?? "")) {
        items.push({
          type: "listItem",
          content: [paragraphNode((lines[index] ?? "").replace(/^\d+[.)]\s+/, ""))],
        });
        index += 1;
      }
      blocks.push({ type: "orderedList", content: items });
      continue;
    }

    // Paragraph: merge consecutive plain lines
    const paragraph: string[] = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index] ?? "";
      if (
        next.trim() === "" ||
        /^(#{1,6})\s+/.test(next) ||
        /^[-*]\s+/.test(next) ||
        /^\d+[.)]\s+/.test(next) ||
        /^>\s?/.test(next) ||
        next.trimStart().startsWith("```") ||
        /^(-{3,}|\*{3,}|_{3,})$/.test(next.trim())
      ) {
        break;
      }
      paragraph.push(next);
      index += 1;
    }
    blocks.push(paragraphNode(paragraph.join(" ")));
  }

  if (blocks.length === 0) blocks.push({ type: "paragraph" });
  return { type: "doc", content: blocks };
}

// ---------------------------------------------------------------------------
// Project assembly + import splitting
// ---------------------------------------------------------------------------

export interface ProjectMarkdownInput {
  project: Project;
  chapters: Chapter[];
  scenesByChapter?: Map<string, Scene[]>;
}

/** Assembles a whole project (front matter + chapters + scenes) as Markdown. */
export function projectToMarkdown({
  project,
  chapters,
  scenesByChapter,
}: ProjectMarkdownInput): string {
  const parts: string[] = [`# ${project.title}`, ""];

  if (project.subtitle) parts.push(`*${project.subtitle}*`, "");
  if (project.author) parts.push(`Autor: ${project.author}`, "");
  if (project.description) parts.push(project.description, "");

  parts.push("---", "");

  const ordered = [...chapters].sort((a, b) => a.order - b.order);
  ordered.forEach((chapter, index) => {
    parts.push(`# ${index + 1}. ${chapter.title}`, "");
    const body = docToMarkdown(chapter.content);
    if (body) parts.push(body, "");

    const scenes = scenesByChapter?.get(chapter.id) ?? [];
    scenes.forEach((scene, sceneIndex) => {
      parts.push(`## Cena ${sceneIndex + 1}: ${scene.title}`, "");
      if (scene.summary) parts.push(scene.summary, "");
      const sceneBody = docToMarkdown(scene.content);
      if (sceneBody) parts.push(sceneBody, "");
    });
  });

  return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export interface MarkdownChapterChunk {
  title: string;
  markdown: string;
}

/**
 * Splits an exported project Markdown into one chunk per level-1 heading
 * (used by the Markdown import to recreate chapters). The front-matter
 * heading is the first chunk and is dropped when more chunks follow.
 */
export function splitMarkdownChapters(markdown: string): MarkdownChapterChunk[] {
  const normalized = markdown.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const starts: number[] = [];
  lines.forEach((line, i) => {
    if (/^#\s+/.test(line)) starts.push(i);
  });

  if (starts.length === 0) {
    const fallback = extractDocText(markdownToDoc(normalized));
    if (!fallback.trim()) return [];
    return [{ title: "", markdown: normalized }];
  }

  const chunks: MarkdownChapterChunk[] = [];
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? lines.length;
    const slice = lines.slice(start, end).join("\n");
    const title = (lines[start] ?? "").replace(/^#\s+/, "").trim();
    chunks.push({ title, markdown: slice });
  });

  const usable = chunks.length > 1 ? chunks.slice(1) : chunks;
  return usable.map((chunk) => ({
    title: chunk.title.replace(/^\d+[.)]\s+/, "").trim(),
    markdown: chunk.markdown,
  }));
}
