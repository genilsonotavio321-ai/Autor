import { expect, test, type Page } from "@playwright/test";

import { addCharacter, createProject } from "./helpers";

/** Cria um projeto e entra no canvas com `count` cards (edição inline fechada). */
async function setupCanvas(page: Page, count: number) {
  await createProject(page, "Gestos");
  await page.goto("/canvas");
  for (let i = 0; i < count; i++) {
    await page.getByRole("button", { name: "Nova ideia" }).click();
    // createCard é assíncrono (Dexie): espera a edição abrir antes de fechar.
    const title = page.getByLabel("Título da ideia");
    await expect(title).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(title).toBeHidden();
  }
}

test("canvas: modo foco ocupa a tela e Esc restaura", async ({ page }) => {
  await createProject(page, "Foco");

  await page.goto("/canvas");
  // Board só existe com cards — cria um e sai da edição inline.
  await page.getByRole("button", { name: "Nova ideia" }).click();
  const title = page.getByLabel("Título da ideia");
  await expect(title).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(title).toBeHidden();

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

test("canvas: gestos de mouse — arraste, hold e seleção múltipla", async ({
  page,
}) => {
  await setupCanvas(page, 2);
  const first = page.locator("div[data-card-id]").first();
  const second = page.locator("div[data-card-id]").nth(1);

  // Arraste: move o card em 250/40 px (zoom 1: px de tela = px de conteúdo).
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
  await page.mouse.move(box2.x + 90, box2.y + 60, { steps: 4 });
  await page.mouse.up();
  await expect(second).toHaveCSS("left", "40px");

  // Ctrl+clique acumula; Esc limpa a seleção inteira.
  await first.click({ modifiers: ["Control"] });
  await expect(first).toHaveClass(/ring-2/);
  await page.keyboard.press("Escape");
  await expect(first).not.toHaveClass(/ring-2/);
  await expect(second).not.toHaveClass(/ring-2/);
});

test("canvas: edição inline salva e toolbar flutuante aparece", async ({
  page,
}) => {
  await setupCanvas(page, 1);
  const card = page.locator("div[data-card-id]").first();

  // Tap abre edição inline com foco no título.
  await card.click();
  const title = page.getByLabel("Título da ideia");
  await expect(title).toBeVisible();
  await expect(title).toBeFocused();
  await title.fill("Rumo norte");
  await page.keyboard.press("Escape");
  await expect(title).toBeHidden();
  // A saída salva na hora: a face do card mostra o novo título.
  await expect(page.getByText("Rumo norte")).toBeVisible();

  // Hold seleciona → toolbar flutuante fica visível (opacity 1).
  const toolbar = page.getByRole("toolbar");
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 15);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await expect(toolbar).toHaveCSS("opacity", "1");
  await page.mouse.up();

  // "Editar" na toolbar reabre a edição inline.
  await page.getByRole("button", { name: "Editar Rumo norte" }).click();
  await expect(page.getByLabel("Título da ideia")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Título da ideia")).toBeHidden();
});

test("canvas: alça de conexão cria link e grip redimensiona", async ({
  page,
}) => {
  await setupCanvas(page, 2);
  const first = page.locator("div[data-card-id]").first();
  const second = page.locator("div[data-card-id]").nth(1);

  // Alça de conexão (borda direita-centro do 1º card): arrasta até o
  // centro do 2º e solta → a fat line de conexão aparece.
  const box = (await first.boundingBox())!;
  const target = (await second.boundingBox())!;
  await page.mouse.move(box.x + box.width, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    target.x + target.width / 2,
    target.y + target.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: /Remover conexão entre/ }),
  ).toBeVisible();

  // Grip de resize (canto inferior-direito): +120/+60 → largura 344.
  await page.mouse.move(box.x + box.width, box.y + box.height);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 120, box.y + box.height + 60, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(first).toHaveCSS("width", "344px");
});

test("canvas: node de ficha abre a ficha", async ({ page }) => {
  await createProject(page, "Fichas");
  await addCharacter(page, "Aurora");

  await page.goto("/canvas");
  await page.getByRole("button", { name: "Adicionar ficha" }).click();
  await page.getByRole("button", { name: "Aurora", exact: true }).click();

  // Node de ficha: badge de personagem + nome denormalizado.
  const fichaNode = page
    .locator("div[data-card-id]")
    .filter({ hasText: "Aurora" });
  await expect(fichaNode).toBeVisible();
  await expect(fichaNode.getByText("Personagem")).toBeVisible();

  // Tap abre a ficha (MentionSheet sem "Voltar ao texto"); Esc fecha.
  await fichaNode.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Aurora" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
