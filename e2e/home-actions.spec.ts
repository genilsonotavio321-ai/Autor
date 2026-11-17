import { expect, test } from "@playwright/test";

import { createProject, gotoHome } from "./helpers";

test("Início: nova história abre o formulário de projeto", async ({ page }) => {
  await gotoHome(page);
  await page.getByRole("button", { name: /Nova história/ }).click();

  await expect(page).toHaveURL(/\/projects/);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Novo projeto" })).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toHaveCount(0);
});

test("Início: novo capítulo cria no projeto escolhido e abre o editor", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createProject(page, "Projeto Capítulo Rápido");
  await gotoHome(page);

  await page.getByRole("button", { name: /Novo capítulo/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Projeto Capítulo Rápido" }).click();

  await expect(page).toHaveURL(/\/write\/[0-9a-f-]+/, { timeout: 10_000 });
  await expect(page.getByLabel("Título do capítulo")).toBeVisible();
});
