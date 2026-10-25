import { expect, test, type Page } from "@playwright/test";

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

/** Cria um projeto e entra no canvas com `count` cards (dialog de edição fechado). */
async function setupCanvas(page: Page, count: number) {
  await createProject(page, "Gestos");
  await page.goto("/canvas");
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "Nova ideia" }).click();
    const dialog = page.getByRole("dialog");
    // createCard é assíncrono (Dexie): espera abrir antes de fechar.
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }
}

test("canvas: gestos de mouse — arraste, hold e seleção múltipla", async ({
  page,
}) => {
  await setupCanvas(page, 2);
  const first = page.locator("div[data-card-id]").first();
  const second = page.locator("div[data-card-id]").nth(1);

  // Arraste: move o card 250/40 px (zoom 1: px de tela = px de conteúdo).
  // 250px afasta o primeiro card do segundo (sem sobreposição nos cliques).
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(first).toHaveCSS("left", "266px");
  await expect(first).toHaveCSS("top", "56px");

  // Hold parado ~300ms seleciona; mover depois não arrasta (trava).
  const box2 = (await second.boundingBox())!;
  await page.mouse.move(box2.x + 30, box2.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await expect(second).toHaveClass(/ring-2/);
  await page.mouse.move(box2.x + 280, box2.y + 60, { steps: 4 });
  await page.mouse.up();
  await expect(second).toHaveCSS("left", "40px");

  // Ctrl+clique acumula; Esc limpa a seleção inteira.
  await first.click({ modifiers: ["Control"] });
  await expect(first).toHaveClass(/ring-2/);
  await page.keyboard.press("Escape");
  await expect(first).not.toHaveClass(/ring-2/);
  await expect(second).not.toHaveClass(/ring-2/);
});
