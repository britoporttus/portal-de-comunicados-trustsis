// Página "Quem está de férias": ausências/out-of-office (via Graph MailboxSettings ou demo).
import { Plane } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { iniciais, dataLonga } from "@/lib/format";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function FeriasPage() {
  const { data, loading } = useAsync(() => api.ferias());
  const ausencias = data ?? [];

  return (
    <div>
      <PageHeader
        icon={Plane}
        title="Quem está de férias"
        description="Colaboradores ausentes ou de férias no momento"
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : ausencias.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Ninguém de férias"
          description="Todo o time está por aqui. Aproveite!"
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ausencias.map((a) => (
            <div
              key={a.pessoa.id}
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <Avatar className="size-11 shrink-0">
                {a.pessoa.fotoUrl && <AvatarImage src={a.pessoa.fotoUrl} alt={a.pessoa.nome} />}
                <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                  {iniciais(a.pessoa.nome)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-foreground">{a.pessoa.nome}</h3>
                {a.pessoa.area && (
                  <p className="truncate text-xs text-muted-foreground">{a.pessoa.area}</p>
                )}
                {a.mensagem && (
                  <p className="mt-2 text-sm text-muted-foreground">{a.mensagem}</p>
                )}
                {a.ate && (
                  <p className="mt-2 inline-flex rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-medium text-success">
                    Retorna em {dataLonga(a.ate)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
