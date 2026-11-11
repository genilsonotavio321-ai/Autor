import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import type { Project } from "@/shared/types/database";

import { buildDocxBlob, type DocxChapterInput } from "./docx-export";

const project = { title: "Romance" } as Project;

async function documentXml(chapters: DocxChapterInput[]): Promise<string> {
  const blob = await buildDocxBlob(project, chapters);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return new TextDecoder().decode(files["word/document.xml"] ?? new Uint8Array());
}

describe("buildDocxBlob", () => {
  it("keeps the heading level stored in attrs", async () => {
    const xml = await documentXml([
      {
        title: "Capítulo 1",
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "Cena" }],
            },
            {
              type: "heading",
              attrs: { level: 3 },
              content: [{ type: "text", text: "Cena menor" }],
            },
          ],
        },
      },
    ]);

    expect(xml).toContain("Heading2");
    expect(xml).toContain("Heading3");
    expect(xml).not.toContain("Heading1");
  });

  it("falls back to the legacy root level", async () => {
    const xml = await documentXml([
      {
        title: "Capítulo 1",
        content: {
          type: "doc",
          content: [
            {
              type: "heading",
              level: 2,
              content: [{ type: "text", text: "Cena" }],
            },
          ],
        },
      },
    ]);

    expect(xml).toContain("Heading2");
  });
});
