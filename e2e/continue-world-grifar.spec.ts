import { expect, test } from "@playwright/test";

import { createProject } from "./helpers";

test.describe("Seção Continuar na Home", () => {
  test("seção desligada por padrão e ativável nas Configurações", async ({
    page,
  }) => {
    test.setTimeout(60_000);
    const url = await createProject(page, "Projeto Continuar");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Retome aqui.");
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    // Padrão (opt-in desligado): a seção não aparece na Home.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Continuar de onde parou" }),
    ).toHaveCount(0);

    // Ativa a seção nas Configurações (e amplia o aviso para 30s).
    await page.goto("/settings");
    await page
      .getByLabel('Botão "Continuar" — valor exato')
      .fill("30");
    await page.getByRole("switch", { name: "Continuar escrevendo" }).click();

    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Continuar de onde parou" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Continuar escrevendo/ }),
    ).toBeVisible();

    // O mesmo card continua no Painel.
    await page.goto("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Continuar de onde parou" }),
    ).toBeVisible();
    void url;
  });
});

test.describe("Cascata de locais (3 níveis)", () => {
  test("cria raiz → filho → neto e bloqueia o 4º nível", async ({ page }) => {
    test.setTimeout(90_000);
    await createProject(page, "Projeto Cascata");
    await page.goto("/world");

    // Raiz.
    await page.getByRole("button", { name: "Novo local" }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Reino");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // Filho (nível 2) via "Nova subficha" da raiz.
    await page
      .getByRole("button", { name: "Nova subficha em Reino", exact: true })
      .click();
    await page.getByLabel("Nome", { exact: true }).fill("Capital");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Capital")).toBeVisible();

    // Neto (nível 3) via a linha do filho.
    await page
      .getByRole("button", { name: "Nova subficha em Capital", exact: true })
      .click();
    await page.getByLabel("Nome", { exact: true }).fill("Distrito");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Distrito")).toBeVisible();

    // Nível 3 não pode gerar filhos: o botão some.
    await expect(
      page.getByRole("button", {
        name: "Nova subficha em Distrito",
        exact: true,
      }),
    ).toHaveCount(0);

    // E o diálogo de novo local esconde candidatos de nível 3 como pai.
    await page.getByRole("button", { name: "Novo local" }).click();
    await page.getByLabel("Local pai").click();
    await expect(page.getByRole("option", { name: "Reino" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Capital" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Distrito" })).toHaveCount(0);
    // Fecha o select (Radix marca o dialog como aria-hidden enquanto aberto).
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("Grifar", () => {
  test("grifar seleciona, persiste após reload e revela grifados", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const url = await createProject(page, "Projeto Grifar");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Um trecho importante aqui.");

    // Seleciona o parágrafo e grifa pelo menu flutuante.
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await page
      .getByRole("button", { name: "Grifar", exact: true })
      .click();
    await expect(editor.locator("span.grifar")).toHaveCount(1);
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    // Persistência: recarrega e a marca continua no JSON salvo.
    await page.reload();
    const editorAfter = page.locator(".ProseMirror");
    await expect(editorAfter).toBeVisible();
    await expect(editorAfter.locator("span.grifar")).toHaveCount(1);

    // Toggle "Revelar grifados" no editor.
    await page.getByRole("button", { name: "Revelar grifados" }).click();
    await expect(page.locator(".grifar-reveal")).toHaveCount(1);
    await page.getByRole("button", { name: "Revelar grifados" }).click();
    await expect(page.locator(".grifar-reveal")).toHaveCount(0);

    // Modo leitura: marca visível + toggle de revelação.
    await page.goto("/read");
    await expect(page.locator(".tiptap span.grifar")).toHaveCount(1);
    await page.getByRole("button", { name: "Revelar grifados" }).click();
    await expect(page.locator(".grifar-reveal")).toHaveCount(1);

    void url;
  });
});
