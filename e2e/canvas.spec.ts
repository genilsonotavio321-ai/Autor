import { expect, test, type Page } from "@playwright/test";

import {
  addCharacter,
  createProject,
  openCanvasMenu,
  openCanvasMenuButton,
} from "./helpers";

/** Cria um projeto e entra no canvas com `count` cards (edição inline fechada). */
async function setupCanvas(page: Page, count: number) {
  await createProject(page, "Gestos");
  await page.goto("/canvas");
  for (let i = 0; i < count; i++) {
    await openCanvasMenu(page);
    await page.getByRole("menuitem", { name: "Nova ideia" }).click();
    const editor = page.locator("div[data-card-id] .ProseMirror").first();
    // createCard é assíncrono (Dexie): espera abrir antes de fechar.
    await expect(editor).toBeVisible();
    // Clicar no fundo do board fecha a edição (flushEdit no pointerdown).
    const board = page.locator("[data-slot='canvas-board']");
    const boardBox = (await board.boundingBox())!;
    await page.mouse.click(
      boardBox.x + boardBox.width - 60,
      boardBox.y + boardBox.height - 60,
    );
    await expect(editor).toHaveCount(0);
  }
}

test("canvas: página inteira com menu por toque longo", async ({ page }) => {
  await createProject(page, "Tela cheia");
  await page.goto("/canvas");

  // O chrome da página sumiu: sem título, sem abas.
  await expect(page.getByRole("heading", { name: "Canvas" })).toHaveCount(0);
  await expect(page.getByRole("tablist")).toHaveCount(0);
  const board = page.locator("[data-slot='canvas-board']");
  const box = (await board.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.height).toBeGreaterThan(viewport.height - 120);

  // Toque longo num espaço vazio abre o botão flutuante do menu.
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 60);
  await page.mouse.down();
  await page.waitForTimeout(1_300);
  await page.mouse.up();
  const fab = page.getByRole("button", { name: "Menu do canvas" });
  await expect(fab).toBeVisible();
  await fab.click();
  await expect(
    page.getByRole("menuitem", { name: "Nova ideia" }),
  ).toBeVisible();
  // Esc fecha o menu; o botão flutuante vai junto.
  await page.keyboard.press("Escape");
  await expect(fab).toHaveCount(0);
});

test("canvas: gestos de mouse — arraste, hold e seleção múltipla", async ({
  page,
}) => {
  await setupCanvas(page, 2);
  const first = page.locator("div[data-card-id]").first();
  const second = page.locator("div[data-card-id]").nth(1);

  // 1º toque seleciona; arrastar um card selecionado move o node 250/40 px
  // (zoom 1: px de tela = px de conteúdo).
  await first.click({ position: { x: 30, y: 20 } });
  await expect(first.locator(":scope > div").first()).toHaveClass(/ring-2/);
  const box = (await first.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 280, box.y + 60, { steps: 8 });
  await page.mouse.up();
  await expect(first).toHaveCSS("left", "266px");
  await expect(first).toHaveCSS("top", "56px");

  // Tap troca a seleção; Ctrl+clique acumula; Esc limpa tudo.
  await second.click({ position: { x: 30, y: 20 } });
  await expect(second.locator(":scope > div").first()).toHaveClass(/ring-2/);
  await first.click({ modifiers: ["Control"], position: { x: 30, y: 20 } });
  await expect(first.locator(":scope > div").first()).toHaveClass(/ring-2/);
  await page.keyboard.press("Escape");
  await expect(first.locator(":scope > div").first()).not.toHaveClass(/ring-2/);
  await expect(second.locator(":scope > div").first()).not.toHaveClass(/ring-2/);
});

test("canvas: edição inline salva ao clicar fora e pelo menu", async ({
  page,
}) => {
  await setupCanvas(page, 1);
  const card = page.locator("div[data-card-id]").first();

  // 1º toque seleciona, 2º abre a edição já com o cursor no texto.
  await card.click();
  await card.click();
  const editor = card.locator(".ProseMirror");
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Rumo norte");

  // Clicar fora do node salva e fecha a edição.
  const board = (await page
    .locator("[data-slot='canvas-board']")
    .boundingBox())!;
  await page.mouse.click(
    board.x + board.width - 60,
    board.y + board.height - 60,
  );
  await expect(editor).toHaveCount(0);
  await expect(page.getByText("Rumo norte")).toBeVisible();

  // O card selecionado oferece as ações no menu flutuante.
  await card.click({ position: { x: 30, y: 20 } });
  await expect(card.locator(":scope > div").first()).toHaveClass(/ring-2/);
  await openCanvasMenuButton(page);
  await page.getByRole("menuitem", { name: "Editar" }).click();
  await expect(card.locator(".ProseMirror")).toBeVisible();
  await page.keyboard.press("Escape");
});

test("canvas: alça de conexão cria link e grip redimensiona", async ({
  page,
}) => {
  await setupCanvas(page, 2);
  const first = page.locator("div[data-card-id]").first();
  const second = page.locator("div[data-card-id]").nth(1);

  // Alça na borda direita: arrastar até o 2º card cria a conexão.
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

  // Grip no canto: redimensiona ao vivo e persiste o tamanho.
  const grip = (await first.boundingBox())!;
  await page.mouse.move(grip.x + grip.width, grip.y + grip.height);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width + 120, grip.y + grip.height + 60, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(first).toHaveCSS("width", "344px");
});

test("canvas: node de ficha abre a ficha", async ({ page }) => {
  await createProject(page, "Fichas");
  await addCharacter(page, "Aurora");
  await page.goto("/canvas");

  await openCanvasMenu(page);
  await page.getByRole("menuitem", { name: "Adicionar ficha" }).click();
  await page.getByRole("button", { name: "Aurora", exact: true }).click();

  const fichaNode = page
    .locator("div[data-card-id]")
    .filter({ hasText: "Aurora" });
  await expect(fichaNode).toBeVisible();
  await expect(fichaNode.getByText("Personagem")).toBeVisible();

  // 1º toque seleciona, 2º abre a ficha (MentionSheet, sem "Voltar ao texto").
  await fichaNode.click();
  await fichaNode.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aurora" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("canvas: quadro criado salva o canvas automaticamente", async ({
  page,
}) => {
  await setupCanvas(page, 1);

  // Cria o quadro: ele vira o "arquivo" ativo do canvas.
  await openCanvasMenu(page);
  await page.getByRole("menuitem", { name: "Criar quadro" }).click();
  await page.getByLabel("Nome do quadro").fill("Enredo A");
  await page.getByRole("button", { name: "Criar quadro" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  // Move o card selecionado: o quadro ativo acompanha automaticamente.
  const card = page.locator("div[data-card-id]").first();
  await card.click({ position: { x: 30, y: 20 } });
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 60, { steps: 8 });
  await page.mouse.up();
  // Deixa o autosave (debounce 800ms) gravar antes de recarregar.
  await page.waitForTimeout(1_200);

  // Recarrega e carrega o quadro: a posição movida persistiu no "arquivo".
  await page.reload();
  await openCanvasMenu(page);
  await page.getByRole("menuitem", { name: "Quadros" }).click();
  await page.getByRole("button", { name: "Carregar quadro Enredo A" }).click();
  await page.getByRole("button", { name: "Carregar", exact: true }).click();
  await expect(page.locator("div[data-card-id]").first()).toHaveCSS(
    "left",
    "116px",
  );
});
