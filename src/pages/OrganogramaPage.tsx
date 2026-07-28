// Página Organograma: diretório de colaboradores ATIVOS (@trustsis.com), agrupado
// apenas por departamento — em duas visões: árvore interativa (reactflow) e lista.
import { useMemo, useState } from "react";
import { Network, Mail, Phone, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import type { Pessoa } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { iniciais } from "@/lib/format";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { OrgFlow } from "@/components/portal/OrgFlow";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function PessoaCard({ pessoa }: { pessoa: Pessoa }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
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
            <a href={`mailto:${pessoa.email}`} className="inline-flex items-center gap-1 truncate hover:text-primary">
              <Mail className="size-3" /> {pessoa.email}
            </a>
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
  const [busca, setBusca] = useState("");

  const diretorio = data?.diretorio ?? [];

  // Agrupa o diretório por departamento, filtrando pela busca (nome/cargo/área/e-mail).
  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = diretorio.filter((p) => {
      if (!termo) return true;
      return [p.nome, p.cargo, p.area, p.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(termo));
    });
    const mapa = new Map<string, Pessoa[]>();
    for (const p of filtrados) {
      const area = p.area?.trim() || "Sem área";
      if (!mapa.has(area)) mapa.set(area, []);
      mapa.get(area)!.push(p);
    }
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [diretorio, busca]);

  return (
    <div>
      <PageHeader
        icon={Network}
        title="Organograma"
        description="Colaboradores ativos da TrustSis, organizados por departamento"
      />

      {loading ? (
        <ListSkeleton rows={4} />
      ) : !data || diretorio.length === 0 ? (
        <EmptyState
          icon={Network}
          title="Sem dados de organograma"
          description="Não foi possível carregar os colaboradores no momento."
        />
      ) : (
        <Tabs defaultValue="arvore" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="arvore">Organograma</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="size-3.5 text-primary" />
              {diretorio.length} pessoas · {grupos.length} departamentos
            </div>
          </div>

          {/* Árvore interativa */}
          <TabsContent value="arvore">
            <p className="mb-3 text-xs text-muted-foreground">
              Hierarquia por gestor (campo <span className="font-medium">manager</span> do Entra ID). Clique no contador
              de time para expandir/recolher os liderados. Arraste para mover e use a roda do mouse para dar zoom.
            </p>
            <OrgFlow empresa="TrustSis" diretorio={diretorio} />
          </TabsContent>

          {/* Lista por departamento */}
          <TabsContent value="lista" className="space-y-4">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, cargo ou área…"
                className="pl-9"
              />
            </div>

            {grupos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum colaborador encontrado para “{busca}”.</p>
            ) : (
              <div className="space-y-6">
                {grupos.map(([area, pessoas]) => (
                  <Secao key={area} titulo={`${area} (${pessoas.length})`}>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {pessoas.map((p) => (
                        <PessoaCard key={p.id} pessoa={p} />
                      ))}
                    </div>
                  </Secao>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
