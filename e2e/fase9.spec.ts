import fs from "node:fs";

import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test.describe("Fase 9 — celular e PDF", () => {
  test("renomear um capítulo preserva a última letra (autosave)", async ({
    page,
  }) => {
    const url = await createProject(page, "Projeto Nome");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();
    await expect(page.locator(".ProseMirror")).toBeVisible();

    const title = page.getByLabel("Título do capítulo");
    await title.fill("");
    await title.pressSequentially("Ato Final", { delay: 20 });
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    // O autosave gravava o título sem a última tecla; a releitura prova o fix.
    await page.reload();
    await expect(page.getByLabel("Título do capítulo")).toHaveValue("Ato Final");

    await page.goto(url);
    await expect(page.getByRole("link", { name: "Ato Final" })).toBeVisible();
  });

  test("itens arrastáveis da estrutura desativam a rolagem por toque", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await createProject(page, "Projeto Toque");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.goto("/outline");
    await page
      .getByRole("button", { name: "Adicionar cena em Capítulo 1" })
      .click();

    // Sem `touch-none` o toque virava rolagem e o clique fantasma abria o
    // diálogo de edição (com o teclado do celular).
    await expect(
      page.getByRole("button", { name: "Reordenar Capítulo 1" }),
    ).toHaveCSS("touch-action", "none");

    await page.getByRole("tab", { name: "Corkboard" }).click();
    const card = page.getByRole("button", { name: "Cena 1", exact: true });
    await expect(card).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reordenar Cena 1" }),
    ).toHaveCSS("touch-action", "none");

    // Arrastar (pega) não abre o diálogo de edição...
    const handle = page.getByRole("button", { name: "Reordenar Cena 1" });
    const box = await handle.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width / 2 + 80,
      box!.y + box!.height / 2 + 40,
      { steps: 10 },
    );
    await page.mouse.up();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // O dnd-kit mantém um bloqueador global de `click` por 50ms depois do
    // arraste (limpeza dos listeners); espera ele sair antes de tocar de novo.
    await page.waitForTimeout(150);

    // ...mas o toque simples continua abrindo a edição da cena.
    await card.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("o PDF exportado mantém negrito, itálico e alinhamento", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await createProject(page, "Projeto PDF");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Normal ");
    await page.keyboard.press("Control+b");
    await page.keyboard.type("Negrito");
    await page.keyboard.press("Control+b");
    await page.keyboard.type(" e ");
    await page.keyboard.press("Control+i");
    await page.keyboard.type("Italico");
    await page.keyboard.press("Control+i");
    await expect(editor.locator("strong")).toHaveText("Negrito");
    await expect(editor.locator("em")).toHaveText("Italico");

    // Centraliza o capítulo inteiro: o PDF precisa sair deslocado da margem.
    await page
      .getByRole("switch", { name: "Aplicar alinhamento ao capítulo inteiro" })
      .click();
    await page.getByRole("button", { name: "Centralizar" }).click();
    await expect(editor.locator('p[style*="text-align: center"]')).toHaveCount(1);
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    await page.goto("/export");
    await page.getByRole("button", { name: "Exportar projeto" }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "PDF (.pdf)" }).click();
    const file = await (await download).path();
    const pdf = fs.readFileSync(file).toString("latin1");

    // Três fontes no corpo (12pt): normal, negrito e itálico.
    const bodyFonts = new Set(
      [...pdf.matchAll(/\/(\w+) 12 Tf/g)].map((match) => match[1]),
    );
    expect(bodyFonts.size).toBeGreaterThanOrEqual(3);
    expect(pdf).toContain("(Negrito) Tj");
    expect(pdf).toContain("(Italico) Tj");

    const centered = pdf.match(/(\d+(?:\.\d+)?) [\d.]+ Td\s*\(Normal /);
    expect(centered).not.toBeNull();
    expect(Number(centered![1])).toBeGreaterThan(56);
  });
});
