import type { IdeaBoardItem } from "@/shared/types/database";

/** Envelope de exportação do canvas (Criatividade → Canvas de ideias). */
export interface BoardExport {
  app: "autor";
  type: "idea-canvas";
  formatVersion: 1;
  items: IdeaBoardItem[];
}

export function buildBoardExport(items: IdeaBoardItem[]): BoardExport {
  return { app: "autor", type: "idea-canvas", formatVersion: 1, items };
}

/**
 * Valida o JSON de um quadro exportado e devolve os itens.
 * Lança `Error` com mensagem pt-BR se o envelope ou algum item for inválido.
 */
export function parseBoardExport(json: unknown): IdeaBoardItem[] {
  const data = json as Partial<BoardExport> | null;
  if (
    !data ||
    data.app !== "autor" ||
    data.type !== "idea-canvas" ||
    data.formatVersion !== 1 ||
    !Array.isArray(data.items)
  ) {
    throw new Error("Arquivo de quadro inválido");
  }
  return data.items.map((item, index) => {
    if (
      !item ||
      typeof item.key !== "string" ||
      item.key.trim() === "" ||
      typeof item.title !== "string" ||
      typeof item.content !== "string" ||
      !Number.isFinite(item.x) ||
      !Number.isFinite(item.y) ||
      (item.links !== undefined &&
        (!Array.isArray(item.links) ||
          item.links.some((key) => typeof key !== "string"))) ||
      (item.w !== undefined && !Number.isFinite(item.w)) ||
      (item.h !== undefined && !Number.isFinite(item.h)) ||
      (item.refType !== undefined &&
        item.refType !== "character" &&
        item.refType !== "location") ||
      (item.refId !== undefined && typeof item.refId !== "string")
    ) {
      throw new Error(`Item inválido na posição ${index + 1}`);
    }
    return item;
  });
}
