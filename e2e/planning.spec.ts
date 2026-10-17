import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test("outline: beats, cenas e reordenação por teclado", async ({ page }) => {
  await createProject(page, "Planejado");

  await page.goto("/outline");
  await expect(page.getByRole("heading", { name: "Estrutura" })).toBeVisible();

  // Beat sheet: aplicar template Três atos cria 10 beats.
  await page.getByRole("tab", { name: "Beats" }).click();
  await page.getByRole("button", { name: "Aplicar template" }).click();
  await expect(
    page.getByRole("button", { name: "1. Mundo comum", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "10. Resolução", exact: true }),
  ).toBeVisible();

  // Outline: dois capítulos + uma cena no primeiro.
  await page.getByRole("tab", { name: "Outline" }).click();
  await page
    .getByRole("button", { name: "Adicionar capítulo" })
    .click();
  await page
    .getByRole("button", { name: "Adicionar capítulo" })
    .click();
  await expect(page.getByRole("link", { name: "Capítulo 2" })).toBeVisible();
  await page
    .getByRole("button", { name: "Adicionar cena em Capítulo 1" })
    .click();
  await expect(page.getByText("Cena 1").first()).toBeVisible();

  // Corkboard mostra a carta da cena com o capítulo.
  await page.getByRole("tab", { name: "Corkboard" }).click();
  const card = page.getByRole("button", { name: "Cena 1", exact: true });
  await expect(card).toBeVisible();
  await expect(page.getByText("Capítulo 1").first()).toBeVisible();

  // Kanban: mudar status pelo diálogo da cena.
  await page.getByRole("tab", { name: "Kanban" }).click();
  await expect(
    page
      .getByRole("region", { name: "Cenas: A fazer" })
      .getByText("Cena 1", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Editar Cena 1" }).click();
  await page.getByLabel("Status da cena").click();
  await page.getByRole("option", { name: "Revisão" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page
      .getByRole("region", { name: "Cenas: Revisão" })
      .getByText("Cena 1", { exact: true }),
  ).toBeVisible();

  // Reordenação por teclado (alternativa acessível ao arrasto).
  await page.getByRole("tab", { name: "Outline" }).click();
  const handle = page.getByRole("button", { name: "Reordenar Capítulo 2" });
  await expect(handle).toBeVisible();
  await handle.focus();
  // dnd-kit's keyboard sensor activates on the keydown that follows focus.
  await page.keyboard.press("Space");
  // Wait for dnd-kit to announce the pickup (aria-describedby live region).
  await expect(handle).toHaveAttribute("aria-describedby", /DndDescribedBy/);

  // Press ArrowUp until the custom announcement confirms the drag moved over
  // Capítulo 1 (rects may still settle right after the tab remounts).
  const liveRegion = page.locator('[id^="DndLiveRegion"]').first();
  await expect(async () => {
    await page.keyboard.press("ArrowUp");
    await expect(liveRegion).toContainText("Sobre Capítulo 1", {
      timeout: 500,
    });
  }).toPass({ timeout: 8_000 });

  await page.keyboard.press("Space");
  const chapterLinks = page.locator('a[href^="/write/"]');
  await expect(chapterLinks.first()).toHaveText("Capítulo 2");
});

test("timeline e notas", async ({ page }) => {
  await createProject(page, "Cronologia");

  // Timeline: eventos são listados em ordem de data.
  await page.goto("/timeline");
  await page.getByRole("button", { name: "Novo evento" }).click();
  await page.getByLabel("Data").fill("1900");
  await page.getByLabel("Título").fill("Desfecho");
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Novo evento" }).click();
  await page.getByLabel("Data").fill("1889");
  await page.getByLabel("Título").fill("Começo");
  await page.getByRole("button", { name: "Salvar" }).click();

  const events = page.locator("ol li");
  await expect(events.first()).toContainText("Começo");
  await expect(events.first()).toContainText("1889");
  await expect(events.nth(1)).toContainText("Desfecho");

  // Notas: criar, fixar (fica primeiro) e desfazer exclusão.
  await page.goto("/notes");
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título").fill("Ideia principal");
  await page.getByLabel("Conteúdo").fill("O herói descobre a verdade.");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Ideia principal")).toBeVisible();

  await page.getByRole("button", { name: "Fixar Ideia principal" }).click();
  await expect(page.getByText("Fixada")).toBeVisible();

  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título").fill("Pesquisa");
  await page.getByRole("button", { name: "Salvar" }).click();

  const cards = page.locator("ul li").filter({ hasText: /Ideia principal|Pesquisa/ });
  await expect(cards.first()).toContainText("Ideia principal");

  await page.getByRole("button", { name: "Excluir Pesquisa" }).click();
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(
    page.getByRole("button", { name: "Pesquisa", exact: true }),
  ).toBeVisible();

  // Nota excluída aparece na lixeira e pode ser restaurada.
  await page.getByRole("button", { name: "Excluir Pesquisa" }).click();
  await page.goto("/trash");
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible();
});
