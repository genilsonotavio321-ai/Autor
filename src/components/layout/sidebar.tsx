"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ProjectPicker } from "@/features/projects/ui/project-picker";
import { characterRepository } from "@/features/characters/infra/dexie-character-repository";
import { projectRepository } from "@/features/projects/infra/dexie-project-repository";
import { locationRepository } from "@/features/world/infra/dexie-location-repository";
import { useUiStore } from "@/shared/store/ui-store";
import type { Character, Location, Project } from "@/shared/types/database";
import { BrandIcon, navGroups, type NavItem } from "./nav-items";

/** Listas rápidas do menu — uma por href com conteúdo do projeto. */
const QUICK_HREFS = new Set(["/projects", "/characters", "/world"]);

const NO_PROJECTS: Project[] = [];
const NO_CHARACTERS: Character[] = [];
const NO_LOCATIONS: Location[] = [];

interface SidebarNavProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavItemLink({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.title : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={cn(collapsed && "sr-only")}>{item.title}</span>
      {!collapsed && null}
    </Link>
  );
}

interface QuickEntry {
  id: string;
  label: string;
  /** Tipo de ficha exibido ao lado do nome (locais). */
  subtitle?: string;
  go: () => void;
}

/** Conteúdo da lista rápida de um item: projetos, personagens ou locais. */
function useQuickEntries(href: string, onNavigate?: () => void): QuickEntry[] {
  const router = useRouter();
  const selectedProjectId = useUiStore((state) => state.selectedProjectId);
  const setSelectedProjectId = useUiStore(
    (state) => state.setSelectedProjectId,
  );

  const projects =
    useLiveQuery(() => projectRepository.listActive(), []) ?? NO_PROJECTS;
  const characters =
    useLiveQuery(
      () =>
        selectedProjectId
          ? characterRepository.listByProject(selectedProjectId)
          : Promise.resolve(NO_CHARACTERS),
      [selectedProjectId],
    ) ?? NO_CHARACTERS;
  const locations =
    useLiveQuery(
      () =>
        selectedProjectId
          ? locationRepository.listByProject(selectedProjectId)
          : Promise.resolve(NO_LOCATIONS),
      [selectedProjectId],
    ) ?? NO_LOCATIONS;

  if (href === "/projects") {
    return projects.map((project) => ({
      id: project.id,
      label: project.title,
      go: () => {
        setSelectedProjectId(project.id);
        router.push(`/projects/${project.id}`);
        onNavigate?.();
      },
    }));
  }
  if (href === "/characters") {
    return characters.map((character) => ({
      id: character.id,
      label: character.name,
      go: () => {
        setSelectedProjectId(character.projectId);
        router.push(`/characters?character=${character.id}&view=1`);
        onNavigate?.();
      },
    }));
  }
  return locations.map((location) => ({
    id: location.id,
    label: location.name,
    subtitle: location.type,
    go: () => {
      setSelectedProjectId(location.projectId);
      router.push(`/world?location=${location.id}&view=1`);
      onNavigate?.();
    },
  }));
}

function QuickNavList({
  href,
  onNavigate,
}: {
  href: string;
  onNavigate?: () => void;
}) {
  const entries = useQuickEntries(href, onNavigate);
  if (entries.length === 0) {
    return (
      <p className="ml-14 border-l-2 border-sidebar-border pl-2 py-1 text-xs text-sidebar-foreground/50">
        Nada aqui ainda.
      </p>
    );
  }
  return (
    <ul className="ml-14 border-l-2 border-sidebar-border pl-1">
      {entries.slice(0, 8).map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            onClick={entry.go}
            className="flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="truncate">{entry.label}</span>
            {entry.subtitle ? (
              <span className="shrink-0 text-xs text-sidebar-foreground/50">
                {entry.subtitle}
              </span>
            ) : null}
          </button>
        </li>
      ))}
      {entries.length > 8 ? (
        <li className="px-2 py-1 text-xs text-sidebar-foreground/50">
          +{entries.length - 8} mais
        </li>
      ) : null}
    </ul>
  );
}

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();
  const panelTabVisible = useUiStore((state) => state.panelTabVisible);
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggleExpand = (href: string) => {
    setExpanded((current) =>
      current.includes(href)
        ? current.filter((item) => item !== href)
        : [...current, href],
    );
  };

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4">
      {navGroups.map((group) => (
        <div key={group.label ?? "primary"} className="flex flex-col gap-1">
          {group.label && !collapsed && (
            <p className="px-3 pb-1 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
              {group.label}
            </p>
          )}
          {group.items
            .filter((item) => panelTabVisible || item.optional !== true)
            .map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    pathname.startsWith(`${item.href}/`);
              const expandable = !collapsed && QUICK_HREFS.has(item.href);
              const isOpen = expanded.includes(item.href);
              return (
                <div key={item.href} className="flex flex-col">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <NavItemLink
                        item={item}
                        active={active}
                        collapsed={collapsed}
                        onNavigate={onNavigate}
                      />
                    </div>
                    {expandable ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                        aria-label={
                          isOpen
                            ? `Ocultar lista de ${item.title}`
                            : `Expandir lista de ${item.title}`
                        }
                        aria-expanded={isOpen}
                        onClick={() => toggleExpand(item.href)}
                      >
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            "size-4 transition-transform",
                            isOpen && "rotate-180",
                          )}
                        />
                      </Button>
                    ) : null}
                  </div>
                  {expandable && isOpen ? (
                    <QuickNavList href={item.href} onNavigate={onNavigate} />
                  ) : null}
                </div>
              );
            })}
        </div>
      ))}
    </nav>
  );
}

const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_COLLAPSED = "4rem";

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      data-collapsed={collapsed}
      style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH }}
      className="sticky top-0 hidden h-svh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex"
    >
      <div className="flex h-14 items-center gap-2 overflow-hidden border-b border-sidebar-border px-4">
        <Link
          href="/"
          aria-label="Autor — painel"
          className="flex items-center gap-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandIcon className="size-5 shrink-0 text-sidebar-primary" aria-hidden="true" />
          {!collapsed && (
            <span className="font-heading text-sm font-semibold whitespace-nowrap">
              Autor
            </span>
          )}
        </Link>
      </div>
      <div className="flex-1 overflow-x-hidden overflow-y-auto py-3">
        <SidebarNav collapsed={collapsed} />
      </div>
      {!collapsed ? (
        <div className="border-t border-sidebar-border px-3 py-3">
          <ProjectPicker />
        </div>
      ) : null}
    </aside>
  );
}

export function MobileNav({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="flex h-14 flex-row items-center gap-2 border-b border-border px-4">
          <BrandIcon className="size-5 shrink-0 text-primary" aria-hidden="true" />
          <SheetTitle>Autor</SheetTitle>
          <SheetDescription className="sr-only">
            Menu de navegação principal
          </SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto py-3">
          <SidebarNav onNavigate={() => onOpenChange(false)} />
          <div className="border-t border-border px-3 py-3">
            <ProjectPicker />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
