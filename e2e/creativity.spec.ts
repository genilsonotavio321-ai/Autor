import { expect, test } from "@playwright/test";

import { createProject, waitForToastCycle } from "./helpers";

test("criatividade: desbloqueio, canvas e construtor de cena", async ({
  page,
}) => {
  await createProject(page, "Criativo");

  // A cena precisa de um capítulo destino — cria um na Estrutura.
  await page.goto("/outline");
  await page.getByRole("button", { name: "Adicionar capítulo" }).click();

  // Desbloqueio: sortear pergunta e guardar no canvas.
  await page.goto("/creativity");
  await expect(
    page.getByRole("heading", { name: "Canvas" }),
  ).toBeVisible();
  // /creativity redireciona para /canvas — aba Desbloqueio é o gerador.
  await page.getByRole("tab", { name: "Desbloqueio" }).click();
  await page.getByRole("button", { name: "Sortear pergunta" }).click();
  // O placeholder desaparece quando a pergunta sorteada entra na saída.
  await expect(
    page.getByText("Clique em sortear para destravar a história."),
  ).toBeHidden();
  await page
    .getByRole("button", { name: "Guardar pergunta no canvas" })
    .click();
  await waitForToastCycle(page);

  // Canvas: card guardado aparece e é arrastável por teclado.
  await page.getByRole("tab", { name: "Canvas de ideias" }).click();
  const card = page
    .locator("div[data-card-id]")
    .filter({ hasText: "Desbloqueio · Enredo" })
    .first();
  await expect(card).toBeVisible();
  // Sem grip: o card inteiro é o handle (segurar arrasta, clique abre).
  const handle = page.getByRole("button", { name: "Ideia Desbloqueio · Enredo" });
  await handle.focus();
  // Enter inicia/encerra o drag por teclado (Space fica livre para o pan).
  await page.keyboard.press("Enter");
  await expect(handle).toHaveAttribute("aria-describedby", /DndDescribedBy/);
  // O sensor anexa o listener de keydown de forma adiada: a primeira seta
  // pode se perder logo após o pickup — repete até o transform registrar.
  await expect(async () => {
    await page.keyboard.press("ArrowRight");
    await expect(card).toHaveCSS(
      "transform",
      "matrix(1, 0, 0, 1, 25, 0)",
    );
  }).toPass({ timeout: 8_000 });
  await page.keyboard.press("Enter");
  await expect(card).toHaveCSS("left", "41px");

  // Transformar em cena: escolhe o capítulo e envia para a Estrutura.
  await page
    .getByRole("button", { name: "Transformar Desbloqueio · Enredo em cena" })
    .click();
  await page.getByLabel("Capítulo destino").click();
  await page.getByRole("option", { name: "Capítulo 1" }).click();
  await page.getByRole("button", { name: "Criar cena" }).click();
  await waitForToastCycle(page);
  await expect(page.getByRole("link", { name: "→ Cena" })).toBeVisible();

  // Construtor de cena: formulário guiado com objetivo/conflito/virada.
  await page.getByRole("tab", { name: "Construtor de cena" }).click();
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
