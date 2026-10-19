import { expect, test, type Locator, type Page } from "@playwright/test";

import { createProject, waitNoToasts } from "./helpers";

function noteCard(page: Page, title: string) {
  return page.locator("main ul li").filter({ hasText: title });
}

async function addNote(page: Page, title: string, content: string) {
  await page.getByRole("button", { name: "Nova nota" }).click();
  await page.getByLabel("Título").fill(title);
  await page.getByLabel("Conteúdo").fill(content);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Pointer drag of one card onto another (dnd-kit PointerSensor, distance 5). */
async function dragCardOnto(page: Page, from: Locator, toTitle: string) {
  const source = await from.boundingBox();
  const target = await page
    .locator("main ul li")
    .filter({ hasText: toTitle })
    .boundingBox();
  if (!source || !target) throw new Error("card not found for drag");
  await page.mouse.move(source.x + source.width / 2, source.y + 20);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 20, source.y + 30, {
    steps: 10,
  });
  await page.mouse.move(target.x + target.width / 2, target.y + 20, {
    steps: 15,
  });
  await page.mouse.up();
}

test("notas: visualizar, editar, ordenar e arrastar", async ({ page }) => {
  test.setTimeout(90_000);
  await createProject(page, "Projeto Notas");
  await page.goto("/notes");
  await addNote(page, "Alfa", "conteúdo alfa");
  await addNote(page, "Beta", "conteúdo beta");
  await addNote(page, "Gama", "conteúdo gama");
  await waitNoToasts(page);

  // E3: o card abre a visualização (somente leitura) em vez do editor.
  await noteCard(page, "Alfa").click();
  const view = page.getByRole("dialog");
  await expect(view.getByRole("heading", { name: "Alfa" })).toBeVisible();
  await expect(view.getByText("conteúdo alfa")).toBeVisible();

  // E3: da visualização para o editor.
  await view.getByRole("button", { name: "Editar" }).click();
  await expect(page.getByLabel("Título")).toHaveValue("Alfa");
  await page.getByLabel("Conteúdo").fill("conteúdo editado");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(noteCard(page, "Alfa")).toContainText("conteúdo editado");
  await waitNoToasts(page);

  // E5: ordenação A–Z, com o critério persistido após recarregar.
  await page.getByLabel("Ordenar notas").click();
  await page.getByRole("option", { name: /Título \(A/ }).click();
  await expect(page.locator("main ul li").first()).toContainText("Alfa");

  await page.reload();
  await expect(page.getByLabel("Ordenar notas")).toContainText(/Título \(A/);
  await expect(page.locator("main ul li").first()).toContainText("Alfa");

  // E6: arrastar reordena e a ordem manual persiste após recarregar.
  await dragCardOnto(page, noteCard(page, "Gama"), "Alfa");
  await expect(page.locator("main ul li").first()).toContainText("Gama");

  await page.reload();
  await expect(page.locator("main ul li").first()).toContainText("Gama", {
    timeout: 15_000,
  });
  await expect(page.getByLabel("Ordenar notas")).toContainText("Ordem manual");
});

test("limpar move todas as notas para a lixeira", async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, "Projeto Limpar");
  await page.goto("/notes");
  await addNote(page, "Primeira", "a");
  await addNote(page, "Segunda", "b");
  await waitNoToasts(page);

  await page.getByRole("button", { name: "Mais opções de notas" }).click();
  await page.getByRole("menuitem", { name: "Limpar" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("serão movidas para a lixeira");
  await confirm.getByRole("button", { name: "Limpar notas" }).click();

  await expect(page.getByText("Nenhuma nota ainda.")).toBeVisible();
  await expect(page.locator("main ul li")).toHaveCount(0);

  await page.goto("/trash");
  const notes = page.getByRole("region", { name: "Notas" });
  await expect(notes).toBeVisible({ timeout: 15_000 });
  await expect(notes.getByText("Primeira")).toBeVisible();
  await expect(notes.getByText("Segunda")).toBeVisible();
});

test("importa notas de um arquivo .md pelo menu", async ({ page }) => {
  await createProject(page, "Projeto Importar");
  await page.goto("/notes");
  await waitNoToasts(page);

  await page.getByRole("button", { name: "Mais opções de notas" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "Importar notas" }).click(),
  ]);
  await chooser.setFiles({
    name: "notas.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("## Alfa\n\nconteúdo alfa\n\n## Beta\n\nconteúdo beta\n"),
  });

  await expect(page.getByText("2 notas importadas")).toBeVisible();
  await expect(noteCard(page, "Alfa")).toBeVisible();
  await expect(noteCard(page, "Beta")).toBeVisible();
});
