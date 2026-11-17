import { expect, test } from "@playwright/test";

import {
  chapterLink,
  createChapter,
  createProject,
  openChapterEditor,
  waitForToastCycle,
} from "./helpers";

test("fluxo completo: projeto → capítulo → editor com autosave", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const projectUrl = await createProject(page, "Meu Romance");
  await expect(
    page.getByRole("heading", { name: "Meu Romance" }),
  ).toBeVisible();

  // Create a chapter and open the editor.
  await createChapter(page, "Capítulo 1");
  const firstChapter = chapterLink(page, "Capítulo 1");
  await expect(firstChapter).toBeVisible();
  await openChapterEditor(page, "Capítulo 1");
  const editorUrl = page.url();

  // Type and wait for the debounced autosave to confirm.
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Era uma vez uma história.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  // Autosave survives a reload.
  await page.reload();
  await expect(page.locator(".ProseMirror")).toContainText(
    "Era uma vez uma história.",
  );

  // Abrir o app na raiz retoma este capítulo (retomada automática).
  await page.addInitScript(() => {
    window.sessionStorage.removeItem("autor-resume-done");
  });
  await page.goto("/");
  await expect(page).toHaveURL(editorUrl, { timeout: 10_000 });

  // Soft-delete the chapter and restore it via the toast action.
  await page.goto(projectUrl);
  await page
    .getByRole("button", { name: "Ações de Capítulo 1" })
    .click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await expect(chapterLink(page, "Capítulo 1")).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(chapterLink(page, "Capítulo 1")).toBeVisible();
});

test("arquivados ficam numa lista oculta na aba Projetos", async ({ page }) => {
  await createProject(page, "Projeto Guardado");

  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Arquivar projeto" }).click();
  await waitForToastCycle(page);

  // Arquivado sai da lista principal e só aparece quando revelado.
  await page.goto("/projects");
  const card = page.getByRole("link", { name: /^Projeto Guardado/ });
  await expect(card).toHaveCount(0);

  await page.getByRole("button", { name: /Mostrar arquivados/ }).click();
  await expect(card).toBeVisible();
});

test("mover projeto para a lixeira e restaurar", async ({ page }) => {
  await createProject(page, "Projeto Descartável");

  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await page.waitForURL("/projects");
  await expect(page.getByText("Projeto Descartável")).toHaveCount(0);

  await page.goto("/trash");
  await expect(page.getByText("Projeto Descartável")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia")).toBeVisible();
});
