import { Monitor, Moon, Sun } from "lucide-react";

export const THEME_OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export const LIGHT_PALETTES = [
  {
    value: "papel",
    label: "Papel",
    description: "Papel quente com tinta marrom — o padrão.",
    bg: "#faf7f1",
    ink: "#2b241c",
  },
  {
    value: "marfim",
    label: "Marfim",
    description: "Off-white neutro, leitura limpa.",
    bg: "#fbfaf5",
    ink: "#2a2a27",
  },
  {
    value: "nevoa",
    label: "Névoa",
    description: "Cinza-azulado frio e suave.",
    bg: "#f3f6fb",
    ink: "#232a33",
  },
  {
    value: "terra",
    label: "Terra",
    description: "Areia e terracota, calor de oficina.",
    bg: "#f5ece1",
    ink: "#3a2b21",
  },
  {
    value: "oliva",
    label: "Oliva",
    description: "Verde sutil, caderno de campo.",
    bg: "#f2f3e8",
    ink: "#2f3520",
  },
  {
    value: "lavanda",
    label: "Lavanda",
    description: "Lilás discreto, ritmo noturno.",
    bg: "#f4f2fb",
    ink: "#2d2638",
  },
] as const;

export const DARK_PALETTES = [
  {
    value: "tinta",
    label: "Tinta",
    description: "Preto quente, contraste alto.",
    bg: "#1b1a17",
    ink: "#efe9dd",
  },
  {
    value: "grafite",
    label: "Grafite",
    description: "Cinza neutro de estúdio.",
    bg: "#1c1c1c",
    ink: "#f2f2f2",
  },
  {
    value: "meia-noite",
    label: "Meia-noite",
    description: "Azul profundo, pouca luz.",
    bg: "#131a26",
    ink: "#e6ecf5",
  },
  {
    value: "ameixa",
    label: "Ameixa",
    description: "Roxo profundo, vinho e tinta.",
    bg: "#211826",
    ink: "#f3e9f8",
  },
  {
    value: "oceano",
    label: "Oceano",
    description: "Azul-petróleo, calmo e frio.",
    bg: "#0f1e28",
    ink: "#e0eff5",
  },
  {
    value: "musgo",
    label: "Musgo",
    description: "Verde escuro, floresta à noite.",
    bg: "#141f18",
    ink: "#e7f2e8",
  },
] as const;

export const SHORTCUTS = [
  { keys: "Ctrl/Cmd + K", action: "Abrir a paleta de comandos e a busca" },
  { keys: "Ctrl/Cmd + B / I", action: "Negrito e itálico no editor" },
  {
    keys: "Ctrl/Cmd + clique",
    action: "Abrir a ficha de um nome destacado no texto",
  },
  { keys: "Enter / Espaço", action: "Abrir a ficha de um card em listas" },
  { keys: "Enter", action: "Salvar em diálogos" },
  {
    keys: "Espaço + Setas",
    action: "Reordenar capítulos, cenas, beats e cards (teclado)",
  },
];
