import { expect, test } from "@playwright/test";

import { createProject } from "../helpers";

test("app funciona offline após o primeiro carregamento", async ({
  page,
  context,
}) => {
  await page.goto("/");

  // O service worker assume o controle da página (skipWaiting + clientsClaim).
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker.controller),
    undefined,
    { timeout: 60_000 },
  );
  // Recarrega para que a página seja servida pelo service worker (precache).
  await page.reload();
  await page.waitForFunction(
    () => Boolean(navigator.serviceWorker.controller),
    undefined,
    { timeout: 60_000 },
  );
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();

  // Cria dados enquanto online (persistem em IndexedDB).
  await createProject(page, "Projeto Offline");

  // Sem rede: a navegação deve continuar funcionando via cache do service worker.
  await context.setOffline(true);
  await page.goto("/projects");

  await expect(page.getByText("Projeto Offline").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projetos" })).toBeVisible();

  await context.setOffline(false);
});
