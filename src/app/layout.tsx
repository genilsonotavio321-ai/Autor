import type { Metadata, Viewport } from "next";
import { Geist, Lora } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/shared/ui/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const lora = Lora({ subsets: ["latin"], variable: "--font-serif" });

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
  // viewport-fit=cover: o app ocupa a tela inteira no iPhone (régua,
  // status bar) — as barras do app compensam com env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={cn("font-sans", geist.variable, lora.variable)}
    >
      <body className="antialiased">
        <ThemeProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
