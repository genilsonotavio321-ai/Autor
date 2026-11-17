import { cn } from "cn";

/** Cabeçalho padrão das seções: sobrancelha, título display, apoio e ações. */
export function PageHeader({
  eyebrow,
  title,
  description,
  count,
  children,
  className,
}: {
  /** Rótulo curto em caixa alta acima do título (ex.: "Biblioteca"). */
  eyebrow?: string;
  title: string;
  /** Linha de apoio abaixo do título. */
  description?: string;
  /** Ex.: "12 personagens". Entra na mesma linha de apoio. */
  count?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col items-center gap-5 text-center",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="display-title">{title}</h1>
        {description || count ? (
          <p className="lead">
            {description}
            {description && count ? " · " : null}
            {count}
          </p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {children}
        </div>
      ) : null}
      <div aria-hidden className="hairline w-full" />
    </header>
  );
}
