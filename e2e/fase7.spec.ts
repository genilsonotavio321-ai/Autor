import { expect, test } from "@playwright/test";
import { zipSync } from "fflate";

import { createProject } from "./helpers";

async function waitNoToasts(page: import("@playwright/test").Page) {
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10_000,
  });
}

test.describe("Fase 7 — diff, import DOCX e gráfico de atividade", () => {
  test("painel exibe o gráfico de atividade recente", async ({ page }) => {
    await createProject(page, "Atividade");
    await page.goto("/dashboard");

    await expect(page.getByText("Atividade recente")).toBeVisible();
    // Células de dia presentes (cada uma tem aria-label com data e palavras).
    await expect(
      page.locator('[role="img"][aria-label]').first(),
    ).toBeVisible();
  });

  test("diff de versões antes de restaurar", async ({ page }) => {
    await createProject(page, "Versões");
    await page.goto("/outline");
    await page.getByRole("button", { name: "Adicionar capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();

    const editor = page.locator(".ProseMirror");
    const versionRows = page.getByRole("dialog").getByRole("listitem");

    await editor.click();
    await page.keyboard.type("Primeira frase original.");
    // O autosave é silencioso (debounce de 800ms); espera para que o
    // auto-snapshot (do conteúdo anterior, vazio) já tenha disparado antes
    // do snapshot manual.
    await page.waitForTimeout(1_500);

    // Snapshot manual do estado "A" — a lista fica [A, vazio].
    await page.getByRole("button", { name: "Versões" }).click();
    await expect(page.getByText("Versões do capítulo")).toBeVisible();
    await waitNoToasts(page);
    await page.keyboard.press("Escape");
    await expect(page.getByText("Versões do capítulo")).toBeHidden();

    // Conteúdo novo que será perdido; nenhuma versão é criada dentro do
    // intervalo de 5 minutos do auto-versionamento.
    await editor.click();
    await page.keyboard.press("End");
    await page.keyboard.type(" Trecho novo que será descartado.");
    await page.waitForTimeout(1_500);

    // Reabre: cria o snapshot "B" (o mais recente). Lista = [B, A, vazio];
    // restaurar A (nth(1)) força o diff B → A. Evita-se excluir linhas:
    // um clique posicional re-resolvido após re-render apagaria a linha errada.
    await page.getByRole("button", { name: "Versões" }).click();
    await expect(page.getByText("Versões do capítulo")).toBeVisible();
    await waitNoToasts(page);
    await expect(versionRows).toHaveCount(3);
    await versionRows
      .nth(1)
      .getByRole("button", { name: "Restaurar" })
      .click();

    // A linha removida do diff (prefixo "−") destaca o que será perdido.
    await expect(
      page.getByRole("heading", { name: "Confirmar restauração" }),
    ).toBeVisible();
    await expect(
      page.getByText(/− Primeira frase original\. Trecho novo/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirmar restauração" }).click();

    await expect(page.getByText("Versões do capítulo")).toBeHidden();
    await expect(editor).toContainText("Primeira frase original.");
    await expect(editor).not.toContainText(
      "Trecho novo que será descartado",
    );
  });

  test("importar DOCX vira capítulos", async ({ page }) => {
    await createProject(page, "Importado DOCX");
    await page.goto("/export");

    // DOCX mínimo: um capítulo (título em negrito, sz 32) com uma frase.
    const documentXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
      `<w:body>` +
      `<w:p><w:pPr><w:pageBreakBefore/></w:pPr>` +
      `<w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>Capítulo Um</w:t></w:r></w:p>` +
      `<w:p><w:r><w:t>Era uma vez, num lugar muito distante.</w:t></w:r></w:p>` +
      `</w:body></w:document>`;
    const bytes = zipSync({
      "word/document.xml": new TextEncoder().encode(documentXml),
    });

    // Input começa disabled até o projeto selecionado carregar.
    const docxInput = page.getByLabel("Importar capítulos (.docx)");
    await expect(docxInput).toBeEnabled();
    await docxInput.setInputFiles({
        name: "manuscrito.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: Buffer.from(bytes),
      });

    // Toast do Sonner (o nome do projeto também contém "Importado").
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: "importado" }),
    ).toBeVisible();
    await page.waitForURL(/\/projects\/[0-9a-f-]+/);
    await expect(
      page.getByRole("link", { name: "Capítulo Um" }),
    ).toBeVisible();
  });
});
