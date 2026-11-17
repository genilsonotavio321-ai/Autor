import { expect, test } from "@playwright/test";

import { createProject, waitNoToasts } from "./helpers";

test("pasta vazia aparece no Mundo antes de existir qualquer ficha", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await createProject(page, "Projeto Pasta Vazia");
  await page.goto("/world");

  await expect(page.getByText("Nenhum local ainda")).toBeVisible();

  await page.getByRole("button", { name: "Adicionar ao mundo" }).click();
  await page.getByRole("menuitem", { name: "Pasta" }).click();
  await waitNoToasts(page);

  // O card da pasta já existe sem nenhum local no projeto.
  await expect(page.getByRole("button", { name: /^Renomear Nova pasta/ })).toBeVisible();
  await expect(page.getByText("Nenhum local ainda")).toHaveCount(0);
});

test("objeto marcado como rastreável sai da pasta de lore e sobrevive à exclusão dela", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await createProject(page, "Projeto Lore Objeto");
  await page.goto("/world");

  // Pasta de lore vazia.
  await page.getByLabel("O que carregar").click();
  await page.getByRole("option", { name: "Lore" }).click();
  await page.getByRole("button", { name: "Adicionar ao mundo" }).click();
  await page.getByRole("menuitem", { name: "Pasta" }).click();
  await waitNoToasts(page);

  // Entrada de lore morando na pasta (o card é solto na pasta pelo arrasto;
  // aqui semeamos o vínculo para o teste ficar determinístico).
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("autor");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const getAll = (store: string) =>
      new Promise<Record<string, unknown>[]>((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve(request.result as Record<string, unknown>[]);
        request.onerror = () => resolve([]);
      });
    const [folder] = await getAll("folders");
    const [project] = await getAll("projects");
    if (!folder || !project) throw new Error("seed: projeto ou pasta ausente");
    const now = new Date().toISOString();
    const tx = db.transaction("loreEntries", "readwrite");
    tx.objectStore("loreEntries").put({
      id: crypto.randomUUID(),
      projectId: project.id,
      title: "Coroa Antiga",
      content: "",
      category: "História",
      tags: [],
      linkedIds: [],
      isTrackableItem: false,
      folderId: folder.id,
      order: Date.now(),
      createdAt: now,
      updatedAt: now,
    });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  await page.reload();
  await page.waitForTimeout(700);
  await page.getByLabel("O que carregar").click();
  await page.getByRole("option", { name: "Lore" }).click();

  // Abre a pasta: é onde a entrada semeada mora.
  await page.getByRole("button", { name: "Nova pasta", exact: true }).click();

  // Edita a entrada e marca como objeto rastreável.
  await page.getByRole("button", { name: "Coroa Antiga", exact: true }).click();
  await page.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Rastrear como objeto").check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await waitNoToasts(page);

  // O objeto aparece em Objetos, na raiz (não preso à pasta de lore).
  await page.getByLabel("O que carregar").click();
  await page.getByRole("option", { name: "Objetos" }).click();
  await expect(page.getByText("Coroa Antiga")).toBeVisible();

  // Apagar a pasta de lore não pode levar o objeto junto.
  await page.getByLabel("O que carregar").click();
  await page.getByRole("option", { name: "Lore" }).click();
  await page.getByRole("button", { name: /^Excluir Nova pasta/ }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Excluir" }).click();
  await waitNoToasts(page);

  await page.getByLabel("O que carregar").click();
  await page.getByRole("option", { name: "Objetos" }).click();
  await expect(page.getByText("Coroa Antiga")).toBeVisible();
});
