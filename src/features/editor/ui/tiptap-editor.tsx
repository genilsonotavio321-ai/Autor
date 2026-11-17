"use client";

import type { Content } from "@tiptap/core";
import CharacterCount from "@tiptap/extension-character-count";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextSelection } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { GrifarMark } from "@/features/editor/domain/grifar-mark";
import { readImageAsDataUrl } from "@/features/editor/domain/image-file";
import { ReviewDialog } from "@/features/editor/ui/review-dialog";
import { SearchHighlight } from "@/features/editor/ui/search-highlight";
import { SelectionSidebar } from "@/features/editor/ui/selection-sidebar";
import {
  EntityHighlight,
  mentionHighlightKey,
  type MentionHighlightSettings,
} from "@/features/mentions/ui/entity-highlight";
import type { MentionEntity, MentionType } from "@/features/mentions/domain/entity-index";
import {
  isTouchDevice,
  type MentionClickSource,
} from "@/features/mentions/domain/mention-click";
import { useUiStore } from "@/shared/store/ui-store";
import type { Json } from "@/shared/types/database";

/** Estado do editor que a sidebar do capítulo precisa para undo/redo. */
export interface EditorSnapshot {
  canUndo: boolean;
  canRedo: boolean;
}

interface TiptapEditorProps {
  content: Json;
  placeholder?: string;
  /** Character/location names to highlight inline. */
  mentions?: MentionEntity[];
  /** Called when a highlight is opened (Ctrl/Cmd+click or touch tap). */
  onOpenMention?: (
    type: MentionType,
    id: string,
    source: MentionClickSource,
  ) => void;
  /** Called once when the editor instance is ready (restore cursor, etc). */
  onReady?: (editor: Editor) => void;
  /** Called on every document change. */
  onUpdate?: (editor: Editor) => void;
  /** Undo/redo availability, consumed by the floating sidebar. */
  onEditorState?: (state: EditorSnapshot) => void;
  /** Destaque ampliado dos trechos grifados (item da sidebar). */
  revealGrifar?: boolean;
  /** Diálogo de revisão, controlado pela página. */
  reviewOpen: boolean;
  onReviewOpenChange: (open: boolean) => void;
}

/** Arquivos de imagem de um DataTransfer (ignora todo o resto). */
export function imageFilesOf(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []).filter((file) =>
    file.type.startsWith("image/"),
  );
}

/**
 * Insere cada arquivo no ponto da seleção atual como node `image` (bloco).
 * A leitura/compactação é assíncrona, mas o dispatch monta a transação a
 * partir do estado vivo do editor, então inserções sequenciais funcionam.
 */
export async function insertImageFiles(
  view: EditorView,
  files: File[],
): Promise<void> {
  for (const file of files) {
    try {
      const src = await readImageAsDataUrl(file);
      const imageType = view.state.schema.nodes.image;
      if (!imageType) return;
      view.dispatch(
        view.state.tr.replaceSelectionWith(imageType.create({ src })),
      );
    } catch {
      toast.error("Não foi possível inserir a imagem", {
        description: "Use um arquivo de imagem menor (limite ~2MB).",
      });
    }
  }
  view.focus();
}

export function TiptapEditor({
  content,
  placeholder = "Comece a escrever…",
  mentions = [],
  onOpenMention,
  onReady,
  onUpdate,
  onEditorState,
  revealGrifar = false,
  reviewOpen,
  onReviewOpenChange,
}: TiptapEditorProps) {
  const mentionHighlightEnabled = useUiStore(
    (state) => state.mentionHighlightEnabled,
  );
  const mentionColorCharacter = useUiStore(
    (state) => state.mentionColorCharacter,
  );
  const mentionColorLocation = useUiStore(
    (state) => state.mentionColorLocation,
  );
  // Latest settings, read lazily by the extension (updated every render).
  const mentionSettingsRef = useRef<MentionHighlightSettings>({
    enabled: false,
    entities: [],
    colorFor: () => "inherit",
    onOpen: () => undefined,
    title: "",
  });
  mentionSettingsRef.current = {
    enabled: mentionHighlightEnabled,
    entities: mentions,
    colorFor: (type) =>
      type === "character" ? mentionColorCharacter : mentionColorLocation,
    onOpen: (type, id, source) => onOpenMention?.(type, id, source),
    // Item 15: em dispositivos de toque o clique simples abre (com aviso).
    title: isTouchDevice()
      ? "Toque para abrir a ficha"
      : "Ctrl+clique para abrir a ficha",
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Placeholder.configure({ placeholder }),
      CharacterCount,
      // allowBase64: o conteúdo persiste como dataURL no JSON do capítulo —
      // sem isso o parser descarta a imagem ao recarregar.
      Image.configure({
        allowBase64: true,
        inline: false,
        HTMLAttributes: { class: "max-w-full rounded-lg" },
      }),
      EntityHighlight.configure({
        getSettings: () => mentionSettingsRef.current,
      }),
      SearchHighlight,
      GrifarMark,
    ],
    content: content as Content,
    editorProps: {
      // Colar/arrastar arquivos de imagem insere no texto; texto colado
      // segue o fluxo padrão (retorna false quando não há imagem).
      handlePaste: (view, event) => {
        const files = imageFilesOf(event.clipboardData?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        void insertImageFiles(view, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFilesOf(event.dataTransfer?.files);
        if (files.length === 0) return false;
        event.preventDefault();
        // A seleção vira o ponto do drop antes da leitura assíncrona.
        const coords = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });
        if (coords) {
          view.dispatch(
            view.state.tr.setSelection(
              TextSelection.near(view.state.doc.resolve(coords.pos)),
            ),
          );
        }
        void insertImageFiles(view, files);
        return true;
      },
      attributes: {
        // Sem font-family/tamanho aqui: o wrapper em editor-page.tsx injeta
        // fontSize/fontFamily do store via estilo inline no container, e
        // classes utilitárias neste elemento sobrescreveriam o valor herdado.
        // Altura estática com scroll interno: o contenteditable não cresce a
        // página — o scroll acontece dentro dele. Por isso o autosave guarda
        // editor.view.dom.scrollTop (e não window.scrollY) para "Continuar
        // escrevendo" (ver scheduleSave em editor-page.tsx).
        class:
          "h-[calc(100dvh-13rem)] min-h-72 overflow-y-auto px-1 py-4 leading-relaxed outline-none",
      },
    },
    onUpdate: ({ editor: current }) => onUpdate?.(current),
  });

  useEffect(() => {
    if (editor) onReady?.(editor);
    // onReady is expected to be stable (useCallback) — runs once per instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // Recompute highlights when the index or its styling changes.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(mentionHighlightKey, { refresh: true }),
    );
  }, [
    editor,
    mentions,
    mentionHighlightEnabled,
    mentionColorCharacter,
    mentionColorLocation,
  ]);

  // Só undo/redo continuam aqui; a formatação vive na SelectionSidebar.
  const editorState = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? { canUndo: current.can().undo(), canRedo: current.can().redo() }
        : null,
  });

  useEffect(() => {
    if (editorState) onEditorState?.(editorState);
  }, [editorState, onEditorState]);

  if (!editor) return null;

  return (
    <div className={revealGrifar ? "grifar-reveal" : undefined}>
      <EditorContent editor={editor} className="tiptap px-1" />
      <SelectionSidebar editor={editor} />
      <ReviewDialog
        editor={editor}
        open={reviewOpen}
        onOpenChange={onReviewOpenChange}
      />
    </div>
  );
}
