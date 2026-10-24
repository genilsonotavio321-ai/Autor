"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { downloadBlob } from "@/features/export/infra/download";
import { handleDialogEnter } from "@/shared/lib/keyboard";
import { playUiSound } from "@/shared/lib/sound";
import type {
  CustomPrompt,
  CustomPromptCategory,
  CustomPromptKind,
  EntityId,
} from "@/shared/types/database";

import {
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
} from "../domain/prompt-banks";
import { buildPromptExport, parsePromptExport } from "../domain/prompt-io";
import { customPromptRepository } from "../infra/dexie-custom-prompt-repository";

const NO_PROMPTS: CustomPrompt[] = [];

const KIND_LABELS: Record<CustomPromptKind, string> = {
  question: "Pergunta",
  whatIf: "E se...",
};

interface DialogState {
  open: boolean;
  prompt: CustomPrompt | null;
}

export function PromptManager() {
  const prompts = useLiveQuery(() => customPromptRepository.list(), []) ?? NO_PROMPTS;
  const [dialog, setDialog] = useState<DialogState>({ open: false, prompt: null });
  const [kind, setKind] = useState<CustomPromptKind>("question");
  const [category, setCategory] = useState<CustomPromptCategory>("enredo");
  const [variantsText, setVariantsText] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const variantsRef = useRef<HTMLTextAreaElement | null>(null);

  const questions = prompts.filter((item) => item.kind === "question");
  const whatIfs = prompts.filter((item) => item.kind === "whatIf");

  // Prévia da primeira variante com placeholders de exemplo.
  const previewLine = (() => {
    const line = variantsText
      .split("\n")
      .find((item) => item.trim().length > 0);
    if (!line) return null;
    return line
      .replaceAll("{personagem}", "Ana")
      .replaceAll("{local}", "a taverna")
      .replaceAll("@", "o/a");
  })();

  // Insere o token na posição do cursor e devolve o foco ao textarea.
  function insertToken(token: string) {
    const input = variantsRef.current;
    const start = input?.selectionStart ?? variantsText.length;
    const end = input?.selectionEnd ?? start;
    setVariantsText(
      variantsText.slice(0, start) + token + variantsText.slice(end),
    );
    requestAnimationFrame(() => {
      input?.focus();
      const caret = start + token.length;
      input?.setSelectionRange(caret, caret);
    });
  }

  function openCreate() {
    setKind("question");
    setCategory("enredo");
    setVariantsText("");
    setDialog({ open: true, prompt: null });
  }

  function openEdit(prompt: CustomPrompt) {
    setKind(prompt.kind);
    setCategory(prompt.category ?? "enredo");
    setVariantsText(prompt.variants.join("\n"));
    setDialog({ open: true, prompt });
  }

  function closeDialog() {
    setDialog({ open: false, prompt: null });
  }

  async function submit() {
    const variants = variantsText
      .split("\n")
      .map((variant) => variant.trim())
      .filter((variant) => variant.length > 0);
    if (variants.length === 0) {
      toast.error("Escreva ao menos uma variante");
      return;
    }
    try {
      if (dialog.prompt) {
        await customPromptRepository.update(dialog.prompt.id, {
          category: kind === "question" ? category : undefined,
          variants,
        });
        toast.success("Prompt atualizado");
      } else {
        await customPromptRepository.create({
          kind,
          category: kind === "question" ? category : undefined,
          variants,
        });
        toast.success("Prompt criado");
      }
      playUiSound("save");
      closeDialog();
    } catch {
      toast.error("Falha ao salvar o prompt");
    }
  }

  async function toggleEnabled(prompt: CustomPrompt, enabled: boolean) {
    playUiSound("toggle");
    await customPromptRepository.update(prompt.id, { enabled });
  }

  async function removePrompt(id: EntityId) {
    const prompt = prompts.find((item) => item.id === id);
    if (!prompt) return;
    playUiSound("delete");
    await customPromptRepository.hardDelete(id);
    toast("Prompt excluído", {
      action: {
        label: "Desfazer",
        onClick: () => {
          void customPromptRepository.create({
            kind: prompt.kind,
            category: prompt.category,
            variants: prompt.variants,
          });
        },
      },
    });
  }

  function exportPrompts() {
    if (prompts.length === 0) {
      toast.error("Nenhum prompt para exportar");
      return;
    }
    playUiSound("backup");
    const blob = new Blob([JSON.stringify(buildPromptExport(prompts), null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, "prompts-autor.json");
  }

  async function importPrompts(file: File) {
    try {
      const items = parsePromptExport(JSON.parse(await file.text()));
      for (const item of items) {
        await customPromptRepository.create({
          kind: item.kind,
          category: item.kind === "question" ? item.category : undefined,
          variants: item.variants,
        });
      }
      // atalho: imports chegam sempre ativados; desligue na lista se quiser
      playUiSound("restore");
      toast.success(`${items.length} prompt(s) importado(s)`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Arquivo de prompts inválido",
      );
    }
  }

  function renderGroup(title: string, items: CustomPrompt[]) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ainda.</p>
        ) : (
          <ul className="grid gap-2">
            {items.map((prompt) => (
              <li
                key={prompt.id}
                className="flex flex-wrap items-center gap-2 rounded-md border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {prompt.variants[0]}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {prompt.variants.length} variante(s)
                    {prompt.kind === "question" && prompt.category
                      ? ` · ${PROMPT_CATEGORY_LABELS[prompt.category]}`
                      : ""}
                  </p>
                </div>
                <Switch
                  aria-label={`Ativar ${prompt.variants[0]}`}
                  checked={prompt.enabled}
                  onCheckedChange={(checked) =>
                    void toggleEnabled(prompt, checked)
                  }
                />
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar ${prompt.variants[0]}`}
                  onClick={() => openEdit(prompt)}
                >
                  <Pencil aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Excluir ${prompt.variants[0]}`}
                  onClick={() => void removePrompt(prompt.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">Perguntas e e se...</h3>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus aria-hidden />
            Novo prompt
          </Button>
          <Button variant="outline" size="sm" onClick={exportPrompts}>
            <Download aria-hidden />
            Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
          >
            <Upload aria-hidden />
            Importar
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importPrompts(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Variantes entram no sorteio de Criatividade. Use os placeholders
        {" "}
        <code>{"{personagem}"}</code> e <code>{"{local}"}</code> para citar
        fichas; o sufixo <code>@</code> concorda com o gênero (obrigad@ →
        obrigado/obrigada).
      </p>
      {renderGroup("Perguntas", questions)}
      {renderGroup("E se...", whatIfs)}

      <Dialog
        open={dialog.open}
        onOpenChange={(open) => (open ? null : closeDialog())}
      >
        <DialogContent
          className="sm:max-w-lg"
          onKeyDown={(event) => handleDialogEnter(event, () => void submit())}
        >
          <DialogHeader>
            <DialogTitle>
              {dialog.prompt ? "Editar prompt" : "Novo prompt"}
            </DialogTitle>
            <DialogDescription>
              Uma variante por linha. Elas entram no sorteio do gerador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="prompt-kind">Tipo</Label>
              <Select
                value={kind}
                onValueChange={(value) => setKind(value as CustomPromptKind)}
              >
                <SelectTrigger id="prompt-kind" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABELS) as CustomPromptKind[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {KIND_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kind === "question" && (
              <div className="grid gap-2">
                <Label htmlFor="prompt-category-custom">Categoria</Label>
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as CustomPromptCategory)
                  }
                >
                  <SelectTrigger id="prompt-category-custom" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROMPT_CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {PROMPT_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="prompt-variants">Variantes</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken("{personagem}")}
                >
                  + Personagem
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken("{local}")}
                >
                  + Local
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => insertToken("@")}
                >
                  + Prefixo (o/a)
                </Button>
              </div>
              <Textarea
                id="prompt-variants"
                ref={variantsRef}
                value={variantsText}
                onChange={(event) => setVariantsText(event.target.value)}
                rows={4}
                placeholder={"O que {personagem} faria em {local}?\nE se falhasse?"}
              />
              {previewLine ? (
                <p className="text-xs text-muted-foreground">
                  Prévia: {previewLine}
                </p>
              ) : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Cancelar
            </Button>
            <Button onClick={() => void submit()}>
              {dialog.prompt ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
