import { expect, type Page } from "@playwright/test";

/** Create a project through the UI and return its detail URL. */
export async function createProject(
  page: Page,
  title: string,
): Promise<string> {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Novo projeto" }).first().click();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+/);
  return page.url();
}

/**
 * After an action that CREATES a toast: wait for it to actually render, then
 * for the whole stack to expire (sonner default = 4s). The two-step wait
 * closes the race where a bare toHaveCount(0) passes before the async success
 * toast appears — leaving it alive to intercept the next click.
 */
export async function waitForToastCycle(page: Page) {
  const toasts = page.locator("[data-sonner-toast]");
  await expect(toasts.first()).toBeVisible({ timeout: 3_000 });
  await expect(toasts).toHaveCount(0, { timeout: 8_000 });
}

/** No toast on screen and none pending (safe when nothing creates one). */
export async function waitNoToasts(page: Page) {
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 8_000,
  });
}

/** Create a character through the UI and wait for the dialog to close. */
export async function addCharacter(page: Page, name: string) {
  await page.goto("/characters");
  await page.getByRole("button", { name: "Novo personagem" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/**
 * Long-press (~1,3s) num ponto vazio do board abre o botão do menu do
 * canvas e clica nele. O menu Radix fica aberto para o teste escolher
 * itens com getByRole("menuitem", ...).
 */
export async function openCanvasMenu(page: Page) {
  const board = page.locator("[data-slot='canvas-board']");
  const box = (await board.boundingBox())!;
  // Ponto vazio: canto inferior direito, longe dos cards em cascata.
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 60);
  await page.mouse.down();
  await page.waitForTimeout(1_300);
  await page.mouse.up();
  await page.getByRole("button", { name: "Menu do canvas" }).click();
}
