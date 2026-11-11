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

    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder("Digite uma página ou ação...")).toBeVisible();
  });

  test("bottom navigation opens the Mais sheet on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await page.getByRole("button", { name: "Abrir mais opções" }).click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Notas" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Configurações" })).toBeVisible();
  });
});
