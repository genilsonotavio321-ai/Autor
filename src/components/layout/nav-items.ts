import {
  BookOpen,
  CalendarRange,
  Download,
  Feather,
  FolderKanban,
  Globe,
  LayoutDashboard,
  ListTree,
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
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    items: [
      { title: "Painel", href: "/", icon: LayoutDashboard },
      { title: "Projetos", href: "/projects", icon: FolderKanban },
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
      { title: "Exportar", href: "/export", icon: Download },
      { title: "Lixeira", href: "/trash", icon: Trash2 },
      { title: "Configurações", href: "/settings", icon: Settings },
    ],
  },
];

export const BrandIcon = Feather;
