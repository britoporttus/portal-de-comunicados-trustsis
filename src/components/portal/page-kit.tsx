// Peças reutilizáveis de página: cabeçalho, estado vazio, skeleton de lista.
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  title, description, action, icon: Icon, eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Rótulo curto acima do título (ex.: "Comunicação"). Opcional — usado para dar contexto editorial. */
  eyebrow?: string;
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="flex items-start gap-3">
          {Icon && (
            // Chip em superfície (borda hairline), não bloco de cor cheia — acento fica só no ícone.
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-primary">
              <Icon className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {/* Divisória hairline com um filete ciano curto à esquerda — mesmo acento do WelcomeHero,
          costurando a identidade da marca entre a home e as páginas internas. Um só acento. */}
      <div className="relative h-px w-full bg-border">
        <span aria-hidden className="absolute left-0 top-0 h-px w-16 bg-primary" />
      </div>
    </div>
  );
}

export function EmptyState({ title, description, icon: Icon, action }: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-14 text-center">
      {Icon && <Icon className="mb-3 size-8 text-muted-foreground" />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-xl" />
      ))}
    </div>
  );
}
