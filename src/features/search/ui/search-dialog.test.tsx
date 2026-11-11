import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUiStore } from "@/shared/store/ui-store";

import type { SearchDoc } from "../domain/search-doc";
import { SearchDialog } from "./search-dialog";

const { push, docs } = vi.hoisted(() => ({
  push: vi.fn(),
  docs: [
    {
      id: "c1",
      type: "chapter",
      title: "floresta",
      excerpt: "",
      projectId: "p1",
      projectTitle: "Projeto",
      href: "/read?chapter=c1",
      searchText: "floresta capitulo",
    },
    {
      id: "n1",
      type: "note",
      title: "Outra nota",
      excerpt: "",
      projectId: "",
      projectTitle: "",
      href: "/notes?note=n1",
      searchText: "floresta nota",
    },
  ] as SearchDoc[],
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock("../application/use-search-docs", () => ({
  useSearchDocs: () => docs,
}));

// cmdk observa o tamanho da lista com ResizeObserver (ausente no jsdom).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("SearchDialog", () => {
  beforeEach(() => {
    push.mockClear();
    Element.prototype.scrollIntoView = vi.fn();
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
    useUiStore.setState({ searchOpen: true });
  });

  it("Enter sem navegar seleciona o primeiro resultado", () => {
    render(<SearchDialog />);

    const input = screen.getByPlaceholderText(
      "Personagens, capítulos, configurações...",
    );
    fireEvent.change(input, { target: { value: "floresta" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(push).toHaveBeenCalledWith("/read?chapter=c1");
    expect(useUiStore.getState().searchOpen).toBe(false);
  });
});
