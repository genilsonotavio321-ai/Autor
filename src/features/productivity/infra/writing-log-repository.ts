import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import type { Json } from "@/shared/types/database";

import {
  addSprint,
  addWords,
  EMPTY_WRITING_LOG,
  type WritingLog,
} from "../domain/writing-log";

export const WRITING_LOG_KEY = "writing-log";

/** Valida e normaliza o valor lido da tabela `settings`. */
function parseLog(value: unknown): WritingLog {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...EMPTY_WRITING_LOG };
  }
  const log: WritingLog = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") continue;
    const words = (entry as { words?: unknown }).words;
    const sprints = (entry as { sprints?: unknown }).sprints;
    if (typeof words !== "number") continue;
    log[key] = { words, sprints: typeof sprints === "number" ? sprints : 0 };
  }
  return log;
}

export async function getWritingLog(): Promise<WritingLog> {
  await ensureDbReady();
  const row = await getDatabase().settings.get(WRITING_LOG_KEY);
  return parseLog(row?.value);
}

/**
 * Read-modify-write inside a transaction: o navegador serializa escritas na
 * mesma tabela, então chamadas concorrentes (autosave do editor + ticker do
 * sprint) não apagam os deltas umas das outras.
 */
async function updateLog(apply: (log: WritingLog) => WritingLog): Promise<void> {
  await ensureDbReady();
  const db = getDatabase();
  await db.transaction("rw", db.settings, async () => {
    const row = await db.settings.get(WRITING_LOG_KEY);
    await db.settings.put({
      key: WRITING_LOG_KEY,
      value: apply(parseLog(row?.value)) as unknown as Json,
    });
  });
}

/** Registra palavras escritas no dia (deltas positivos). */
export async function recordWords(
  dayKey: string,
  words: number,
): Promise<void> {
  if (words <= 0) return;
  await updateLog((log) => addWords(log, dayKey, words));
}

/** Registra a conclusão de uma sessão de sprint. */
export async function recordSprint(dayKey: string): Promise<void> {
  await updateLog((log) => addSprint(log, dayKey));
}
