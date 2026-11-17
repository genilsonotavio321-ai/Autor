import { expect, test } from "@playwright/test";

import {
  createChapter,
  createProject,
  openAdvancedSettings,
  openChapterEditor,
} from "./helpers";

test("configurações personalizam tema, editor e metas", async ({ page }) => {
  await page.goto("/settings");
  await expect(
    page.getByRole("heading", { name: "Configurações" }),
  ).toBeVisible();

  // Tema escuro aplicado no <html>.
  await page.getByRole("button", { name: "Escuro", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  // Fonte do editor.
  await page.getByRole("button", { name: "Sem serifa" }).click();
  await expect(page.getByRole("button", { name: "Sem serifa" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Tamanho da fonte (slider + input numérico com o valor exato).
  await page.getByLabel("Tamanho da fonte — valor exato").fill("20");
  await expect(page.getByLabel("Tamanho da fonte — valor exato")).toHaveValue(
    "20",
  );

  // Meta persistida no armazenamento local.
  await page.getByLabel("Meta diária — valor exato").fill("800");
  await page.reload();
  await expect(page.getByLabel("Meta diária — valor exato")).toHaveValue(
    "800",
  );

  // Lista de atalhos (recolhida no bloco Avançado).
  await openAdvancedSettings(page);
  await expect(page.getByText("Ctrl/Cmd + K")).toBeVisible();
});

test("gerencia tags e aplica em personagem", async ({ page }) => {
  await createProject(page, "Projeto Tags");
  await page.goto("/settings");
  await openAdvancedSettings(page);

  await page.getByRole("combobox", { name: "Projeto selecionado" }).click();
  await page.getByRole("option", { name: "Projeto Tags" }).click();

  await page.getByLabel("Nova tag", { exact: true }).fill("arco");
  await page.getByRole("button", { name: "Criar tag" }).click();
  await expect(page.getByLabel("Nome da tag arco")).toBeVisible();

  // Renomeia com Enter.
  await page.getByLabel("Nome da tag arco").fill("arco principal");
  await page.getByLabel("Nome da tag arco").press("Enter");
  await expect(page.getByLabel("Nome da tag arco principal")).toBeVisible();

  // Aplica a tag a um personagem.
  await page.goto("/characters");
  await page.getByRole("button", { name: "Novo personagem" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Ana Tags");
  const chip = page.getByRole("button", { name: "arco principal" });
  await expect(chip).toHaveAttribute("aria-pressed", "false");
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("arco principal")).toBeVisible();

  // Exclui a tag (com confirmação).
  await page.goto("/settings");
  await openAdvancedSettings(page);
  await page
    .getByRole("button", { name: "Excluir tag arco principal" })
    .click();
  await page.getByRole("button", { name: "Excluir", exact: true }).click();
  await expect(page.getByLabel("Nome da tag arco principal")).toHaveCount(0);
});

test("painel mostra meta diária, palavras de hoje e projetos recentes", async ({
  page,
}) => {
  await createProject(page, "Projeto Painel");
  await createChapter(page, "Capítulo 1");
  await openChapterEditor(page, "Capítulo 1");

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Uma frase curta com algumas palavras escritas hoje.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
  await expect(page.getByText("Meta diária")).toBeVisible();
  await expect(page.getByRole("link", { name: /Projeto Painel/ })).toBeVisible();
  // Sequência de 1 dia: o log de escrita registrou palavras hoje.
  await expect(page.getByText("1 dia")).toBeVisible();
});

test("modo leitura mostra o manuscrito do capítulo", async ({ page }) => {
  await createProject(page, "Projeto Leitura");
  await createChapter(page, "Capítulo 1");
  await openChapterEditor(page, "Capítulo 1");

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Texto para o modo de leitura.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  await page.goto("/read");
  await expect(page.getByRole("heading", { name: "Ler" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Capítulo 1" }),
  ).toBeVisible();
  await expect(
    page.getByText("Texto para o modo de leitura."),
  ).toBeVisible();
  // As ações do leitor vivem na barra flutuante, como ícones.
  await expect(
    page.getByRole("button", { name: "Escolher capítulo" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Editar capítulo" }),
  ).toBeVisible();
});

