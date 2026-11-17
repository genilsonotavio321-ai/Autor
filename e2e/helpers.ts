import { expect, type Page } from "@playwright/test";

/** Create a project through the UI and return its detail URL. */
export async function createProject(
  page: Page,
  title: string,
): Promise<string> {
  await page.goto("/projects");
  await page.getByRole("button", { name: "Novo projeto" }).first().click();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]+/);
  return page.url();
}

/**
 * Link de capítulo pelo título. A lista do projeto mostra "1. Título" e a
 * árvore da Estrutura mostra só o título, então casamos pelo sufixo.
 */
export function chapterLink(page: Page, title: string) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page.getByRole("link", { name: new RegExp(`${escaped}$`) });
}

/**
 * Cria um capítulo pela UI atual (título padrão "Novo capítulo", numeração
 * pela posição) e, quando o teste precisa de um nome, renomeia no editor.
 * Devolve a página à tela de origem (projeto ou Estrutura).
 */
export async function createChapter(page: Page, title?: string) {
  const origin = page.url();

  const projectButton = page.getByRole("button", { name: "Novo capítulo" });
  const outlineButton = page.getByRole("button", { name: "Adicionar capítulo" });
  // A UI hidrata no cliente (gate do IndexedDB), então esperamos o botão da
  // tela em que estamos antes de decidir qual usar.
  // Na Estrutura, o botão de capítulo vive na aba Roteiro (a default é
  // Estrutura), então trocamos de aba antes de procurar o botão.
  if (!(await projectButton.count()) && new URL(page.url()).pathname === "/outline") {
    await page.getByRole("tab", { name: "Roteiro" }).click();
  }
  await expect(projectButton.or(outlineButton).first()).toBeVisible();

  // A aba selecionada vive em estado do cliente e se perde ao voltar do
  // editor; guardamos o rótulo (já depois da troca acima) para restaurar.
  const tabs = page.getByRole("tab", { selected: true });
  const activeTab = (await tabs.count()) ? await tabs.first().textContent() : null;
  // Na lista do projeto o capítulo abre a leitura; na Estrutura ainda é /write.
  const links = page.locator('a[href^="/write/"], a[href*="chapter="]');
  const before = await links.count();
  if (await projectButton.count()) {
    await projectButton.last().click();
  } else {
    await outlineButton.last().click();
  }

  // Sem esperar o crescimento da lista, `.last()` podia resolver para o
  // capítulo anterior e renomear o capítulo errado.
  await expect(links).toHaveCount(before + 1);
  const link = links.last();
  if (!title) return;

  await link.click();
  // A lista de capítulos abre a leitura; a Estrutura vai direto ao editor.
  await page.waitForURL(
    (url) => url.pathname === "/read" || url.pathname.startsWith("/write/"),
  );
  if (new URL(page.url()).pathname === "/read") {
    await page.getByRole("button", { name: "Editar capítulo" }).click();
    await page.waitForURL(/\/write\//);
  }
  // O autosave só agenda quando o editor Tiptap está montado.
  await expect(page.locator(".ProseMirror")).toBeVisible();
  await page.getByLabel("Título do capítulo").fill(title);
  // Debounce de 800ms do autosave.
  await page.waitForTimeout(1_400);

  // `goto` em vez de `goBack`: a leitura limpa a query com `replaceState` e
  // deixa uma entrada extra no histórico, então voltar caía em /read.
  await page.goto(origin);
  const originPath = new URL(origin).pathname;
  await page.waitForURL((url) => url.pathname === originPath);
  if (activeTab && originPath === "/outline") {
    await page.getByRole("tab", { name: activeTab.trim() }).click();
  }
  await expect(chapterLink(page, title).first()).toBeVisible();
}

/**
 * After an action that CREATES a toast: wait for it to actually render, then
 * for the whole stack to expire (sonner default = 4s). The two-step wait
 * closes the race where a bare toHaveCount(0) passes before the async success
 * toast appears — leaving it alive to intercept the next click.
 */
export async function waitForToastCycle(page: Page) {
  const toasts = page.locator("[data-sonner-toast]");
  await expect(toasts.first()).toBeVisible({ timeout: 3_000 });
  await expect(toasts).toHaveCount(0, { timeout: 8_000 });
}

/** No toast on screen and none pending (safe when nothing creates one). */
export async function waitNoToasts(page: Page) {
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 8_000,
  });
}

/**
 * Abre o bloco "Avançado" das Configurações: as preferências menos usadas
 * (seções da Home, tags, notificações) vivem recolhidas ali.
 */
export async function openAdvancedSettings(page: Page) {
  const details = page.locator("details").filter({ hasText: "Avançado" }).first();
  const isOpen = await details.evaluate(
    (element) => (element as HTMLDetailsElement).open,
  );
  if (!isOpen) await details.locator("summary").click();
  await expect(details).toHaveAttribute("open", "");
}

/**
 * Abre a home sem disputar com a retomada do último capítulo: a guarda é
 * marcada antes do primeiro script da página, então o redirecionamento
 * assíncrono não pode chegar no meio do teste.
 */
export async function gotoHome(page: Page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem("autor-resume-done", "1");
    } catch {
      // sessionStorage indisponível: o teste segue sem a guarda.
    }
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Início" })).toBeVisible();
}

/**
 * Abre a busca global pelo cartão "Localizar arquivos" da Início e devolve o
 * campo de busca do popup, pronto para receber texto.
 */
export async function openSearch(page: Page) {
  await page.getByRole("button", { name: /Localizar arquivos/ }).click();
  const input = page.getByPlaceholder("Personagens, capítulos, configurações...");
  await expect(input).toBeVisible();
  return input;
}

/**
 * Abre o editor de um capítulo a partir da lista do projeto (a lista em si
 * leva à leitura; aqui pulamos direto para a escrita).
 */
export async function openChapterEditor(page: Page, title: string) {
  await chapterLink(page, title).first().click();
  await page.waitForURL(
    (url) => url.pathname === "/read" || url.pathname.startsWith("/write/"),
  );
  if (new URL(page.url()).pathname === "/read") {
    await page.getByRole("button", { name: "Editar capítulo" }).click();
    await page.waitForURL(/\/write\//);
  }
  await expect(page.locator(".ProseMirror")).toBeVisible();
}

/** Escolhe a categoria carregada na página Mundo (uma por vez). */
export async function chooseWorldCategory(
  page: Page,
  label: "Locais" | "Lore" | "Objetos",
) {
  await page.getByRole("combobox", { name: "O que carregar" }).click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

/** Abre o menu "+" do Mundo e escolhe o que criar. */
export async function addWorldEntry(
  page: Page,
  kind: "Local" | "Entrada" | "Objeto",
) {
  await page.getByRole("button", { name: "Adicionar ao mundo" }).click();
  await page.getByRole("menuitem", { name: kind, exact: true }).click();
}

/** Create a character through the UI and wait for the dialog to close. */
export async function addCharacter(page: Page, name: string) {
  await page.goto("/characters");
  await page.getByRole("button", { name: "Novo personagem" }).click();
  await page.getByLabel("Nome", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/**
 * Long-press (~1,3s) num ponto vazio do board abre o botão do menu do
 * canvas e clica nele. O menu Radix fica aberto para o teste escolher
 * itens com getByRole("menuitem", ...).
 */
/**
 * Abre o menu do canvas pelo botão, sem tocar no fundo do board. Necessário
 * quando já existe um card selecionado (o fundo limpa a seleção).
 */
export async function openCanvasMenuButton(page: Page) {
  await page.getByRole("button", { name: "Menu do canvas" }).click();
}

export async function openCanvasMenu(page: Page) {
  const board = page.locator("[data-slot='canvas-board']");
  const box = (await board.boundingBox())!;
  // Ponto vazio: canto inferior direito, longe dos cards em cascata.
  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 60);
  await page.mouse.down();
  await page.waitForTimeout(1_300);
  await page.mouse.up();
  await page.getByRole("button", { name: "Menu do canvas" }).click();
}
