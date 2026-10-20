import { expect, test } from "@playwright/test";

test.describe("smoke", () => {
  test("renders the app shell", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Navegação principal" }).first(),
    ).toBeAttached();
  });

  test("toggles the sidebar with the topbar button", async ({ page }) => {
    await page.goto("/");

    const toggle = page.getByRole("button", {
      name: "Alternar menu de navegação",
    });
    const aside = page.locator("aside[data-collapsed]");

    await expect(aside).toHaveAttribute("data-collapsed", "false");
    await toggle.click();
    await expect(aside).toHaveAttribute("data-collapsed", "true");
    await toggle.click();
    await expect(aside).toHaveAttribute("data-collapsed", "false");
  });

  test("opens the command palette with Ctrl+K", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder("Digite uma página ou ação...")).toBeVisible();
  });
});
