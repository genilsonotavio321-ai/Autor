import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import { getDatabase } from "@/infra/db";

import { DexieCustomPromptRepository } from "./dexie-custom-prompt-repository";

const repository = new DexieCustomPromptRepository();

beforeEach(async () => {
  await getDatabase().promptItems.clear();
});

describe("DexieCustomPromptRepository", () => {
  it("creates prompts with defaults and trimmed variants", async () => {
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
      variants: ["perdesse a voz na hora do discurso"],
    });
    expect(whatIf.category).toBeUndefined();
    expect(whatIf.order).toBe(1);
  });

  it("rejects prompts without usable variants", async () => {
    await expect(
      repository.create({ kind: "question", category: "mundo", variants: [" "] }),
    ).rejects.toThrow(/variante/);
    await expect(
      repository.update("inexistente", { variants: ["x"] }),
    ).rejects.toThrow(/not found/);
  });

  it("updates variants, category and enabled", async () => {
    const prompt = await repository.create({
      kind: "question",
      category: "enredo",
      variants: ["versão 1"],
    });
    const updated = await repository.update(prompt.id, {
      category: "mundo",
      variants: ["  versão 2  ", ""],
      enabled: false,
    });
    expect(updated.category).toBe("mundo");
    expect(updated.variants).toEqual(["versão 2"]);
    expect(updated.enabled).toBe(false);
  });

  it("lists in creation order and hard-deletes", async () => {
    const a = await repository.create({ kind: "whatIf", variants: ["a"] });
    const b = await repository.create({ kind: "whatIf", variants: ["b"] });
    expect((await repository.list()).map((item) => item.id)).toEqual([a.id, b.id]);

    await repository.hardDelete(a.id);
    const rest = await repository.list();
    expect(rest).toHaveLength(1);
    expect(rest[0]?.id).toBe(b.id);
  });
});
