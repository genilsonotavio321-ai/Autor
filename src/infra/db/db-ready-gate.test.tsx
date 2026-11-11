import "fake-indexeddb/auto";

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useLiveQuery } from "dexie-react-hooks";
import { afterEach, expect, it } from "vitest";

import { projectRepository } from "@/features/projects/infra/dexie-project-repository";

import { DbReadyGate } from "./db-ready-gate";

/**
 * Reproduz o erro original: a primeira consulta do app é um `useLiveQuery`
 * (busca, lixeira, notificações). Se a migração pendente rodar dentro do
 * querier, o Dexie lança "Readwrite transaction in liveQuery context".
 * O portão precisa aplicar as migrações antes de montar os filhos.
 */
function ProjectList() {
  const projects = useLiveQuery(() => projectRepository.listActive(), []);

  if (projects === undefined) return <p>carregando lista</p>;
  if (projects.length === 0) return <p>Nenhum projeto</p>;
  return (
    <ul>
      {projects.map((project) => (
        <li key={project.id}>{project.title}</li>
      ))}
    </ul>
  );
}

afterEach(cleanup);

it("roda as migrações antes do primeiro liveQuery", async () => {
  const errors: unknown[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args);
  };

  try {
    render(
      <DbReadyGate>
        <ProjectList />
      </DbReadyGate>,
    );

    // Enquanto as migrações pendentes rodam, nenhuma consulta é montada.
    expect(screen.queryByText("carregando lista")).toBeNull();

    await waitFor(() => expect(screen.getByText("Nenhum projeto")).toBeTruthy());
    expect(errors).toEqual([]);
  } finally {
    console.error = originalError;
  }
});
