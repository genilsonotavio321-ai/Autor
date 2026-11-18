"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Heading,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  PenLine,
  Quote,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/shared/store/ui-store";

/** Valores aceitos pelo `@tiptap/extension-text-align`. */
type TextAlignValue = "left" | "center" | "right" | "justify";

const ALIGNMENT_ORDER: readonly TextAlignValue[] = [
  "left",
  "center",
  "right",
  "justify",
];

const ALIGNMENT_LABELS: Record<TextAlignValue, string> = {
  left: "esquerda",
  center: "centro",
  right: "direita",
  justify: "justificado",
};

/** Próximo alinhamento do ciclo (esquerda → centro → direita → justificado). */
export function nextAlignment(current: TextAlignValue): TextAlignValue {
  const index = ALIGNMENT_ORDER.indexOf(current);
  return ALIGNMENT_ORDER[(index + 1) % ALIGNMENT_ORDER.length] ?? "left";
}

/**
 * Sidebar secundária do editor: aparece com um slide-in quando há texto
 * selecionado e some com slide-out quando a seleção esvazia (ou com Esc).
 * Fica encostada à esquerda da sidebar principal — nunca por cima dela — e
 * assume a borda quando ela está minimizada. As duas são `fixed`.
 */
export function SelectionSidebar({ editor }: { editor: Editor }) {
  const mainCollapsed = useUiStore((state) => state.editorSidebarCollapsed);
  const [escaped, setEscaped] = useState(false);

  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      empty: current.state.selection.empty,
      from: current.state.selection.from,
      to: current.state.selection.to,
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      grifar: current.isActive("grifar"),
      heading1: current.isActive("heading", { level: 1 }),
      heading2: current.isActive("heading", { level: 2 }),
      heading3: current.isActive("heading", { level: 3 }),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      blockquote: current.isActive("blockquote"),
      textAlign:
        (current.getAttributes("paragraph").textAlign as
          | TextAlignValue
          | undefined) ??
        (current.getAttributes("heading").textAlign as
          | TextAlignValue
          | undefined) ??
        "left",
    }),
  });

  const visible = !state.empty && !escaped;

  // Uma nova seleção volta a mostrar a barra depois de um Esc.
  useEffect(() => setEscaped(false), [state.from, state.to]);

  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEscaped(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  function cycleAlignment() {
    editor
      .chain()
      .focus()
      .setTextAlign(nextAlignment(state.textAlign))
      .run();
  }

  function toggleGrifar() {
    if (editor.isActive("grifar")) {
      editor.chain().focus().unsetMark("grifar").run();
    } else {
      editor.chain().focus().setMark("grifar").run();
    }
  }

  /** Botão de formatação: preserva a seleção ao clicar (sem blur do texto). */
  function action(
    label: string,
    active: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    title = label,
  ) {
    return (
      <Button
        type="button"
        variant={active ? "secondary" : "ghost"}
        size="icon"
        className="size-8 rounded-full"
        aria-label={label}
        aria-pressed={active}
        title={title}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        {icon}
      </Button>
    );
  }

  return (
    <aside
      data-slot="editor-selection-sidebar"
      aria-label="Formatação da seleção"
      aria-hidden={!visible}
      className={cn(
        "fixed top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-0.5 rounded-full border border-border/70 bg-background/85 p-1 shadow-lg backdrop-blur-xl",
        // Tailwind v4 anima `translate` (não `transform`); a visibilidade troca
        // só no fim do slide, para a coluna deslizar de verdade ao fechar. O
        // toggle de Configurações (data-animations) desliga as animações.
        // Lado a lado com a principal em qualquer largura: abre na coluna
        // dela só quando ela está minimizada (aí o espaço fica livre).
        mainCollapsed ? "right-1 md:right-3" : "right-[4.25rem] md:right-[4.75rem]",
        visible
          ? "translate-x-0 opacity-100 [transition:translate_200ms_ease-out,opacity_200ms_linear]"
          : "pointer-events-none invisible translate-x-2 opacity-0 [transition:translate_200ms_ease-out,opacity_200ms_linear,visibility_0s_200ms]",
      )}
    >
      {action("Negrito", state.bold, () => editor.chain().focus().toggleBold().run(), <Bold aria-hidden className="size-4" />)}
      {action("Itálico", state.italic, () => editor.chain().focus().toggleItalic().run(), <Italic aria-hidden className="size-4" />)}
      {action("Grifar seleção", state.grifar, toggleGrifar, <PenLine aria-hidden className="size-4" />)}
      <span aria-hidden className="my-0.5 h-px w-5 bg-border/70" />
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            aria-label="Título"
          >
            {state.heading1 ? (
              <Heading1 aria-hidden className="size-4" />
            ) : state.heading2 ? (
              <Heading2 aria-hidden className="size-4" />
            ) : state.heading3 ? (
              <Heading3 aria-hidden className="size-4" />
            ) : (
              <Heading aria-hidden className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="left" align="center" className="w-36">
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
          >
            Título 1
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
          >
            Título 2
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
          >
            Título 3
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {action("Citação", state.blockquote, () => editor.chain().focus().toggleBlockquote().run(), <Quote aria-hidden className="size-4" />)}
      {action("Lista com marcadores", state.bulletList, () => editor.chain().focus().toggleBulletList().run(), <List aria-hidden className="size-4" />)}
      {action("Lista numerada", state.orderedList, () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered aria-hidden className="size-4" />)}
      <span aria-hidden className="my-0.5 h-px w-5 bg-border/70" />
      {action(
        "Alinhamento",
        state.textAlign !== "left",
        cycleAlignment,
        state.textAlign === "center" ? (
          <AlignCenter aria-hidden className="size-4" />
        ) : state.textAlign === "right" ? (
          <AlignRight aria-hidden className="size-4" />
        ) : state.textAlign === "justify" ? (
          <AlignJustify aria-hidden className="size-4" />
        ) : (
          <AlignLeft aria-hidden className="size-4" />
        ),
        `Alinhamento: ${ALIGNMENT_LABELS[state.textAlign]} (clique para alternar)`,
      )}
    </aside>
  );
}
