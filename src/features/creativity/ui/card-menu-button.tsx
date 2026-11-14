"use client";

import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface CardMenuButtonProps {
  label: string;
  icon: LucideIcon;
  destructive?: boolean;
  onClick: () => void;
}

/** Botão do menu de contexto do card (hold 0,8s sobre o node). */
export function CardMenuButton({
  label,
  icon: Icon,
  destructive,
  onClick,
}: CardMenuButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={`flex w-full items-center justify-start gap-2 px-1.5 py-1 text-sm ${destructive ? "text-destructive hover:text-destructive" : ""}`}
      onClick={onClick}
    >
      <Icon aria-hidden className="size-4" />
      {label}
    </Button>
  );
}
