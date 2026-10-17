import { Badge } from "@/components/ui/badge";

interface PagePlaceholderProps {
  title: string;
  phase: string;
  description: string;
}

/** Consistent stub for routes that arrive in a later phase. */
export function PagePlaceholder({
  title,
  phase,
  description,
}: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {title}
        </h1>
        <Badge variant="outline">{phase}</Badge>
      </div>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
