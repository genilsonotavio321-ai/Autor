"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptManager } from "@/features/creativity/ui/prompt-manager";
import { DataSection } from "@/features/export/ui/export-page";
import {
  CanvasSection,
  NavigationSection,
  NotificationsSection,
  ReadingSection,
  ShortcutsSection,
  TagsSection,
} from "@/features/settings/ui/advanced-sections";
import { AppearanceCard } from "@/features/settings/ui/appearance-card";
import {
  AnimationsCard,
  EditorCard,
  MentionsCard,
  SearchCard,
  TrashCard,
  WritingCard,
} from "@/features/settings/ui/general-cards";

export function SettingsPage() {
  // /settings?tab=dados abre direto a aba de dados (redirect de /export).
  const [tab, setTab] = useState("geral");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "dados") setTab("dados");
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 pt-2">
      <header className="space-y-2 text-center">
        <p className="eyebrow">Ajustes</p>
        <h1 className="display-title">Configurações</h1>
        <p className="lead">
          O essencial para escrever bem — o resto fica em Avançado.
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="dados">Dados</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-6 flex flex-col gap-5">
          <AppearanceCard />
          <EditorCard />
          <WritingCard />
          <AnimationsCard />
          <MentionsCard />
          <TrashCard />
          <SearchCard />

          <details className="group surface rounded-2xl">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[11px] font-semibold tracking-[0.18em] uppercase">
              Avançado
              <ChevronDown
                aria-hidden
                className="size-4 transition-transform group-open:rotate-180"
              />
            </summary>

            <div className="grid gap-6 border-t border-border/60 px-5 py-5">
              <ReadingSection />
              <NotificationsSection />
              <NavigationSection />
              <CanvasSection />
              <TagsSection />
              <ShortcutsSection />
            </div>
          </details>
        </TabsContent>

        <TabsContent value="dados" className="mt-6 flex flex-col gap-6">
          <DataSection />
          <Card id="dados">
            <CardHeader>
              <CardTitle>Prompts personalizados</CardTitle>
              <CardDescription>
                Perguntas e “E se...?” criadas por você, com exportação e
                importação em JSON.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid min-w-0 gap-4">
              <PromptManager />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
