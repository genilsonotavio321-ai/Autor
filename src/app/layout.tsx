import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

// Newsreader: serifa editorial com pesos reais (Instrument Serif só tem 400,
// o que obrigaria a sintetizar negrito nos títulos).
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Autor",
    template: "%s · Autor",
  },
  description: "App pessoal de escrita e planejamento de livros",
  applicationName: "Autor",
  manifest: "/manifest.webmanifest",
  // black-translucent: app de tela de início preenche o status bar do iPhone
  // (o chrome aplica env(safe-area-inset-top) para não ficar sob o horário).
  appleWebApp: {
    capable: true,
    title: "Autor",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  // Canvas controla o próprio zoom: o browser não pode roubar o pinch.
  userScalable: false,
  maximumScale: 1,
  // viewport-fit=cover: o app ocupa a tela inteira no iPhone.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1a17" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, newsreader.variable)}
    >
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          {/* Notificações no topo: a barra inferior de navegação (mobile)
              não pode ser coberta pelo toast. */}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
