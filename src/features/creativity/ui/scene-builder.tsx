"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { plotBeatRepository } from "@/features/plot/infra/dexie-plot-beat-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import type { Chapter, EntityId } from "@/shared/types/database";

import { composeSceneSummary, sendSceneToOutline } from "../application/send-to-outline";

interface SceneBuilderProps {
  projectId: EntityId;
  chapters: Chapter[];
}

/** Formulário guiado que envia a cena finalizada direto para a Estrutura. */
export function SceneBuilder({ projectId, chapters }: SceneBuilderProps) {
  const router = useRouter();
  const characters =
    useLiveQuery(() => characterRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const locations =
    useLiveQuery(() => locationRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];
  const beats =
    useLiveQuery(() => plotBeatRepository.listByProject(projectId), [
      projectId,
    ]) ?? [];

  const [title, setTitle] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [povId, setPovId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [goal, setGoal] = useState("");
  const [conflict, setConflict] = useState("");
  const [turn, setTurn] = useState("");
  const [sending, setSending] = useState(false);

  // Beats já vinculados ao capítulo escolhido — inspiração para a cena.
  const chapterBeats = beats.filter((beat) => beat.linkedChapterId === chapterId);

  async function submit() {
    if (!chapterId) return;
    setSending(true);
    try {
      const scene = await sendSceneToOutline({
        chapterId,
        title: title.trim() || undefined,
        summary: composeSceneSummary({ goal, conflict, turn }),
        povCharacterId: povId || undefined,
        locationId: locationId || undefined,
      });
      toast.success(`Cena "${scene.title}" enviada para a Estrutura`, {
        action: {
          label: "Ver em Estrutura",
          onClick: () => router.push("/outline"),
        },
      });
      setTitle("");
      setGoal("");
      setConflict("");
      setTurn("");
    } catch {
      toast.error("Falha ao enviar a cena");
    } finally {
      setSending(false);
    }
  }

  if (chapters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Crie capítulos na Estrutura para poder montar cenas aqui.
      </div>
    );
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div className="grid gap-2">
        <Label htmlFor="builder-title">Título</Label>
        <Input
          id="builder-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título da cena"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label>Capítulo</Label>
          <Select value={chapterId} onValueChange={setChapterId}>
            <SelectTrigger aria-label="Capítulo destino">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {chapters.map((chapter) => (
                <SelectItem key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>POV</Label>
          <Select value={povId} onValueChange={setPovId}>
            <SelectTrigger aria-label="POV da cena">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {characters.map((character) => (
                <SelectItem key={character.id} value={character.id}>
                  {character.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Local</Label>
          <Select value={locationId} onValueChange={setLocationId}>
            <SelectTrigger aria-label="Local da cena">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="builder-goal">Objetivo</Label>
        <Textarea
          id="builder-goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="O que o protagonista quer nesta cena?"
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="builder-conflict">Conflito</Label>
        <Textarea
          id="builder-conflict"
          value={conflict}
          onChange={(event) => setConflict(event.target.value)}
          placeholder="O que se opõe ao objetivo?"
          rows={2}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="builder-turn">Virada</Label>
        <Textarea
          id="builder-turn"
          value={turn}
          onChange={(event) => setTurn(event.target.value)}
          placeholder="O que muda no final da cena?"
          rows={2}
        />
      </div>
      {chapterBeats.length > 0 ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="mb-1 font-medium">Beats vinculados a este capítulo</p>
          <ul className="list-inside list-disc text-muted-foreground">
            {chapterBeats.map((beat) => (
              <li key={beat.id}>{beat.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <Button
          onClick={() => void submit()}
          disabled={sending || !chapterId}
        >
          <Send aria-hidden />
          Enviar para a Estrutura
        </Button>
      </div>
    </div>
  );
}
