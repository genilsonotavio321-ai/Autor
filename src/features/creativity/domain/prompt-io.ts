import type { CustomPrompt } from "@/shared/types/database";

import { PROMPT_CATEGORIES } from "./prompt-banks";

/** Envelope de exportação de prompts customizados (Settings → Dados). */
export interface PromptExport {
  app: "autor";
  type: "prompts";
  formatVersion: 1;
  items: CustomPrompt[];
}

export function buildPromptExport(items: CustomPrompt[]): PromptExport {
  return { app: "autor", type: "prompts", formatVersion: 1, items };
}

/**
 * Valida o JSON de um arquivo exportado e devolve os prompts.
 * Lança `Error` com mensagem pt-BR se o envelope ou algum item for inválido.
 */
export function parsePromptExport(json: unknown): CustomPrompt[] {
  const data = json as Partial<PromptExport> | null;
  if (
    !data ||
    data.app !== "autor" ||
    data.type !== "prompts" ||
    data.formatVersion !== 1 ||
    !Array.isArray(data.items)
  ) {
    throw new Error("Arquivo de prompts inválido");
  }
  return data.items.map((item, index) => {
    if (
      !item ||
      (item.kind !== "question" && item.kind !== "whatIf") ||
      !Array.isArray(item.variants) ||
      item.variants.length === 0 ||
      item.variants.some(
        (variant) => typeof variant !== "string" || variant.trim() === "",
      )
    ) {
      throw new Error(`Prompt inválido na posição ${index + 1}`);
    }
    if (
      item.kind === "question" &&
      (item.category === undefined ||
        !PROMPT_CATEGORIES.includes(item.category))
    ) {
      throw new Error(`Prompt sem categoria na posição ${index + 1}`);
    }
    return item;
  });
}
