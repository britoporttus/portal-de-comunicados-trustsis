// Página Organograma: gestor, colaborador atual e liderados (via Graph /org ou demo).
import { Network, Mail, Phone } from "lucide-react";
import { api } from "@/lib/api";
import type { Pessoa } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { iniciais } from "@/lib/format";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function PessoaCard({ pessoa, destaque = false }: { pessoa: Pessoa; destaque?: boolean }) {
  return (
    <div
      className={
        "flex items-center gap-3 rounded-xl border p-4 shadow-sm " +
        (destaque
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card")
      }
    >
      <Avatar className="size-12 shrink-0">
        {pessoa.fotoUrl && <AvatarImage src={pessoa.fotoUrl} alt={pessoa.nome} />}
        <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
          {iniciais(pessoa.nome)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-foreground">{pessoa.nome}</h3>
        {pessoa.cargo && <p className="truncate text-xs text-muted-foreground">{pessoa.cargo}</p>}
        <div className="mt-1 flex flex-col gap-0.5 text-[11px] text-muted-foreground">
          {pessoa.email && (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail className="size-3" /> {pessoa.email}
            </span>
          )}
          {pessoa.telefone && (
            <span className="inline-flex items-center gap-1 truncate">
              <Phone className="size-3" /> {pessoa.telefone}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </div>
  );
}

export default function OrganogramaPage() {
  const { data, loading } = useAsync(() => api.org());

  return (
    <div>
      <PageHeader
        icon={Network}
        title="Organograma"
        description="Sua estrutura de time — gestor e liderados"
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : !data ? (
        <EmptyState
          icon={Network}
          title="Sem dados de organograma"
          description="Não foi possível carregar a estrutura do time."
        />
      ) : (
        <div className="space-y-8">
          {data.gestor && (
            <Secao titulo="Gestor">
              <div className="max-w-md">
                <PessoaCard pessoa={data.gestor} />
              </div>
            </Secao>
          )}

          <Secao titulo="Você">
            <div className="max-w-md">
              <PessoaCard pessoa={data} destaque />
            </div>
          </Secao>

          <Secao titulo={`Liderados (${data.liderados.length})`}>
            {data.liderados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum liderado direto.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.liderados.map((p) => (
                  <PessoaCard key={p.id} pessoa={p} />
                ))}
              </div>
            )}
          </Secao>
        </div>
      )}
    </div>
  );
}
