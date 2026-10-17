"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandIcon, navGroups, type NavItem } from "./nav-items";

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

export function SidebarNav({
  collapsed = false,
  onNavigate,
}: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className="flex flex-col gap-4">
      {navGroups.map((group) => (
        <div key={group.label ?? "primary"} className="flex flex-col gap-1">
          {group.label && !collapsed && (
            <p className="px-3 pb-1 text-xs font-medium tracking-wide text-sidebar-foreground/50 uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            return (
              <NavItemLink
                key={item.href}
                item={item}
                active={active}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
