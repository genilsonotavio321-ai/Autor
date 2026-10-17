import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Painel
        </h1>
        <p className="text-muted-foreground">
          Bem-vindo ao Autor. Retome um projeto ou comece um novo.
        </p>
      </div>

      <section aria-label="Continuar de onde parou" className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Continuar de onde parou
        </h2>
        <div className="rounded-xl border bg-card p-4">
          <Skeleton className="mb-3 h-4 w-2/5" />
          <Skeleton className="mb-2 h-3 w-3/5" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </section>

      <section aria-label="Estatísticas" className="grid gap-3 sm:grid-cols-3">
        {["Palavras", "Capítulos", "Sessão de escrita"].map((label) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <Skeleton className="mt-2 h-7 w-16" />
          </div>
        ))}
      </section>
    </div>
  );
}
