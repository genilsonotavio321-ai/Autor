import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

/** Create a character through the UI and wait for the dialog to close. */
async function addCharacter(page: import("@playwright/test").Page, name: string) {
  await page.goto("/characters");
  await page.getByRole("button", { name: "Novo personagem" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Create a chapter from the project page and open its editor. */
async function openNewChapter(
  page: import("@playwright/test").Page,
  projectUrl: string,
) {
  await page.goto(projectUrl);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

test.describe("Fase 6 — refinamentos de UX", () => {
  test("renomear um personagem atualiza o destaque nos capítulos", async ({
    page,
  }) => {
    const url = await createProject(page, "Projeto Rename");
    await addCharacter(page, "Davi");
    await openNewChapter(page, url);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Davi Renomeado partiu.");
    // Enquanto a ficha se chama "Davi", só a primeira palavra é destacada.
    await expect(page.locator(".mention")).toHaveText("Davi");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5000,
    });

    // Renomear a ficha: o destaque nos capítulos deve acompanhar (live query).
    await page.goto("/characters");
    await page
      .getByRole("button", { name: "Davi", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Editar" }).click();
    const nameInput = page.getByLabel("Nome", { exact: true });
    await nameInput.fill("Davi Renomeado");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto(url);
    await page.getByRole("link", { name: "Capítulo 1" }).click();
    await expect(page.locator(".ProseMirror")).toContainText(
      "Davi Renomeado partiu.",
    );
    // O destaque passa a cobrir o nome novo, sem recarregar nada à mão.
    await expect(page.locator(".mention")).toHaveText("Davi Renomeado");
  });

  test("o status do capítulo tem um só seletor, colorido por estado", async ({
    page,
  }) => {
    await createProject(page, "Projeto Status");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await expect(page.getByRole("link", { name: "Capítulo 1" })).toBeVisible();

    const row = page.getByRole("listitem").filter({ hasText: "Capítulo 1" });
    // Um único controle de status na linha (sem duplicação).
    await expect(row.getByRole("combobox")).toHaveCount(1);

    const status = page.getByLabel("Status de Capítulo 1");
    await expect(status).toHaveText("A fazer");

    await status.click();
    await page.getByRole("option", { name: "Revisão" }).click();
    await expect(status).toHaveText("Revisão");
    await expect(status).toHaveClass(/sky/);

    await page.reload();
    await expect(page.getByLabel("Status de Capítulo 1")).toHaveText("Revisão");
  });

  test("capítulos podem ser reordenados arrastando (teclado)", async ({
    page,
  }) => {
    await createProject(page, "Projeto Ordem");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await expect(page.getByRole("link", { name: "Capítulo 2" })).toBeVisible();

    const handle = page.getByRole("button", { name: "Reordenar Capítulo 2" });
    await handle.focus();
    await page.keyboard.press("Space");
    // dnd-kit announces the pickup via aria-describedby once the drag starts.
    await expect(handle).toHaveAttribute("aria-describedby", /DndDescribedBy/);

    const liveRegion = page.locator('[id^="DndLiveRegion"]').first();
    await expect(async () => {
      await page.keyboard.press("ArrowUp");
      await expect(liveRegion).toContainText("Sobre Capítulo 1", {
        timeout: 500,
      });
    }).toPass({ timeout: 8_000 });
    await page.keyboard.press("Space");

    const titles = page.locator('a[href^="/write/"]');
    await expect(titles.first()).toHaveText("1. Capítulo 2");
    await expect(titles.nth(1)).toHaveText("2. Capítulo 1");

    await page.reload();
    await expect(
      page.locator('a[href^="/write/"]').first(),
    ).toHaveText("1. Capítulo 2");
  });

  test("a lista de projetos ordena e alterna entre caixas e lista", async ({
    page,
  }) => {
    await createProject(page, "Beta Livro");
    await createProject(page, "Alfa Livro");
    await page.goto("/projects");

    await page.getByLabel("Ordenar projetos").click();
    await page.getByRole("option", { name: /Ordem alfabética/ }).click();

    const links = page.locator('a[href^="/projects/"]');
    await expect(links.first()).toContainText("Alfa Livro");

    await page.getByRole("button", { name: "Exibir em lista" }).click();
    await expect(
      page.getByRole("button", { name: "Exibir em lista" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.reload();
    await expect(
      page.getByRole("button", { name: "Exibir em lista" }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.locator('a[href^="/projects/"]').first(),
    ).toContainText("Alfa Livro");
  });

  test("o painel separa as estatísticas por projeto", async ({ page }) => {
    const url = await createProject(page, "Projeto Tabela");
    await openNewChapter(page, url);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("duas palavras");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5000,
    });

    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Estatísticas por projeto" }),
    ).toBeVisible();
    const row = page.getByRole("row").filter({ hasText: "Projeto Tabela" });
    await expect(row).toBeVisible();
    await expect(row).toContainText("2");
  });

  test("nomes de personagens são destacados e clicáveis no editor", async ({
    page,
  }) => {
    const url = await createProject(page, "Projeto Menções");
    await addCharacter(page, "Aurora");

    await openNewChapter(page, url);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Aurora chegou.");

    const mention = page.locator(".mention");
    await expect(mention).toHaveText("Aurora");
    await expect(mention).toHaveCSS("color", "rgb(124, 58, 237)");

    // Ctrl+clique abre a ficha sobre o editor, sem sair da escrita.
    await mention.click({ modifiers: ["Control"] });
    await expect(page).toHaveURL(/\/write\//);
    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("heading", { name: "Aurora" }),
    ).toBeVisible();

    // O pop-up "Voltar ao texto" fecha a ficha e mantém o editor aberto.
    await page.getByRole("button", { name: "Voltar ao texto" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/write\//);
  });

  test("o destaque pode ser desligado nas configurações", async ({ page }) => {
    const url = await createProject(page, "Projeto Sem Destaque");
    await addCharacter(page, "Bento");
    await openNewChapter(page, url);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Bento partiu.");
    await expect(page.locator(".mention")).toHaveText("Bento");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5000,
    });

    await page.goto("/settings");
    const toggle = page.getByRole("switch", { name: "Ativar destaques" });
    await toggle.click();
    await expect(toggle).not.toBeChecked();

    await page.goto(url);
    await page.getByRole("link", { name: "Capítulo 1" }).click();
    await expect(page.locator(".ProseMirror")).toContainText("Bento");
    await expect(page.locator(".mention")).toHaveCount(0);
  });

  test("no modo leitura um clique simples abre a ficha", async ({ page }) => {
    const url = await createProject(page, "Projeto Leitura Menção");
    await addCharacter(page, "Cecília");
    await openNewChapter(page, url);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Cecília voltou.");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5000,
    });

    await page.goto("/read");
    const mention = page.locator(".mention");
    await expect(mention).toHaveText("Cecília");
    await mention.click();
    await expect(page).toHaveURL(/\/characters/);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(
      "Cecília",
    );
  });
});
