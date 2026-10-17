import type { Page } from "@playwright/test";

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
