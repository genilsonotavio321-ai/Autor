import { cn } from "cn";

/** Estado vazio usado nas listas e seções. */
export function EmptyState({
  icon,
  title,
  hint,
  children,
  className,
}: {
  /** Ícone (Lucide) exibido no centro. */
  icon?: React.ReactNode;
  title?: string;
  /** Linha de apoio; pode ser passada em `children` quando há CTA. */
  hint?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl bg-card/50 px-6 py-12 text-center ring-1 ring-border",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground ring-1 ring-border/70"
        >
          {icon}
        </span>
      ) : null}
      {title ? (
        <p className="font-serif text-xl leading-tight tracking-tight text-foreground">
          {title}
        </p>
      ) : null}
      {hint ? (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
