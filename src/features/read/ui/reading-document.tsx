"use client";

import type { Content } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef } from "react";

import { bookmarkExcerpt } from "@/features/bookmarks/domain/bookmark-excerpt";
import { GrifarMark } from "@/features/editor/domain/grifar-mark";

import type {
  MentionEntity,
  MentionType,
} from "@/features/mentions/domain/entity-index";
import {
  EntityHighlight,
  mentionHighlightKey,
  type MentionHighlightSettings,
} from "@/features/mentions/ui/entity-highlight";
import { useUiStore } from "@/shared/store/ui-store";
import type { Json } from "@/shared/types/database";

interface ReadingDocumentProps {
  content: Json;
  /** Character/location names to highlight inline. */
  mentions?: MentionEntity[];
  /** Called when a highlight is clicked (plain click in read mode). */
  onOpenMention?: (type: MentionType, id: string) => void;
  /** Called after the user grifou a selection (doc JSON ready to persist). */
  onGrifarChange?: (json: Json) => void;
  /** Avisa a página se há texto selecionado (habilita o botão da barra). */
  onSelectionChange?: (hasSelection: boolean) => void;
  /** Incrementa quando a página pede para grifar a seleção atual. */
  grifarRequest?: number;
  /** Incrementa quando a página pede um marcador no ponto atual. */
  bookmarkAddRequest?: number;
  /** Recebe posição + trecho do marcador a ser criado. */
  onBookmarkAt?: (position: number, excerpt: string) => void;
  /** Informa o tamanho do documento (posição relativa dos marcadores). */
  onDocSize?: (size: number) => void;
  /** Marcador para onde rolar (nonce força repetir a mesma posição). */
  jumpToBookmark?: { position: number; nonce: number } | null;
}

/** Renders Tiptap document JSON as read-only typographic prose (plan §7.6). */
export function ReadingDocument({
  content,
  mentions = [],
  onOpenMention,
  onGrifarChange,
  onSelectionChange,
  grifarRequest = 0,
  bookmarkAddRequest = 0,
  onBookmarkAt,
  onDocSize,
  jumpToBookmark = null,
}: ReadingDocumentProps) {
  const mentionHighlightReadEnabled = useUiStore(
    (state) => state.mentionHighlightReadEnabled,
  );
  const mentionColorCharacter = useUiStore(
    (state) => state.mentionColorCharacter,
  );
  const mentionColorLocation = useUiStore(
    (state) => state.mentionColorLocation,
  );

  const mentionSettingsRef = useRef<MentionHighlightSettings>({
    enabled: false,
    entities: [],
    colorFor: () => "inherit",
    onOpen: () => undefined,
    title: "",
  });
  mentionSettingsRef.current = {
    enabled: mentionHighlightReadEnabled,
    entities: mentions,
    colorFor: (type) =>
      type === "character" ? mentionColorCharacter : mentionColorLocation,
    onOpen: (type, id) => onOpenMention?.(type, id),
    title: "Abrir ficha",
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      // Same alignment attribute as the editor, so centered/right/justified
      // paragraphs keep their `text-align` style in read mode.
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      // Mesma configuração do editor: capítulo com imagem precisa do node
      // registrado aqui, senão o setContent descarta a imagem.
      Image.configure({
        allowBase64: true,
        inline: false,
        HTMLAttributes: { class: "max-w-full rounded-lg" },
      }),
      EntityHighlight.configure({
        getSettings: () => mentionSettingsRef.current,
      }),
      GrifarMark,
    ],
    content: content as Content,
    editorProps: {
      attributes: {
        class: "px-1 py-2 font-serif text-[1em] leading-[1.9] outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor) editor.commands.setContent(content as Content);
  }, [editor, content]);

  // Recompute highlights when the index or its styling changes.
  useEffect(() => {
    if (!editor) return;
    editor.view.dispatch(
      editor.state.tr.setMeta(mentionHighlightKey, { refresh: true }),
    );
  }, [
    editor,
    mentions,
    mentionHighlightReadEnabled,
    mentionColorCharacter,
    mentionColorLocation,
  ]);

  // O botão de grifar vive na barra da página: aqui só avisamos se há seleção.
  const onGrifarChangeRef = useRef(onGrifarChange);
  onGrifarChangeRef.current = onGrifarChange;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    if (!editor) return;
    const update = () => {
      onSelectionChangeRef.current?.(
        !editor.state.selection.empty &&
          useUiStore.getState().readGrifarEnabled,
      );
    };
    update();
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  // Canais de marcadores: os callbacks vivem em refs (mesmo padrão do grifar).
  const onBookmarkAtRef = useRef(onBookmarkAt);
  onBookmarkAtRef.current = onBookmarkAt;
  const onDocSizeRef = useRef(onDocSize);
  onDocSizeRef.current = onDocSize;

  useEffect(() => {
    if (!editor) return;
    const report = () => onDocSizeRef.current?.(editor.state.doc.content.size);
    report();
    editor.on("update", report);
    return () => {
      editor.off("update", report);
    };
  }, [editor, content]);

  const appliedBookmarkRequest = useRef(bookmarkAddRequest);
  useEffect(() => {
    if (!editor || bookmarkAddRequest === appliedBookmarkRequest.current) {
      return;
    }
    appliedBookmarkRequest.current = bookmarkAddRequest;
    const max = editor.state.doc.content.size;
    let position: number | null = editor.state.selection.empty
      ? null
      : editor.state.selection.from;
    if (position === null) {
      // Sem seleção: marca o primeiro texto visível do documento.
      const rect = editor.view.dom.getBoundingClientRect();
      const coords = editor.view.posAtCoords({
        left: rect.left + rect.width / 2,
        top: rect.top + 16,
      });
      position = coords?.pos ?? 1;
    }
    const safe = Math.min(Math.max(position, 0), max);
    onBookmarkAtRef.current?.(
      safe,
      bookmarkExcerpt(editor.state.doc, safe),
    );
  }, [editor, bookmarkAddRequest]);

  useEffect(() => {
    if (!editor || !jumpToBookmark) return;
    const max = editor.state.doc.content.size;
    const position = Math.min(Math.max(jumpToBookmark.position, 0), max);
    const target = editor.view.domAtPos(position);
    const element =
      target.node.nodeType === 1
        ? (target.node as HTMLElement)
        : target.node.parentElement;
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [editor, jumpToBookmark]);

  // A página pediu para grifar (clique na barra): aplica na seleção viva.
  const appliedRequest = useRef(grifarRequest);
  useEffect(() => {
    if (!editor || grifarRequest === appliedRequest.current) return;
    appliedRequest.current = grifarRequest;
    if (editor.state.selection.empty) return;
    editor.chain().setMark("grifar").run();
    onGrifarChangeRef.current?.(editor.getJSON() as Json);
  }, [editor, grifarRequest]);

  if (!editor) return null;
  return <EditorContent editor={editor} className="tiptap mention-readonly" />;
}
