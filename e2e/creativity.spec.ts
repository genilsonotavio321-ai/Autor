import { expect, test } from "@playwright/test";

import { createProject, openCanvasMenu, waitForToastCycle } from "./helpers";

test("criatividade: desbloqueio, canvas e construtor de cena", async ({
  page,
}) => {
  await createProject(page, "Criativo");

  // A cena precisa de um capítulo destino — cria um na Estrutura.
  await page.goto("/outline");
  await page.getByRole("button", { name: "Adicionar capítulo" }).click();

  // Desbloqueio: agora é uma opção do menu flutuante do canvas.
  await page.goto("/canvas");
  await openCanvasMenu(page);
  await page.getByRole("menuitem", { name: "Desbloqueio" }).click();
  await expect(
    page.getByRole("heading", { name: "Desbloqueio" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sortear pergunta" }).click();
  await expect(
    page.getByText("Clique em sortear para destravar a história."),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Guardar pergunta no canvas" })
    .click();
  await waitForToastCycle(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();

  // Card guardado aparece; setas movem o card focado.
  const card = page
    .locator("div[data-card-id]")
    .filter({ hasText: "Desbloqueio · Enredo" })
    .first();
  await expect(card).toBeVisible();
  const handle = page.getByRole("button", {
    name: "Ideia Desbloqueio · Enredo",
  });
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await expect(card).toHaveCSS("left", "41px");

  // Transformar em cena: hold seleciona, menu mostra as ações do card.
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 20);
  await page.mouse.down();
  await page.waitForTimeout(450);
  await page.mouse.up();
  await openCanvasMenu(page);
  await page
    .getByRole("menuitem", {
      name: "Transformar “Desbloqueio · Enredo” em cena",
    })
    .click();
  await page.getByLabel("Capítulo destino").click();
  await page.getByRole("option", { name: "Capítulo 1" }).click();
  await page.getByRole("button", { name: "Criar cena" }).click();
  await waitForToastCycle(page);
  await expect(page.getByRole("link", { name: "→ Cena" })).toBeVisible();

  // Construtor de cena: opção do menu, formulário guiado.
  await openCanvasMenu(page);
  await page.getByRole("menuitem", { name: "Construtor de cena" }).click();
  await expect(
    page.getByRole("heading", { name: "Construtor de cena" }),
  ).toBeVisible();
  await page.getByLabel("Título", { exact: true }).fill("Perseguição");
  await page.getByLabel("Objetivo").fill("Fugir do castelo");
  await page.getByLabel("Conflito").fill("Guardas fecham o portão");
  await page.getByLabel("Virada").fill("Túnel secreto");
  await page.getByLabel("Capítulo destino").click();
  await page.getByRole("option", { name: "Capítulo 1" }).click();
  await page.getByRole("button", { name: "Enviar para a Estrutura" }).click();
  await waitForToastCycle(page);

  // A cena aterrissou no capítulo certo com o resumo composto.
  await page.goto("/outline");
  await expect(page.getByText("Perseguição").first()).toBeVisible();
  await page.getByRole("tab", { name: "Corkboard" }).click();
  await expect(
    page.getByText("Objetivo: Fugir do castelo").first(),
  ).toBeVisible();
});
