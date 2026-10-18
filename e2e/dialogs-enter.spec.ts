import { expect, test, type Page } from "@playwright/test";

import { createProject, waitNoToasts } from "./helpers";

function noteCard(page: Page, title: string) {
  return page.locator("main ul li").filter({ hasText: title });
}

test("Enter salva o diálogo, mas não dentro da área de texto", async ({
  page,
}) => {
  await createProject(page, "Projeto Enter");
  await page.goto("/notes");

  // Enter em um input dispara o padrão "salvar" do diálogo.
  await page.getByRole("button", { name: "Nova nota" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Título").fill("Ideia rápida");
  await dialog.getByLabel("Título").press("Enter");

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(noteCard(page, "Ideia rápida")).toHaveCount(1);
  await waitNoToasts(page);

  // Enter dentro do Textarea apenas quebra a linha — não salva.
  await page.getByRole("button", { name: "Nova nota" }).click();
  const content = page.getByLabel("Conteúdo");
  await content.fill("linha um");
  await content.press("Enter");
  await page.keyboard.type("linha dois");

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(content).toHaveValue("linha um\nlinha dois");

  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(noteCard(page, "Ideia rápida")).toHaveCount(1);
});
