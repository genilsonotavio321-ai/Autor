import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { DataSection } from "./export-page";

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    value: vi.fn(),
    configurable: true,
  });
});

afterEach(cleanup);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: () => [
    {
      id: "chapter-1",
      projectId: "project-1",
      title: "Capítulo 1",
      order: 0,
      status: "draft",
      wordCount: 0,
      content: { type: "doc", content: [] },
      createdAt: "2026-10-01T12:00:00.000Z",
      updatedAt: "2026-10-01T12:00:00.000Z",
    },
  ],
}));

vi.mock("@/features/projects/application/use-selected-project", () => ({
  useSelectedProject: () => ({
    projects: [
      {
        id: "project-1",
        title: "Projeto teste",
        status: "active",
        settings: {},
        createdAt: "2026-10-01T12:00:00.000Z",
        updatedAt: "2026-10-01T12:00:00.000Z",
      },
      {
        id: "project-2",
        title: "Outro projeto",
        status: "active",
        settings: {},
        createdAt: "2026-10-01T12:00:00.000Z",
        updatedAt: "2026-10-01T12:00:00.000Z",
      },
    ],
    projectId: "project-1",
  }),
}));

async function selectAction(label: string) {
  fireEvent.click(screen.getByRole("combobox", { name: "Ação de dados" }));
  fireEvent.click(await screen.findByRole("option", { name: label }));
}

describe("DataSection", () => {
  it("offers full-project JSON alongside Markdown, Word, and PDF", async () => {
    render(<DataSection />);
    fireEvent.click(screen.getByRole("button", { name: "Escolher formato" }));

    expect(
      await screen.findByRole("button", { name: /Markdown \(\.md\)/ }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Word \(\.docx\)/ }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /PDF \(\.pdf\)/ })).toBeVisible();
    expect(
      screen.getByRole("button", { name: /Projeto completo \(\.json\)/ }),
    ).toBeVisible();
  });

  it("keeps project actions, AI context, and full backup in one responsive card", async () => {
    render(<DataSection />);

    expect(screen.getByText("Projetos e backups")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Projeto" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Ação de dados" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Escolher formato" }),
    ).toBeVisible();
    expect(screen.queryByText("Importar .md")).not.toBeInTheDocument();
    expect(screen.queryByText("Importar .docx")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Projeto" }));
    fireEvent.click(await screen.findByRole("option", { name: "Outro projeto" }));
    expect(
      screen.getByText("Exportar projeto — Outro projeto"),
    ).toBeInTheDocument();

    await selectAction("Contexto para IA");
    expect(
      screen.getByRole("combobox", {
        name: "Capítulo incluído no contexto",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("spinbutton", { name: "Limite de tokens" }),
    ).toHaveValue(16000);
    expect(
      screen.getByRole("button", { name: "Baixar contexto" }),
    ).toBeVisible();

    await selectAction("Importar projeto completo");
    expect(screen.queryByRole("combobox", { name: "Projeto" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Selecionar pacote" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Pacote de projeto completo")).toHaveAttribute(
      "accept",
      ".json,application/json",
    );

    await selectAction("Restaurar backup do app");
    expect(screen.queryByRole("combobox", { name: "Projeto" })).toBeNull();
    expect(screen.getByText(/Substitui todos os dados do app/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Selecionar backup completo para restaurar",
      }),
    ).toBeVisible();
  });
});
