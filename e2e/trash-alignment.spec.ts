import { expect, test } from "@playwright/test";

import { chapterLink, createChapter, createProject } from "./helpers";

test("linha do tempo: excluir e restaurar pela lixeira", async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, "Cronologia");

  await page.goto("/timeline");
  await page.getByRole("button", { name: "Novo evento" }).click();
  await page.getByLabel("Data").fill("1900");
  await page.getByLabel("Título").fill("Desfecho");
  await page.getByRole("button", { name: "Salvar" }).click();

  const events = page.locator("main ol li");
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(1);

  // Exclusão direta, sem toast: a restauração vive na Lixeira.
  await page.getByRole("button", { name: "Excluir Desfecho" }).click();
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(0);

  await page.goto("/trash");
  const section = page.getByRole("region", {
    name: "Eventos (linha do tempo)",
  });
  await expect(section).toBeVisible({ timeout: 15_000 });
  await section.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/timeline");
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("beats: excluir e restaurar pela lixeira", async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, "Enredo");

  await page.goto("/outline");
  await page.getByRole("tab", { name: "Estrutura" }).click();
  await page.getByRole("button", { name: "Aplicar estrutura" }).click();
  const beat = page.getByRole("button", {
    name: "Mundo comum",
    exact: true,
  });
  await expect(beat).toBeVisible();

  await page.getByRole("button", { name: "Excluir Mundo comum" }).click();
  await expect(beat).toHaveCount(0);

  await page.goto("/trash");
  const section = page.getByRole("region", { name: "Beats" });
  await expect(section).toBeVisible({ timeout: 15_000 });
  await section.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/outline");
  await page.getByRole("tab", { name: "Estrutura" }).click();
  await expect(beat).toBeVisible({ timeout: 15_000 });
});

test("cenas e capítulos na lixeira com restauração em cascata", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createProject(page, "Estrutura");

  await page.goto("/outline");
  await page.getByRole("tab", { name: "Roteiro" }).click();
  await createChapter(page, "Capítulo 1");
  await page
    .getByRole("button", { name: "Adicionar cena em Capítulo 1" })
    .click();
  await expect(chapterLink(page, "Capítulo 1")).toBeVisible();

  // Deleta a cena pelo diálogo (fica na lixeira).
  await page.getByRole("button", { name: "Editar Cena 1" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();

  // Deleta o capítulo (também fica na lixeira).
  await page.getByRole("button", { name: "Excluir Capítulo 1" }).click();

  await page.goto("/trash");
  await expect(page.getByRole("region", { name: "Capítulos" })).toBeVisible({
    timeout: 15_000,
  });

  // Restaurar a cena órfã restaura o capítulo pai junto (cascata).
  const scenes = page.getByRole("region", { name: "Cenas" });
  await scenes.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/outline");
  await page.getByRole("tab", { name: "Roteiro" }).click();
  await expect(chapterLink(page, "Capítulo 1")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Editar Cena 1" }),
  ).toBeVisible();
});
