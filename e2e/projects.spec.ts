import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test("fluxo completo: projeto → capítulo → editor com autosave", async ({
  page,
}) => {
  const projectUrl = await createProject(page, "Meu Romance");
  await expect(
    page.getByRole("heading", { name: "Meu Romance" }),
  ).toBeVisible();

  // Create a chapter and open the editor.
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  const chapterLink = page.getByRole("link", { name: "Capítulo 1" });
  await expect(chapterLink).toBeVisible();
  await chapterLink.click();
  await page.waitForURL(/\/write\//);
  const editorUrl = page.url();

  // Type and wait for the debounced autosave to confirm.
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Era uma vez uma história.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  // Focus mode hides the app chrome; Escape restores it.
  await page.getByRole("button", { name: /modo foco/i }).click();
  await expect(page.locator("aside")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("aside")).toHaveCount(1);

  // Autosave survives a reload.
  await page.reload();
  await expect(page.locator(".ProseMirror")).toContainText(
    "Era uma vez uma história.",
  );

  // Dashboard resume button points back to this chapter.
  await page.goto("/");
  const resume = page.getByRole("link", { name: /Continuar escrevendo/ });
  await expect(resume).toBeVisible();
  await resume.click();
  await expect(page).toHaveURL(editorUrl);

  // Soft-delete the chapter and restore it via the toast action.
  await page.goto(projectUrl);
  await page
    .getByRole("button", { name: "Ações de Capítulo 1" })
    .click();
  await page.getByRole("menuitem", { name: "Excluir" }).click();
  await expect(page.getByRole("link", { name: "Capítulo 1" })).toHaveCount(0);
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("link", { name: "Capítulo 1" })).toBeVisible();
});

test("mover projeto para a lixeira e restaurar", async ({ page }) => {
  await createProject(page, "Projeto Descartável");

  await page.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Mover para lixeira" }).click();
  await page.waitForURL("/projects");
  await expect(page.getByText("Projeto Descartável")).toHaveCount(0);

  await page.goto("/trash");
  await expect(page.getByText("Projeto Descartável")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar" }).click();
  await expect(page.getByText("A lixeira está vazia.")).toBeVisible();
});
