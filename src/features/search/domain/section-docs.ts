import { navGroups } from "@/components/layout/nav-items";

import type { SearchDoc } from "./search-doc";

/** Seções do app incluídas na busca global (item 3), uma por href. */
const navSectionDocs: SearchDoc[] = navGroups.flatMap((group) =>
  group.items.map((item): SearchDoc => ({
    id: `section:${item.href}`,
    type: "section",
    title: item.title,
    excerpt: `Seção do app: ${item.title}`,
    projectId: "",
    projectTitle: "",
    href: item.href,
    searchText: `${group.label ?? ""} ${item.title} ${item.href}`,
  })),
);

// Palavras-chave das opções de configurações, anexadas ao doc único de
// Configurações para não poluir os resultados com entradas repetidas.
const settingsKeywords =
  "Aparência tema claro escuro dark light Editor fonte tamanho texto " +
  "Destaques no texto personagens locais cores Escrita meta diária sprint " +
  "continuar Som volume efeitos sonoros áudio aviso Animações easy-in " +
  "easy-out fade motion Busca procurar global popup Página inicial home " +
  "primeiro acesso Tags etiquetas Atalhos teclas keyboard Dados backup " +
  "exportar importar";

export const SECTION_DOCS: SearchDoc[] = navSectionDocs.map((doc) =>
  doc.href === "/settings"
    ? { ...doc, searchText: `${doc.searchText} ${settingsKeywords}` }
    : doc,
);
