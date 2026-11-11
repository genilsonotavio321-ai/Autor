"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Editor } from "@tiptap/core";
import { ChevronLeft, ChevronRight, SpellCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { findRepeatedWords, type ReviewIssue } from "../domain/review";
import {
  findTextRanges,
  previewForRange,
  type TextRange,
} from "../domain/replace";
import { searchHighlightKey } from "./search-highlight";

const TYPE_LABELS: Record<ReviewIssue["type"], string> = {
  "repeated-word": "Palavra repetida",
  spacing: "Espaçamento",
  punctuation: "Pontuação",
};

interface ReviewDialogProps {
  editor: Editor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Revisar": lists repeated words, double spaces and stray punctuation so the
 * writer can fix each one (or all at once), plus a find & replace section.
 * Offsets come from the live doc, so fixing re-runs the scan to keep positions
 * valid.
 */
export function ReviewDialog({ editor, open, onOpenChange }: ReviewDialogProps) {
  const [issues, setIssues] = useState<ReviewIssue[]>([]);
  const [find, setFind] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  const [matches, setMatches] = useState<TextRange[]>([]);
  const [current, setCurrent] = useState(0);

  const rescan = useCallback(() => {
    setIssues(editor ? findRepeatedWords(editor.state.doc) : []);
  }, [editor]);

  // Reads the live doc with the current query; called when the query changes
  // and after every replace so positions stay valid.
  const refreshMatches = useCallback((): TextRange[] => {
    if (!editor || find.length === 0) {
      setMatches([]);
      setCurrent(0);
      return [];
    }
    const next = findTextRanges(editor.state.doc, find);
    setMatches(next);
    setCurrent((index) => Math.min(index, Math.max(0, next.length - 1)));
    return next;
  }, [editor, find]);

  useEffect(() => {
    if (open) {
      rescan();
      setFind("");
      setReplaceWith("");
    }
  }, [open, rescan]);

  useEffect(() => {
    if (open) refreshMatches();
  }, [open, refreshMatches]);

  // Item 19: mirror the occurrences into the editor as view-only highlights,
  // emphasising the current one.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const ranges = open
      ? matches.map((match) => ({ from: match.from, to: match.to }))
      : [];
    editor.view.dispatch(
      editor.state.tr.setMeta(searchHighlightKey, {
        ranges,
        active: open ? current : 0,
      }),
    );
  }, [editor, matches, current, open]);

  // Drop the highlights when the dialog unmounts.
  useEffect(() => {
    if (!editor) return;
    return () => {
      if (editor.isDestroyed) return;
      editor.view.dispatch(
        editor.state.tr.setMeta(searchHighlightKey, { ranges: [], active: 0 }),
      );
    };
  }, [editor]);

  const previews = useMemo(
    () =>
      editor
        ? matches.map((range) => previewForRange(editor.state.doc, range))
        : [],
    [editor, matches],
  );

  function fix(issue: ReviewIssue) {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContentAt({ from: issue.from, to: issue.to }, issue.suggestion)
      .run();
    rescan();
    refreshMatches();
  }

  function fixAll() {
    if (!editor) return;
    // Back to front so earlier offsets stay valid.
    const ordered = [...issues].sort((a, b) => b.from - a.from);
    const chain = editor.chain().focus();
    for (const issue of ordered) {
      chain.insertContentAt({ from: issue.from, to: issue.to }, issue.suggestion);
    }
    chain.run();
    rescan();
    refreshMatches();
  }

  function ignore(issue: ReviewIssue) {
    setIssues((items) => items.filter((item) => item !== issue));
  }

  function selectRange(range: TextRange) {
    editor?.chain().setTextSelection(range).scrollIntoView().run();
  }

  /** Steps through occurrences, wrapping around; keeps the match highlighted. */
  function goTo(index: number) {
    if (matches.length === 0) return;
    const bounded = (index + matches.length) % matches.length;
    setCurrent(bounded);
    const target = matches[bounded];
    if (target) selectRange(target);
  }

  function replaceCurrent() {
    if (!editor) return;
    const target = matches[current];
    if (!target) return;

    // Replace the current occurrence, then highlight the next one.
    const chain = editor.chain().focus();
    if (replaceWith.length === 0) {
      chain.deleteRange(target);
    } else {
      // JSON inline content keeps `<`, `&`… as literal text.
      chain.insertContentAt(target, [{ type: "text", text: replaceWith }]);
    }
    chain.run();

    const next = refreshMatches();
    const nextIndex = Math.min(current, Math.max(0, next.length - 1));
    setCurrent(nextIndex);
    const upcoming = next[nextIndex];
    if (upcoming) selectRange(upcoming);
    rescan();
  }

  function replaceAll() {
    if (!editor || matches.length === 0) return;
    // Back to front so earlier offsets stay valid.
    const ordered = [...matches].sort((a, b) => b.from - a.from);
    const chain = editor.chain().focus();
    for (const range of ordered) {
      if (replaceWith.length === 0) {
        chain.deleteRange(range);
      } else {
        chain.insertContentAt(range, [{ type: "text", text: replaceWith }]);
      }
    }
    chain.run();
    refreshMatches();
    rescan();
  }

  const matchLabel =
    find.length === 0
      ? "Digite o texto a encontrar."
      : matches.length === 0
        ? "Nenhuma ocorrência."
        : `${matches.length} ${matches.length === 1 ? "ocorrência" : "ocorrências"}${
            matches.length > 1 ? ` · ${current + 1} de ${matches.length}` : ""
          }`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar</DialogTitle>
          <DialogDescription>
            {issues.length === 0
              ? "Nenhum problema encontrado."
              : `${issues.length} ${issues.length === 1 ? "problema encontrado" : "problemas encontrados"}.`}
          </DialogDescription>
        </DialogHeader>

        {issues.length > 0 && (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li
                // Offsets shift after each fix; the identity of the object in
                // this list is stable until the next scan.
                key={`${issue.type}-${issue.from}-${issue.to}`}
                className="rounded-md border p-3 text-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-muted-foreground text-xs">
                      {TYPE_LABELS[issue.type]}
                    </span>
                    <p className="mt-1 truncate font-medium">{issue.preview}</p>
                    <p className="mt-1 text-muted-foreground">
                      Sugestão:{" "}
                      <span className="text-foreground">{issue.suggestion}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => ignore(issue)}
                    >
                      Ignorar
                    </Button>
                    <Button type="button" size="sm" onClick={() => fix(issue)}>
                      Corrigir
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {issues.length > 0 && (
          <DialogFooter>
            <Button type="button" onClick={fixAll}>
              Corrigir tudo
            </Button>
          </DialogFooter>
        )}

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-medium">Substituir</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="review-find" className="text-xs">
                Encontrar
              </Label>
              <Input
                id="review-find"
                value={find}
                onChange={(event) => setFind(event.target.value)}
                placeholder="Texto a encontrar"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-replace" className="text-xs">
                Substituir por
              </Label>
              <Input
                id="review-replace"
                value={replaceWith}
                onChange={(event) => setReplaceWith(event.target.value)}
                placeholder="Novo texto"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-xs" aria-live="polite">
              {matchLabel}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Ocorrência anterior"
                disabled={matches.length === 0}
                onClick={() => goTo(current - 1)}
              >
                <ChevronLeft aria-hidden className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label="Próxima ocorrência"
                disabled={matches.length === 0}
                onClick={() => goTo(current + 1)}
              >
                <ChevronRight aria-hidden className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={matches.length === 0}
                onClick={replaceCurrent}
              >
                Substituir
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={matches.length === 0}
                onClick={replaceAll}
              >
                Substituir tudo
              </Button>
            </div>
          </div>
          {matches.length > 0 && (
            <ul
              className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1 text-sm"
              aria-label="Ocorrências encontradas"
            >
              {matches.map((range, index) => (
                <li key={`${range.from}-${range.to}`}>
                  <button
                    type="button"
                    onClick={() => goTo(index)}
                    aria-current={index === current ? "true" : undefined}
                    className={cn(
                      "w-full rounded-md px-2 py-1 text-left",
                      index === current
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted",
                    )}
                  >
                    <span className="text-muted-foreground">
                      {previews[index]?.truncatedStart ? "…" : ""}
                      {previews[index]?.before}
                    </span>
                    <mark className="rounded bg-transparent font-semibold text-foreground">
                      {previews[index]?.match}
                    </mark>
                    <span className="text-muted-foreground">
                      {previews[index]?.after}
                      {previews[index]?.truncatedEnd ? "…" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}

/** Icon + label for the toolbar button that opens the review dialog. */
export function ReviewButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 px-2"
      aria-label="Revisar"
      onClick={onClick}
    >
      <SpellCheck aria-hidden className="size-4" />
      Revisar
    </Button>
  );
}
