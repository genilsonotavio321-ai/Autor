import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test.describe("Grifar no modo leitura", () => {
  test("selecionar texto mostra o botão; grifar persiste após reload", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await createProject(page, "Projeto Grifar Read");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Trecho para grifar no modo leitura.");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    await page.goto("/read");
    await page.locator(".ProseMirror").selectText();

    const grifarButton = page.getByTestId("read-grifar-button");
    await expect(grifarButton).toBeVisible();
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
    const toggle = page.getByRole("switch", {
      name: "Grifar na seleção (modo leitura)",
    });
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(toggle).not.toBeChecked();
  });
});
