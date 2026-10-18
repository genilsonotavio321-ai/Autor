import { expect, test } from "@playwright/test";

import { addCharacter, createProject } from "./helpers";

test("a fonte e o tamanho do editor acompanham as configurações", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Fonte");
  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("Uma frase qualquer.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  const serif = await editor.evaluate((el) => getComputedStyle(el).fontFamily);
  await expect(editor).toHaveCSS("font-size", "18px");

  await page.goto("/settings");
  await page.getByRole("button", { name: "Sem serifa" }).click();
  await page.getByLabel("Tamanho da fonte — valor exato").fill("24");

  await page.goto(url);
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editorAfter = page.locator(".ProseMirror");
  await expect(editorAfter).toBeVisible();
  await expect(editorAfter).toHaveCSS("font-size", "24px");
  const sans = await editorAfter.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(sans).not.toBe(serif);
});

test("o editor tem altura estática com rolagem interna", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Altura");
  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();

  const mainBefore = await page.locator("main").evaluate((el) => el.scrollHeight);
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.type(`linha ${index}`);
    await page.keyboard.press("Enter");
  }

  // O texto excede a altura visível: quem rola é o editor, não a página.
  const overflowsInternally = await editor.evaluate(
    (el) => el.scrollHeight > el.clientHeight + 10,
  );
  expect(overflowsInternally).toBe(true);

  const mainAfter = await page.locator("main").evaluate((el) => el.scrollHeight);
  expect(mainAfter - mainBefore).toBeLessThan(120);
});

test("ferramentas do editor: Revisar, Substituir e Ler", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Ferramentas");
  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("eu vi o o gato");

  // F3: "Revisar" encontra a palavra repetida e corrige tudo.
  await page.getByRole("button", { name: "Revisar" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Revisar" })).toBeVisible();
  await expect(dialog.getByText("Palavra repetida")).toBeVisible();
  await dialog.getByRole("button", { name: "Corrigir tudo" }).click();
  await expect(editor).toHaveText("eu vi o gato");

  // F4: substituir todas as ocorrências.
  await dialog.getByLabel("Encontrar").fill("gato");
  await dialog.getByLabel("Substituir por").fill("cão");
  await expect(dialog.getByText(/1 ocorrência/)).toBeVisible();
  await dialog.getByRole("button", { name: "Substituir tudo" }).click();
  await expect(editor).toHaveText("eu vi o cão");

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // F1: "Ler" abre o modo leitura no capítulo atual (?chapter=).
  await page.getByRole("button", { name: "Ler" }).click();
  await expect(page).toHaveURL(/\/read/);
  await expect(page.getByRole("heading", { name: "Capítulo 1" })).toBeVisible();
  await expect(page.locator(".ProseMirror")).toContainText("eu vi o cão");
});

test("alinhamento do capítulo inteiro aplica a todos os parágrafos", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Alinhamento");
  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("Primeiro parágrafo.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Segundo parágrafo.");
  await expect(editor.locator("p")).toHaveCount(2);

  // F5: com "Capítulo inteiro" ligado, centralizar atinge os parágrafos.
  await page
    .getByRole("switch", { name: "Aplicar alinhamento ao capítulo inteiro" })
    .click();
  await page.getByRole("button", { name: "Centralizar" }).click();
  await expect(editor.locator('p[style*="text-align: center"]')).toHaveCount(2);
});

test("renomear um personagem atualiza o destaque nos capítulos", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Renomear");
  await addCharacter(page, "Aurora");

  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Aurora Nova chegou.");
  // Enquanto a ficha se chama "Aurora", só a primeira palavra é destacada.
  await expect(page.locator(".mention")).toHaveText("Aurora");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  await page.goto("/characters");
  await page.getByRole("button", { name: "Aurora", exact: true }).click();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Aurora Nova");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(url);
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await expect(page.locator(".ProseMirror")).toContainText("Aurora Nova chegou.");
  await expect(page.locator(".mention")).toHaveText("Aurora Nova");
});

test("renomear uma ficha reescreve o nome nos capítulos", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Reescrever");
  await addCharacter(page, "Davi");

  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("Davi chegou.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });
  await expect(editor.locator(".mention")).toHaveText("Davi");

  // Item 16: ao salvar, o nome é reescrito nos capítulos e um aviso aparece.
  await page.goto("/characters");
  await page.getByRole("button", { name: "Davi", exact: true }).click();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Davi Silva");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/1 trecho com o novo nome/)).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(url);
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await expect(page.locator(".ProseMirror")).toHaveText("Davi Silva chegou.");
  await expect(page.locator(".ProseMirror .mention")).toHaveText("Davi Silva");
});

test("substituir realça as ocorrências e mostra o contexto", async ({ page }) => {
  test.setTimeout(60_000);
  const url = await createProject(page, "Projeto Realce");
  await page.goto(url);
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page.keyboard.type("O gato viu o gato e o gato fugiu.");

  await page.getByRole("button", { name: "Revisar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Encontrar").fill("gato");
  await expect(dialog.getByText(/3 ocorrências/)).toBeVisible();

  // Item 19: realce no editor (todas + a atual) e lista com contexto.
  await expect(editor.locator("span.search-match")).toHaveCount(3);
  await expect(editor.locator("span.search-match-active")).toHaveCount(1);

  const list = dialog.getByRole("list", { name: "Ocorrências encontradas" });
  await expect(list.getByRole("button")).toHaveCount(3);
  await expect(list.getByText("gato").first()).toBeVisible();

  // Clicar numa ocorrência da lista move o realce ativo.
  await list.getByRole("button").nth(2).click();
  await expect(editor.locator("span.search-match-active")).toHaveCount(1);
});
