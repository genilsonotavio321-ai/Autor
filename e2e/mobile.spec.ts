import { expect, test, type Page } from "@playwright/test";

import { createProject } from "./helpers";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

/**
 * Elements sticking out of the 390px viewport. Fixed overlays (closed sheets,
 * popper wrappers) are legitimately off-screen and do not create scrolling.
 */
async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const problems: string[] = [];
    for (const element of document.querySelectorAll<HTMLElement>("body *")) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.right <= width + 1 && rect.left >= -1) continue;
      const style = getComputedStyle(element);
      if (style.position === "fixed" || style.visibility === "hidden") continue;
      if (element.closest("[data-radix-popper-content-wrapper]")) continue;
      const classes = String(element.className).split(" ").slice(0, 3).join(".");
      problems.push(
        `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ""} left=${Math.round(rect.left)} right=${Math.round(rect.right)}`,
      );
      if (problems.length >= 5) break;
    }
    return problems;
  });
}

async function expectNoOverflow(page: Page, label: string) {
  const problems = await overflowingElements(page);
  expect(problems, `${label}: elementos fora da tela`).toEqual([]);
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    widths.scrollWidth,
    `${label}: rolagem horizontal (${widths.scrollWidth} > ${widths.innerWidth})`,
  ).toBeLessThanOrEqual(widths.innerWidth + 1);
}

test.describe("Fase 9 — celular (390×844)", () => {
  test("nenhuma tela estoura a largura do aparelho", async ({ page }) => {
    test.setTimeout(120_000);
    const projectUrl = await createProject(page, "Projeto Mobile");

    // Lista de capítulos do projeto (item 5).
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await expect(page.getByRole("link", { name: "Capítulo 1" })).toBeVisible();
    await expectNoOverflow(page, "projeto (capítulos)");

    // Card de personagem: nome e traços longos (item 2).
    await page.goto("/characters");
    await page.getByRole("button", { name: "Novo personagem" }).click();
    await page
      .getByLabel("Nome", { exact: true })
      .fill("Alexandrina de Vasconcelos Albuquerque");
    await page
      .getByLabel("Traços")
      .fill("corajosa, teimosa, leal, desconfiada, impulsiva");
    await page.getByRole("button", { name: "Salvar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expectNoOverflow(page, "personagens");

    // Projetos: grade (item 4) e lista empilhada (item 7).
    await page.goto("/projects");
    await expectNoOverflow(page, "projetos (caixas)");
    await page.getByRole("button", { name: "Exibir em lista" }).click();
    await expect(
      page.getByRole("button", { name: "Exibir em caixas" }),
    ).toBeVisible();
    await expectNoOverflow(page, "projetos (lista)");

    // Notas e mundo (item 4).
    await page.goto("/notes");
    await expectNoOverflow(page, "notas");
    await page.goto("/world");
    await expectNoOverflow(page, "mundo");

    await page.goto(projectUrl);
    await expectNoOverflow(page, "capítulos do projeto");
  });

  test("o diálogo Revisar cabe na tela do celular", async ({ page }) => {
    test.setTimeout(90_000);
    await createProject(page, "Projeto Revisar");
    await page.getByRole("button", { name: "Novo capítulo" }).click();
    await page.getByRole("link", { name: "Capítulo 1" }).click();

    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type(
      "Era uma vez uma historia muito longa que precisa ser revisada com calma e cuidado.",
    );
    await expect(page.getByTestId("save-status")).toContainText("Salvo", {
      timeout: 5_000,
    });

    await page.getByRole("button", { name: "Revisar" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoOverflow(page, "diálogo Revisar");
  });
});
