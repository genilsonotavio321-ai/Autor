import { expect, test } from "@playwright/test";

import {
  addCharacter,
  createChapter,
  createProject,
  openAdvancedSettings,
  openChapterEditor,
  waitNoToasts,
} from "./helpers";

test("modo leitura: destaques, toggle e botão Editar", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Leitura");
  await addCharacter(page, "Helena");

  await page.goto(url);
  await createChapter(page, "Capítulo 1");
  await openChapterEditor(page, "Capítulo 1");
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Helena caminhou até o farol.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  // B2: o destaque aparece no modo leitura.
  await page.goto("/read");
  await expect(page.locator(".mention")).toHaveText("Helena");

  // B2: desligar o destaque do modo leitura remove o realce.
  await page.goto("/settings");
  await openAdvancedSettings(page);
  const toggle = page.getByRole("switch", { name: "Destacar no modo leitura" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await page.goto("/read");
  await expect(page.locator(".ProseMirror")).toContainText("Helena");
  await expect(page.locator(".mention")).toHaveCount(0);

  // B3: o botão Editar capítulo leva ao editor do capítulo.
  await page.getByRole("button", { name: "Editar capítulo" }).click();
  await expect(page).toHaveURL(/\/write\//);
  await expect(page.getByLabel("Título do capítulo")).toHaveValue("Capítulo 1");
});

test("capítulo arquivado abre na leitura pelo link", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Arquivado");
  await page.goto(url);
  await createChapter(page, "Capítulo 1");
  await createChapter(page, "Capítulo 2");

  await page.goto(url);
  await page.getByRole("button", { name: "Ações de Capítulo 2" }).click();
  await page.getByRole("menuitem", { name: "Arquivar" }).click();
  await waitNoToasts(page);

  await page.getByRole("button", { name: "Revelar arquivados" }).click();
  await page.getByRole("link", { name: /Capítulo 2/ }).click();
  await expect(page).toHaveURL(/\/read$/);
  // A query some da URL; o capítulo pedido não pode cair no primeiro da lista.
  await expect(page.getByRole("heading", { name: "Capítulo 2" })).toBeVisible();
});

test("primeiro carregamento retoma o último capítulo uma vez", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Retomada");
  await page.goto(url);
  await createChapter(page, "Capítulo 1");
  await openChapterEditor(page, "Capítulo 1");
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Paramos aqui.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/write\/[0-9a-f-]+/, { timeout: 10_000 });
  await expect(page.getByLabel("Título do capítulo")).toHaveValue(
    "Capítulo 1",
  );

  // A retomada é só do primeiro carregamento: a segunda visita é a Início.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
});
