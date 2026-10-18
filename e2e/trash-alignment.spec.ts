import { expect, test, type Page } from "@playwright/test";

import { createProject } from "./helpers";

/**
 * After an action that CREATES a toast: wait for it to actually render, then
 * for the whole stack to expire (sonner default = 4s). The two-step wait
 * closes the race where a bare toHaveCount(0) passes before the async success
 * toast appears — leaving it alive to intercept the "Desfazer" button.
 */
async function waitForToastCycle(page: Page) {
  const toasts = page.locator("[data-sonner-toast]");
  await expect(toasts.first()).toBeVisible({ timeout: 3_000 });
  await expect(toasts).toHaveCount(0, { timeout: 8_000 });
}

/** No toast on screen and none pending (safe when nothing creates one). */
async function waitNoToasts(page: Page) {
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 8_000,
  });
}

function undoButton(page: Page) {
  return page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "movido para a lixeira" })
    .getByRole("button", { name: "Desfazer" });
}

test("linha do tempo: desfazer exclusão e restaurar pela lixeira", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createProject(page, "Cronologia");

  await page.goto("/timeline");
  await page.getByRole("button", { name: "Novo evento" }).click();
  await page.getByLabel("Data").fill("1900");
  await page.getByLabel("Título").fill("Desfecho");
  await page.getByRole("button", { name: "Salvar" }).click();
  await waitForToastCycle(page);

  // Scoped to <main> — Sonner renders its toasts as `<ol><li>` too, and the
  // toast text ("…movido para a lixeira") would otherwise match this filter.
  const events = page.locator("main ol li");
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(1);

  // Exclusão com toast de desfazer (padrão das demais telas).
  await page.getByRole("button", { name: "Excluir Desfecho" }).click();
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(0);
  await undoButton(page).click();
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(1);

  // Excluir de novo e restaurar pela lixeira.
  await waitNoToasts(page);
  await page.getByRole("button", { name: "Excluir Desfecho" }).click();
  await page.goto("/trash");
  const section = page.getByRole("region", {
    name: "Eventos (linha do tempo)",
  });
  await expect(section).toBeVisible({ timeout: 15_000 });
  await section.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/timeline");
  await expect(events.filter({ hasText: "Desfecho" })).toHaveCount(1, {
    timeout: 15_000,
  });
});

test("beats: desfazer exclusão e restaurar pela lixeira", async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, "Enredo");

  await page.goto("/outline");
  await page.getByRole("tab", { name: "Beats" }).click();
  await page.getByRole("button", { name: "Aplicar template" }).click();
  const beat = page.getByRole("button", {
    name: "1. Mundo comum",
    exact: true,
  });
  await expect(beat).toBeVisible();
  await waitForToastCycle(page);

  // Exclusão com toast de desfazer.
  await page.getByRole("button", { name: "Excluir 1. Mundo comum" }).click();
  await undoButton(page).click();
  await expect(beat).toBeVisible();

  // Excluir de novo e restaurar pela lixeira.
  await waitNoToasts(page);
  await page.getByRole("button", { name: "Excluir 1. Mundo comum" }).click();
  await page.goto("/trash");
  const section = page.getByRole("region", { name: "Beats" });
  await expect(section).toBeVisible({ timeout: 15_000 });
  await section.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/outline");
  await page.getByRole("tab", { name: "Beats" }).click();
  await expect(beat).toBeVisible({ timeout: 15_000 });
});

test("cenas e capítulos na lixeira com restauração em cascata", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createProject(page, "Estrutura");

  await page.goto("/outline");
  await page.getByRole("button", { name: "Adicionar capítulo" }).click();
  await page
    .getByRole("button", { name: "Adicionar cena em Capítulo 1" })
    .click();
  await expect(page.getByRole("link", { name: "Capítulo 1" })).toBeVisible();

  // Deleta a cena pelo diálogo (fica na lixeira) — espera o toast expirar
  // para não interceptar o clique seguinte em "Excluir Capítulo 1".
  await page.getByRole("button", { name: "Editar Cena 1" }).click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await waitForToastCycle(page);

  // Deleta o capítulo (também fica na lixeira).
  await page.getByRole("button", { name: "Excluir Capítulo 1" }).click();

  await page.goto("/trash");
  await expect(page.getByRole("region", { name: "Capítulos" })).toBeVisible({
    timeout: 15_000,
  });

  // Restaurar a cena órfã restaura o capítulo pai junto (cascata).
  const scenes = page.getByRole("region", { name: "Cenas" });
  await scenes.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible({
    timeout: 15_000,
  });

  await page.goto("/outline");
  await expect(page.getByRole("link", { name: "Capítulo 1" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Editar Cena 1" }),
  ).toBeVisible();
});
