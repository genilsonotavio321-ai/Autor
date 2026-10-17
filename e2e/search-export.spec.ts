import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test("busca global encontra texto do capítulo mesmo sem acentos", async ({
  page,
}) => {
  const projectUrl = await createProject(page, "Projeto Busca");
  await page.getByRole("button", { name: "Novo capítulo" }).click();
  await page.getByRole("link", { name: "Capítulo 1" }).click();
  await page.waitForURL(/\/write\//);

  await page.locator(".ProseMirror").click();
  await page.keyboard.type("O dragão místico guardava a floresta.");
  await expect(page.getByTestId("save-status")).toContainText("Salvo", {
    timeout: 5_000,
  });

  await page.goto("/search");
  await page.getByLabel("Buscar no acervo").fill("dragao");
  const result = page.getByRole("link", { name: /Capítulo 1/ });
  await expect(result).toBeVisible();
  await expect(page.getByText(/resultado\(s\)/)).toContainText("1 resultado");

  // The result links back to the editor.
  await result.click();
  await expect(page).toHaveURL(/\/write\//);

  // Characters are searchable too.
  await page.goto(projectUrl);
  await page.goto("/characters");
  await page.getByRole("button", { name: "Novo personagem" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Ana Beatriz");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/search");
  await page.getByLabel("Buscar no acervo").fill("beatriz");
  await expect(page.getByRole("link", { name: /Ana Beatriz/ })).toBeVisible();
});

test("exporta o projeto em markdown, docx, pdf e backup", async ({ page }) => {
  await createProject(page, "Projeto Export");
  await page.getByRole("button", { name: "Novo capítulo" }).click();

  await page.goto("/export");
  await expect(
    page.getByRole("heading", { name: "Exportar" }),
  ).toBeVisible();

  const mdDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown (.md)" }).click();
  const md = await mdDownload;
  expect(md.suggestedFilename()).toMatch(/\.md$/);

  const docxDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Word (.docx)" }).click();
  expect((await docxDownload).suggestedFilename()).toMatch(/\.docx$/);

  const pdfDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "PDF (.pdf)" }).click();
  expect((await pdfDownload).suggestedFilename()).toMatch(/\.pdf$/);

  const backupDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Baixar backup completo (.json)" })
    .click();
  expect((await backupDownload).suggestedFilename()).toMatch(
    /^autor-backup-\d{4}-\d{2}-\d{2}\.json$/,
  );
});

test("importa capítulos .md e o export round-trip preserva o conteúdo", async ({
  page,
}) => {
  await createProject(page, "Projeto Import");
  await page.goto("/export");

  const markdown = [
    "# Projeto Import",
    "",
    "Metadados do projeto.",
    "",
    "# 1. Primeiro",
    "",
    "Texto do primeiro capítulo.",
    "",
    "# 2. Segundo",
    "",
    "Texto do segundo com **negrito**.",
    "",
  ].join("\n");

  const mdInput = page.getByLabel("Importar capítulos (.md)");
  await expect(mdInput).toBeEnabled();
  await mdInput.setInputFiles({
    name: "capitulos.md",
    mimeType: "text/markdown",
    buffer: Buffer.from(markdown, "utf-8"),
  });

  await expect(page.getByText("2 capítulos importados.")).toBeVisible();
  await page.waitForURL(/\/projects\//);
  await expect(page.getByRole("link", { name: "Primeiro" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Segundo" })).toBeVisible();

  // Round-trip: re-export and keep both chapters with their text.
  await page.goto("/export");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown (.md)" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const exported = readFileSync(path!, "utf-8");
  expect(exported).toContain("# 1. Primeiro");
  expect(exported).toContain("# 2. Segundo");
  expect(exported).toContain("Texto do primeiro capítulo.");
  expect(exported).toContain("**negrito**");
});
