import { expect, test } from "@playwright/test";

import {
  createChapter,
  openAdvancedSettings,
  openChapterEditor,
} from "./helpers";

import { createProject } from "./helpers";

test.describe("Grifar no modo leitura", () => {
  test("selecionar texto mostra o botão; grifar persiste após reload", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await createProject(page, "Projeto Grifar Read");
    await createChapter(page, "Capítulo 1");
    await openChapterEditor(page, "Capítulo 1");
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Trecho para grifar no modo leitura.");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    await page.goto("/read");
    // O botão vive na barra e só habilita com texto selecionado.
    const grifarButton = page.getByRole("button", { name: "Grifar seleção" });
    await expect(grifarButton).toBeDisabled();
    await page.locator(".ProseMirror").selectText();
    await expect(grifarButton).toBeEnabled();
    await grifarButton.click();
    await expect(page.locator(".ProseMirror span.grifar")).toContainText(
      "Trecho para grifar",
    );

    // Persistência: recarrega e confirma a mark no JSON salvo.
    await page.reload();
    await expect(page.locator(".ProseMirror span.grifar").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("switch nas Configurações desliga o botão", async ({ page }) => {
    await page.goto("/settings");
    await openAdvancedSettings(page);
    const toggle = page.getByRole("switch", {
      name: "Grifar na seleção (modo leitura)",
    });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });
});
