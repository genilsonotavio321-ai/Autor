import { expect, test } from "@playwright/test";

import { addCharacter, createProject } from "./helpers";

test("modo leitura: destaques, toggle e botão Editar", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Leitura");
  await addCharacter(page, "Helena");

  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Helena caminhou até o farol.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  // B2: o destaque aparece no modo leitura.
  await page.goto("/read");
  await expect(page.locator(".mention")).toHaveText("Helena");

  // B2: desligar o destaque do modo leitura remove o realce.
  await page.goto("/settings");
  const toggle = page.getByRole("switch", { name: "Destacar no modo leitura" });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();

  await page.goto("/read");
  await expect(page.locator(".ProseMirror")).toContainText("Helena");
  await expect(page.locator(".mention")).toHaveCount(0);

  // B3: o botão Editar leva ao editor do capítulo.
  await page.getByRole("button", { name: "Editar" }).click();
  await expect(page).toHaveURL(/\/write\//);
  await expect(page.getByLabel("Título do capítulo")).toHaveValue("Capítulo 1");
});

test("preferências persistem e o card Continuar expira", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Continuar");
  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Retomar daqui.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  // B7: o valor do slider persiste entre sessões.
  await page.goto("/settings");
  const resume = page.getByLabel('Botão "Continuar" — valor exato');
  await resume.fill("3");
  await page.reload();
  await expect(page.getByLabel('Botão "Continuar" — valor exato')).toHaveValue(
    "3",
  );

  // A2: o card "Continuar de onde parou" some após o tempo configurado.
  await page.goto("/");
  const section = page.getByRole("region", { name: "Continuar de onde parou" });
  await expect(section).toBeVisible({ timeout: 5_000 });
  await expect(section).toHaveCount(0, { timeout: 10_000 });
});
