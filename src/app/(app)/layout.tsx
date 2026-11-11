import { AppShell } from "@/components/layout/app-shell";
import { DbReadyGate } from "@/infra/db/db-ready-gate";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DbReadyGate>
      <AppShell>{children}</AppShell>
    </DbReadyGate>
  );
}
