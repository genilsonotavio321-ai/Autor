import { navGroups } from "@/components/layout/nav-items";

import type { SearchDoc } from "./search-doc";

/** Seções do app e opções de configurações incluídas na busca global (item 3). */
export const SECTION_DOCS: SearchDoc[] = [
  ...navGroups.flatMap((group) =>
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
  ),
  ...[
    ["aparencia", "Aparência tema claro escuro dark light"],
    ["editor", "Editor fonte tamanho texto"],
    ["destaques", "Destaques no texto personagens locais cores"],
    ["escrita", "Escrita meta diária sprint continuar"],
    ["som", "Som volume efeitos sonoros áudio aviso"],
    ["animacoes", "Animações easy-in easy-out fade motion"],
    ["busca", "Busca procurar global popup"],
    ["pagina-inicial", "Página inicial home primeiro acesso"],
    ["tags", "Tags etiquetas"],
    ["atalhos", "Atalhos teclas keyboard"],
    ["dados", "Dados backup exportar importar"],
  ].map(([id, keywords]): SearchDoc => ({
    id: `section:/settings#${id}`,
    type: "section",
    title: "Configurações",
    excerpt: `Opção de configurações: ${keywords}`,
    projectId: "",
    projectTitle: "",
    href: `/settings#${id}`,
    searchText: `configurações ${keywords}`,
  })),
];
