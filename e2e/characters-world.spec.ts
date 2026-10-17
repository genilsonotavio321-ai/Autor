import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test.describe("Fase 3: personagens e mundo", () => {
  test("cria personagens, registra relação e desfaz exclusão", async ({
    page,
  }) => {
    await createProject(page, "Projeto Personagens");
    await page.goto("/characters");

    await page.getByRole("button", { name: "Novo personagem" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Ana");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(
      page.getByRole("button", { name: "Ana", exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Novo personagem" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Bruno");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(
      page.getByRole("button", { name: "Bruno", exact: true }),
    ).toBeVisible();

    // Edita Ana e registra relação de amizade com Bruno.
    await page.getByRole("button", { name: "Ana", exact: true }).click();
    await page.getByLabel("Personagem relacionado").click();
    await page.getByRole("option", { name: "Bruno" }).click();
    await page.getByRole("button", { name: "Adicionar relação" }).click();
    await expect(page.getByText("Amizade").first()).toBeVisible();
    await page.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("1 relação")).toBeVisible();

    // Exclusão com desfazer.
    await page.getByRole("button", { name: "Excluir Bruno" }).click();
    await expect(
      page.getByRole("button", { name: "Bruno", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(
      page.getByRole("button", { name: "Bruno", exact: true }),
    ).toBeVisible();
  });

  test("cria local e entrada de lore, desfaz exclusão", async ({ page }) => {
    await createProject(page, "Projeto Mundo");
    await page.goto("/world");

    await page.getByRole("button", { name: "Novo local" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Castelo Norte");
    await page.getByLabel("Tipo").fill("Castelo");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Castelo Norte")).toBeVisible();
    await expect(page.getByText("Castelo", { exact: true }).first()).toBeVisible();

    await page.getByRole("tab", { name: /Lore/ }).click();
    await page.getByRole("button", { name: "Nova entrada" }).click();
    await page.getByLabel("Título", { exact: true }).fill("A Coroa Antiga");
    await page.getByLabel("Categoria").fill("História");
    await page.getByLabel("Conteúdo").fill("Forjada na Primeira Era.");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("A Coroa Antiga")).toBeVisible();
    await expect(page.getByText("Forjada na Primeira Era.")).toBeVisible();

    // Exclusão de local com desfazer.
    await page.getByRole("tab", { name: /Locais/ }).click();
    await page.getByRole("button", { name: "Excluir Castelo Norte" }).click();
    await expect(
      page.getByRole("button", { name: "Castelo Norte", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Desfazer" }).click();
    await expect(
      page.getByRole("button", { name: "Castelo Norte", exact: true }),
    ).toBeVisible();
  });
});
