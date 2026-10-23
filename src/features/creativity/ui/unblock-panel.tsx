"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Shuffle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EntityId } from "@/shared/types/database";

import { characterRepository } from "@/features/characters/infra/dexie-character-repository";

import {
  PROMPT_CATEGORIES,
  PROMPT_CATEGORY_LABELS,
  drawPrompt,
  drawWhatIf,
  type PromptCategory,
} from "../domain/prompt-banks";
import { ideaCardRepository } from "../infra/dexie-idea-card-repository";

interface UnblockPanelProps {
  projectId: EntityId;
}

export function UnblockPanel({ projectId }: UnblockPanelProps) {
  const cards =
    useLiveQuery(() => ideaCardRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const characters =
    useLiveQuery(() => characterRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const [category, setCategory] = useState<PromptCategory>("enredo");
  const [question, setQuestion] = useState<string | null>(null);
  const [whatIf, setWhatIf] = useState<string | null>(null);

  // Novos cards entram em cascata no canto do canvas — reposicione à vontade.
  function cascade() {
    const n = cards.length;
    return { x: 16 + (n % 5) * 24, y: 16 + (n % 5) * 40 };
  }

  async function saveToCanvas(title: string, content: string) {
    try {
      await ideaCardRepository.create({ projectId, title, content, ...cascade() });
      toast.success("Ideia guardada no canvas");
    } catch {
      toast.error("Falha ao guardar a ideia");
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Perguntas provocativas</h2>
        <div className="grid gap-2">
          <Label htmlFor="prompt-category">Categoria</Label>
          <Select
            value={category}
            onValueChange={(value) => setCategory(value as PromptCategory)}
          >
            <SelectTrigger id="prompt-category" className="w-56">
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
        <p
          aria-live="polite"
          className="min-h-16 rounded-md bg-muted/60 p-3 text-sm"
        >
          {question ?? "Clique em sortear para destravar a história."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setQuestion(
                drawPrompt(
                  category,
                  Date.now(),
                  question ?? undefined,
                  characters,
                ),
              )
            }
          >
            <Shuffle aria-hidden />
            Sortear pergunta
          </Button>
          <Button
            variant="outline"
            disabled={!question}
            onClick={() =>
              void saveToCanvas(
                `Desbloqueio · ${PROMPT_CATEGORY_LABELS[category]}`,
                question ?? "",
              )
            }
          >
            Guardar pergunta no canvas
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">E se...?</h2>
        <p className="text-sm text-muted-foreground">
          Combinações de protagonista × obstáculo × cenário para histórias
          estagnadas.
        </p>
        <p
          aria-live="polite"
          className="min-h-16 rounded-md bg-muted/60 p-3 text-sm"
        >
          {whatIf ?? "Clique em sortear para gerar uma combinação."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setWhatIf(drawWhatIf(Date.now(), whatIf ?? undefined, characters))
            }
          >
            <Shuffle aria-hidden />
            Sortear combinação
          </Button>
          <Button
            variant="outline"
            disabled={!whatIf}
            onClick={() => void saveToCanvas("E se...", whatIf ?? "")}
          >
            Guardar e se no canvas
          </Button>
        </div>
      </section>
    </div>
  );
}
