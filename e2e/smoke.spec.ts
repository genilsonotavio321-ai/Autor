import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("renders the app shell", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }).first(),
    ).toBeAttached();
  });

  test("toggles the sidebar from the command palette", async ({ page }) => {
    await page.goto("/");

    const aside = page.locator("aside[data-collapsed]");
    await expect(aside).toHaveAttribute("data-collapsed", "false");

    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: "Alternar barra lateral" }).click();
    await expect(aside).toHaveAttribute("data-collapsed", "true");

    await page.keyboard.press("Control+k");
    await page.getByRole("option", { name: "Alternar barra lateral" }).click();
    await expect(aside).toHaveAttribute("data-collapsed", "false");
  });

  test("opens the command palette with Ctrl+K", async ({ page }) => {
    await page.goto("/");
    // O atalho é registrado num effect: sem esperar a hidratação, a tecla cai
    // antes do listener existir.
    await expect(page.getByRole("button", { name: "Abrir busca" })).toBeVisible();

    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(
        page.getByPlaceholder("Digite uma página ou ação..."),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 10_000 });
  });

  test("bottom navigation opens the Mais sheet on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Abrir mais seções" }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Configurações" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Painel" })).toBeVisible();
    // Atalhos que saíram do menu expandido.
    await expect(sheet.getByRole("link", { name: "Notas" })).toHaveCount(0);
    await expect(sheet.getByRole("link", { name: "Mundo" })).toHaveCount(0);
    await expect(sheet.getByRole("link", { name: "Canvas" })).toHaveCount(0);
    await expect(sheet.getByRole("link", { name: "Ler" })).toHaveCount(0);
  });
});
