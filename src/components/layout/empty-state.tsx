import { cn } from "cn";

/** Estado vazio pontilhado usado nas listas e seções. */
export function EmptyState({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed border-border/80 bg-card/30 p-8 text-center text-sm leading-relaxed text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}
