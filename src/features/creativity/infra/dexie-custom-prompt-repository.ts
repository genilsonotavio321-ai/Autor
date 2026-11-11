import { getDatabase } from "@/infra/db";
import { ensureDbReady } from "@/infra/db/ready";
import { createId } from "@/shared/lib/id";
import type { CustomPrompt, EntityId } from "@/shared/types/database";

import type {
  CustomPromptCreateInput,
  CustomPromptRepository,
  CustomPromptUpdateInput,
} from "../domain/repository";

function nowIso(): string {
  return new Date().toISOString();
}

/** Normaliza as variantes: limpa espaços e descarta linhas vazias. */
function cleanVariants(variants: string[]): string[] {
  return variants
    .map((variant) => variant.trim())
    .filter((variant) => variant.length > 0);
}

export class DexieCustomPromptRepository implements CustomPromptRepository {
  async create(input: CustomPromptCreateInput): Promise<CustomPrompt> {
    await ensureDbReady();
    const variants = cleanVariants(input.variants);
    if (variants.length === 0) {
      throw new Error("CustomPrompt precisa de ao menos uma variante");
    }
    const now = nowIso();
    const count = await getDatabase().promptItems.count();
    const prompt: CustomPrompt = {
      id: createId(),
      kind: input.kind,
      category: input.kind === "question" ? input.category : undefined,
      variants,
      enabled: true,
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await getDatabase().promptItems.add(prompt);
    return prompt;
  }

  async update(
    id: EntityId,
    patch: CustomPromptUpdateInput,
  ): Promise<CustomPrompt> {
    await ensureDbReady();
    const db = getDatabase();
    const current = await db.promptItems.get(id);
    if (!current) throw new Error(`CustomPrompt not found: ${id}`);
    const variants = patch.variants
      ? cleanVariants(patch.variants)
      : current.variants;
    if (variants.length === 0) {
      throw new Error("CustomPrompt precisa de ao menos uma variante");
    }
    const prompt: CustomPrompt = {
      ...current,
      category:
        current.kind === "question" ? (patch.category ?? current.category) : undefined,
      variants,
      enabled: patch.enabled ?? current.enabled,
      updatedAt: nowIso(),
    };
    await db.promptItems.put(prompt);
    return prompt;
  }

  async list(): Promise<CustomPrompt[]> {
    await ensureDbReady();
    const all = await getDatabase().promptItems.toArray();
    return all.sort((a, b) => a.order - b.order);
  }

  async hardDelete(id: EntityId): Promise<void> {
    await ensureDbReady();
    await getDatabase().promptItems.delete(id);
  }
}

export const customPromptRepository = new DexieCustomPromptRepository();
