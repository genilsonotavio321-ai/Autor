"use client";

import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DARK_PALETTES,
  LIGHT_PALETTES,
  THEME_OPTIONS,
} from "@/features/settings/ui/settings-options";
import { cn } from "@/lib/utils";
import {
  type ThemeVariantDark,
  type ThemeVariantLight,
  useUiStore,
} from "@/shared/store/ui-store";

/**
 * Card de aparência: tema (claro/escuro/sistema) e a paleta de cada tema.
 * `mounted` evita divergência de hidratação, já que o tema resolvido só existe
 * no cliente.
 */
export function AppearanceCard() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const themeVariantLight = useUiStore((state) => state.themeVariantLight);
  const themeVariantDark = useUiStore((state) => state.themeVariantDark);
  const setThemeVariantLight = useUiStore(
    (state) => state.setThemeVariantLight,
  );
  const setThemeVariantDark = useUiStore((state) => state.setThemeVariantDark);

  const isDark = resolvedTheme === "dark";
  const palettes = isDark ? DARK_PALETTES : LIGHT_PALETTES;
  const activeVariant = isDark ? themeVariantDark : themeVariantLight;

  useEffect(() => setMounted(true), []);

  return (
    <Card id="aparencia">
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
        <CardDescription>
          Tema claro, escuro ou conforme o sistema — e a paleta de cada um.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div role="group" aria-label="Tema" className="flex flex-wrap gap-2">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={mounted && theme === value ? "default" : "outline"}
              aria-pressed={mounted && theme === value}
              onClick={() => setTheme(value)}
            >
              <Icon aria-hidden />
              {label}
            </Button>
          ))}
        </div>
        {mounted ? (
          <ul aria-label="Paleta do tema" className="grid gap-2">
            {palettes.map((palette) => {
              const value = palette.value as string;
              const active = (activeVariant as string) === value;
              return (
                <li key={palette.value}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      isDark
                        ? setThemeVariantDark(value as ThemeVariantDark)
                        : setThemeVariantLight(value as ThemeVariantLight)
                    }
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ring-1 transition-colors",
                      active
                        ? "bg-accent ring-2 ring-primary"
                        : "ring-border/70 hover:bg-accent/50",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-9 shrink-0 rounded-full border border-black/10"
                      style={{
                        background: `linear-gradient(135deg, ${palette.bg} 50%, ${palette.ink} 50%)`,
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {palette.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {palette.description}
                      </span>
                    </span>
                    {active ? (
                      <Check
                        aria-hidden
                        className="size-4 shrink-0 text-primary"
                      />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
