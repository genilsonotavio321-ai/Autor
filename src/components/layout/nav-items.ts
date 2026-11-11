import {
  BookOpen,
  CalendarRange,
  Feather,
  FolderKanban,
  Frame,
  Globe,
  Home,
  LayoutDashboard,
  ListTree,
  PenLine,
  Settings,
  StickyNote,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Item mostrado só quando "Mostrar Painel" está ativo nas Configurações. */
  optional?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [{ title: "Início", href: "/", icon: Home }],
  },
  {
    label: "Produção",
    items: [
      { title: "Painel", href: "/dashboard", icon: LayoutDashboard, optional: true },
      { title: "Projetos", href: "/projects", icon: FolderKanban },
      { title: "Canvas", href: "/canvas", icon: Frame },
      { title: "Estrutura", href: "/outline", icon: ListTree },
      { title: "Ler", href: "/read", icon: BookOpen },
    ],
  },
  {
    label: "Planejamento",
    items: [
      { title: "Personagens", href: "/characters", icon: Users },
      { title: "Mundo", href: "/world", icon: Globe },
      { title: "Linha do tempo", href: "/timeline", icon: CalendarRange },
      { title: "Notas", href: "/notes", icon: StickyNote },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Lixeira", href: "/trash", icon: Trash2 },
      { title: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

/** Abas fixas da barra inferior (mobile). O resto vive no sheet "Mais". */
export const mobileTabs: NavItem[] = [
  { title: "Escrever", href: "/projects", icon: PenLine },
  { title: "Estrutura", href: "/outline", icon: ListTree },
  { title: "Fichas", href: "/characters", icon: Users },
];

export const BrandIcon = Feather;
