import { expect, test, type Page } from "@playwright/test";

import { addCharacter, createProject, waitForToastCycle } from "./helpers";

async function deleteCharacter(page: Page, name: string) {
  await page.goto("/characters");
  await page.getByRole("button", { name: `Excluir ${name}` }).click();
  await waitForToastCycle(page);
}

test("excluir um item definitivamente esvazia a lixeira", async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, "Projeto Purga");
  await addCharacter(page, "Vilão");
  await deleteCharacter(page, "Vilão");

  await page.goto("/trash");
  const characters = page.getByRole("region", { name: "Personagens" });
  await expect(characters).toBeVisible({ timeout: 15_000 });
  await characters
    .getByRole("button", { name: "Excluir definitivamente Vilão" })
    .click();

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Isso não pode ser desfeito.");
  await confirm.getByRole("button", { name: "Excluir", exact: true }).click();

  await expect(page.getByText("A lixeira está vazia.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByRole("button", { name: "Esvaziar lixeira" }),
  ).toHaveCount(0);
});

test("esvaziar a lixeira apaga tudo de uma vez", async ({ page }) => {
  test.setTimeout(60_000);
  await createProject(page, "Projeto Varredura");
  await addCharacter(page, "Espectro");
  await addCharacter(page, "Sombra");
  await deleteCharacter(page, "Espectro");
  await deleteCharacter(page, "Sombra");

  await page.goto("/trash");
  await expect(page.getByRole("region", { name: "Personagens" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole("button", { name: "Esvaziar lixeira" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("Todos os itens serão apagados");
  await confirm.getByRole("button", { name: "Esvaziar", exact: true }).click();

  await expect(page.getByText("A lixeira está vazia.")).toBeVisible({
    timeout: 15_000,
  });
});
