"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime } from "@/shared/lib/dates";
import type { Chapter, ChapterStatus } from "@/shared/types/database";

import { CHAPTER_STATUS_LABELS } from "../domain/repository";
import { chapterRepository } from "../infra/dexie-chapter-repository";

interface ChapterListProps {
  chapters: Chapter[];
}

export function ChapterList({ chapters }: ChapterListProps) {
  if (chapters.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum capítulo ainda. Crie o primeiro e comece a escrever.
      </div>
    );
  }

  async function changeStatus(chapter: Chapter, status: ChapterStatus) {
    try {
      await chapterRepository.update(chapter.id, { status });
    } catch {
      toast.error("Falha ao atualizar o status");
    }
  }

  async function remove(chapter: Chapter) {
    await chapterRepository.softDelete(chapter.id);
    toast(`"${chapter.title}" movido para a lixeira`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          void chapterRepository.restore(chapter.id);
        },
      },
    });
  }

  return (
    <ul className="divide-y rounded-lg border">
      {chapters.map((chapter) => (
        <li key={chapter.id} className="flex items-center gap-3 p-3">
          <span
            aria-hidden
            className="w-8 shrink-0 text-center font-serif text-sm text-muted-foreground"
          >
            {chapter.order}
          </span>
          <div className="min-w-0 flex-1">
            <Link
              href={`/write/${chapter.id}`}
              className="block truncate font-medium hover:underline"
            >
              {chapter.title}
            </Link>
            <p className="text-xs text-muted-foreground">
              {chapter.wordCount.toLocaleString("pt-BR")} palavras ·
              atualizado {formatRelativeTime(chapter.updatedAt)}
            </p>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">
            {CHAPTER_STATUS_LABELS[chapter.status]}
          </Badge>
          <Select
            value={chapter.status}
            onValueChange={(value) =>
              void changeStatus(chapter, value as ChapterStatus)
            }
          >
            <SelectTrigger
              className="h-8 w-32"
              aria-label={`Status de ${chapter.title}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CHAPTER_STATUS_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Ações de ${chapter.title}`}
              >
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void remove(chapter)}
              >
                <Trash2 aria-hidden />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}
