import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test("canvas: modo foco ocupa a tela e Esc restaura", async ({ page }) => {
  await createProject(page, "Foco");

  await page.goto("/canvas");
  // Board só existe com cards — cria um e fecha o dialog de edição.
  await page.getByRole("button", { name: "Nova ideia" }).click();
  // createCard é assíncrono (Dexie): espera o dialog abrir ANTES do Esc.
  const editDialog = page.getByRole("dialog");
  await expect(editDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editDialog).toBeHidden();
  await expect(page.locator("[data-slot='dialog-overlay']")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Ativar modo foco (Esc para sair)" })
    .click();

  // Chrome do app some: sem header, sem sidebar, sem abas.
  await expect(page.getByRole("banner")).toBeHidden();
  await expect(page.locator("aside")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Canvas" })).toBeHidden();
  await expect(page.getByRole("tablist")).toBeHidden();

  // O board estica até (quase) a altura da viewport.
  const box = await page
    .locator("[data-slot='canvas-board']")
    .boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  if (box && viewport) {
    expect(box.height).toBeGreaterThan(viewport.height - 160);
  }

  // Esc restaura o chrome; o card continua lá.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Canvas" }),
  ).toBeVisible();
  await expect(page.getByRole("tablist")).toBeVisible();
  await expect(page.locator("div[data-card-id]").first()).toBeVisible();
});
