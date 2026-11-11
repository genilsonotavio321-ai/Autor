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
        "flex flex-wrap items-end justify-between gap-3",
        className,
      )}
    >
      <div className="space-y-1">
        <h1 className="font-serif text-[2rem] leading-none font-semibold tracking-tight md:text-4xl">
          {title}
        </h1>
        {count ? (
          <p className="text-[11px] font-medium tracking-[0.18em] text-muted-foreground uppercase">
            {count}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </header>
  );
}
