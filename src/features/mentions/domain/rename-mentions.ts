import type { Json } from "@/shared/types/database";

/**
 * Renomeia menções a uma ficha (personagem/local) dentro de um documento
 * Tiptap, trocando cada ocorrência do nome antigo pelo novo. Funções puras —
 * sem editor nem banco.
 */

export interface RenameMentionsResult {
  content: Json;
  /** Quantas ocorrências foram reescritas. */
  count: number;
}

const WORD = "[\\p{L}\\p{N}]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Ajusta a caixa do nome novo à da ocorrência encontrada: tudo minúsculo
 * continua minúsculo, tudo maiúsculo continua maiúsculo, o resto mantém o
 * nome novo como digitado na ficha.
 */
function matchCase(matched: string, newName: string): string {
  const lower = matched.toLocaleLowerCase("pt-BR");
  const upper = matched.toLocaleUpperCase("pt-BR");
  if (matched === lower && matched !== upper) {
    return newName.toLocaleLowerCase("pt-BR");
  }
  if (matched === upper && matched !== lower) {
    return newName.toLocaleUpperCase("pt-BR");
  }
  return newName;
}

function renameInText(
  text: string,
  oldName: string,
  newName: string,
  onMatch: () => void,
): string {
  if (text.length === 0 || oldName.length === 0) return text;
  const pattern = new RegExp(
    `(?<!${WORD})${escapeRegExp(oldName)}(?!${WORD})`,
    "giu",
  );
  return text.replace(pattern, (matched: string, offset: number) => {
    // Não reescreve um trecho que já começa o nome novo: "Davi" não deve
    // transformar "Davi Silva" em "Davi Silva Silva".
    const following = text.slice(offset, offset + newName.length);
    if (following.toLocaleLowerCase("pt-BR") === newName.toLocaleLowerCase("pt-BR")) {
      return matched;
    }
    onMatch();
    return matchCase(matched, newName);
  });
}

function walk(node: Json, oldName: string, newName: string, onMatch: () => void): Json {
  if (Array.isArray(node)) {
    return node.map((item) => walk(item, oldName, newName, onMatch));
  }
  if (node && typeof node === "object") {
    const result: Record<string, Json> = {};
    const isTextNode = node.type === "text";
    for (const [key, value] of Object.entries(node)) {
      if (isTextNode && key === "text" && typeof value === "string") {
        result[key] = renameInText(value, oldName, newName, onMatch);
      } else {
        result[key] = walk(value as Json, oldName, newName, onMatch);
      }
    }
    return result;
  }
  return node;
}

/**
 * Reescreve as ocorrências de `oldName` por `newName` no documento. Sem
 * mudanças quando os nomes são iguais, o antigo é curto demais ou vazio.
 */
export function renameMentionsInContent(
  content: Json,
  oldName: string,
  newName: string,
): RenameMentionsResult {
  if (oldName.length < 2 || oldName === newName) {
    return { content, count: 0 };
  }
  let count = 0;
  const next = walk(structuredClone(content), oldName, newName, () => {
    count += 1;
  });
  return { content: next, count };
}
