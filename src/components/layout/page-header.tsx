import { cn } from "cn";

/** Cabeçalho padrão das seções: título, contagem opcional e ações à direita. */
export function PageHeader({
  title,
  count,
  children,
  className,
}: {
  title: string;
  /** Ex.: "12 personagens". Omitido enquanto não há dados. */
  count?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center justify-between gap-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-3xl">{title}</h1>
        {count ? (
          <span className="text-sm text-muted-foreground">{count}</span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}
