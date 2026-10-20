import { expect, test } from "@playwright/test";

import { addCharacter, createProject } from "./helpers";

test("resultados da busca abrem o destino com o diálogo certo", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createProject(page, "Projeto Deeplink");
  await addCharacter(page, "Helena");

  await page.goto("/notes");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título").fill("Pista do farol");
  await page.getByLabel("Conteúdo").fill("A chave estava sob o tapete.");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Projeto → página do projeto. (Sem rota /search: a busca vive na home.)
  await page.goto("/");
  await page.getByLabel("Buscar no acervo").fill("Deeplink");
  const project = page.getByRole("link", { name: /Projeto Deeplink/ });
  await expect(project).toBeVisible();
  await project.click();
  await expect(page).toHaveURL(/\/projects\/[0-9a-f-]+$/);

  // Personagem → /characters com a ficha aberta.
  await page.goto("/");
  await page.getByLabel("Buscar no acervo").fill("Helena");
  await page.getByRole("link", { name: /Helena/ }).click();
  await expect(page).toHaveURL(/\/characters/);
  const characterDialog = page.getByRole("dialog");
  await expect(characterDialog).toBeVisible();
  await expect(
    characterDialog.getByText("Helena", { exact: true }),
  ).toBeVisible();

  // Nota → visualização aberta em /notes.
  await page.goto("/");
  await page.getByLabel("Buscar no acervo").fill("farol");
  await page.getByRole("link", { name: /Pista do farol/ }).click();
  await expect(page).toHaveURL(/\/notes/);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("A chave estava sob o tapete.")).toBeVisible();
});
