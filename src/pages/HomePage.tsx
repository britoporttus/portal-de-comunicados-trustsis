// Página inicial (dashboard): acesso rápido + comunicados, agenda, eventos e aniversariantes.
import * as React from "react";
import { Link } from "react-router-dom";
import {
  Megaphone, CalendarDays, Cake, CalendarClock, ArrowRight, Pin,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import {
  dataLonga, diaSemana, faixaHorario, tempoRelativo, mesAtualNome, iniciais,
} from "@/lib/format";
import { atalhoVisivelPorDepto } from "@/lib/atalhos";
import type { LinkUtil } from "@/lib/types";
import { LinkIcon, CategoriaBadge } from "@/components/portal/shared";
import { NextMeetingCard } from "@/components/portal/NextMeetingCard";
import { AgendaSemanaDialog } from "@/components/portal/AgendaSemanaDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePortal } from "@/context/PortalProvider";

function Painel({
  title, icon: Icon, to, acao, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  /** Ação alternativa no canto do cabeçalho (usada quando não há uma rota "ver todos"). */
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {acao}
        {to && (
          <Link
            to={to}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            Ver todos <ArrowRight className="size-3" />
          </Link>
        )}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function LinhaVazia({ texto }: { texto: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{texto}</p>;
}

/** Um grupo de chips do "Acesso rápido" (empresa/equipe ou pessoais).
 *  Não renderiza nada quando o grupo está vazio. */
function GrupoAtalhos({
  titulo,
  itens,
}: {
  titulo: string;
  itens: LinkUtil[];
}) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {titulo}
      </p>
      <div className="flex flex-wrap gap-2">
        {itens.slice(0, 16).map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-secondary"
          >
            <LinkIcon url={l.url} icon={l.icon} label={l.label} className="size-4 shrink-0" />
            <span className="line-clamp-1 text-xs font-medium text-foreground">{l.label}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const { me } = usePortal();
  const comunicados = useAsync(() => api.comunicados.list());
  const agenda = useAsync(() => api.agenda());
  const eventos = useAsync(() => api.eventos.list());
  const aniversariantes = useAsync(() => api.aniversariantes.list());
  const links = useAsync(() => api.links.list(me?.email), [me?.email]);
  // Atalhos da EMPRESA publicados pelo admin (já filtrados por perfil no backend):
  // devem aparecer no Acesso rápido junto com os atalhos pessoais do colaborador.
  const atalhos = useAsync(() => api.atalhos.list(), []);
  const [semanaAberta, setSemanaAberta] = React.useState(false);

  // Acesso rápido separado em dois grupos (feedback do usuário):
  //  - "Da empresa/equipe": atalhos institucionais publicados pelo admin, filtrados pelo
  //    perfil (no backend) E pelo departamento do colaborador (aqui, como nos comunicados).
  //  - "Meus atalhos": os links pessoais do colaborador.
  // Dedup por URL: um atalho pessoal que repita um institucional não aparece duas vezes.
  const { institucionais, pessoais } = React.useMemo(() => {
    const vistos = new Set<string>();
    const dedup = (lista: typeof links.data) => {
      const out: NonNullable<typeof links.data> = [];
      for (const l of lista ?? []) {
        const chave = (l.url || "").trim().toLowerCase();
        if (!chave || vistos.has(chave)) continue;
        vistos.add(chave);
        out.push(l);
      }
      return out;
    };
    const institucionais = dedup(
      (atalhos.data ?? []).filter((a) => atalhoVisivelPorDepto(a, me?.area)),
    );
    const pessoais = dedup(links.data);
    return { institucionais, pessoais };
  }, [atalhos.data, links.data, me?.area]);
  const temAtalhos = institucionais.length > 0 || pessoais.length > 0;

  // Agrupa os atalhos institucionais por DEPARTAMENTO: cada departamento vira uma seção
  // "Links úteis <departamento>" (ex.: "Links úteis AMS", "Links úteis Projetos"). Os que
  // valem para todos (sem departamento) ficam numa seção geral "Links úteis". Um atalho com
  // vários departamentos aparece em cada seção correspondente.
  const gruposInstitucionais = React.useMemo(() => {
    const geral: LinkUtil[] = [];
    const porDepto = new Map<string, LinkUtil[]>();
    for (const a of institucionais) {
      const deptos = (a.departamentos ?? []).map((d) => d.trim()).filter(Boolean);
      if (deptos.length === 0) {
        geral.push(a);
        continue;
      }
      for (const d of deptos) {
        const arr = porDepto.get(d);
        if (arr) arr.push(a);
        else porDepto.set(d, [a]);
      }
    }
    const grupos: { titulo: string; itens: LinkUtil[] }[] = [];
    if (geral.length) grupos.push({ titulo: "Links úteis", itens: geral });
    for (const [depto, itens] of [...porDepto.entries()].sort((a, b) =>
      a[0].localeCompare(b[0], "pt-BR"),
    )) {
      grupos.push({ titulo: `Links úteis ${depto}`, itens });
    }
    return grupos;
  }, [institucionais]);

  // Aniversariantes do MÊS corrente (a API devolve o ano inteiro ordenado por mês/dia;
  // o painel da home mostra só quem faz aniversário neste mês, ordenado por dia).
  const mesCorrente = new Date().getMonth() + 1;
  const aniversariantesDoMes = (aniversariantes.data ?? [])
    .filter((p) => p.mes === mesCorrente)
    .sort((a, b) => a.dia - b.dia);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Coluna principal (esquerda): acesso rápido + comunicados + eventos, empilhados */}
      <div className="space-y-6 lg:col-span-2">
        {/* Acesso rápido (limitado à largura desta coluna; quebra pra baixo) */}
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Acesso rápido</h2>
          {links.loading || atalhos.loading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-28 rounded-lg" />
              ))}
            </div>
          ) : !temAtalhos ? (
            <LinhaVazia texto="Nenhum atalho cadastrado." />
          ) : (
            <div className="space-y-4">
              {gruposInstitucionais.map((g) => (
                <GrupoAtalhos key={g.titulo} titulo={g.titulo} itens={g.itens} />
              ))}
              <GrupoAtalhos titulo="Meus atalhos" itens={pessoais} />
            </div>
          )}
        </section>

        {/* Comunicados */}
        <Painel title="Comunicados recentes" icon={Megaphone} to="/comunicados">
            {comunicados.loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : (comunicados.data ?? []).length === 0 ? (
              <LinhaVazia texto="Nenhum comunicado publicado." />
            ) : (
              <ul className="divide-y divide-border">
                {(comunicados.data ?? []).slice(0, 3).map((c) => (
                  <li key={c.id} className="first:pt-0 last:pb-0">
                    <Link
                      to={`/comunicados/${c.id}`}
                      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-secondary/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <CategoriaBadge categoria={c.categoria} />
                          {c.fixado && <Pin className="size-3 text-primary" />}
                        </div>
                        <h3 className="truncate font-medium text-foreground">{c.titulo}</h3>
                        {c.resumo && (
                          <p className="line-clamp-1 text-sm text-muted-foreground">{c.resumo}</p>
                        )}
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.autor} · {tempoRelativo(c.publicadoEm)}
                        </p>
                      </div>
                      {c.imagens?.[0] && (
                        <img
                          src={c.imagens[0]}
                          alt=""
                          loading="lazy"
                          className="size-24 shrink-0 rounded-lg border border-border object-cover shadow-sm"
                        />
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
        </Painel>

        {/* Próximos eventos — grudado logo abaixo de comunicados */}
        <Painel title="Próximos eventos" icon={CalendarDays} to="/eventos">
            {eventos.loading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-lg" />
                ))}
              </div>
            ) : (eventos.data ?? []).length === 0 ? (
              <LinhaVazia texto="Nenhum evento agendado." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {(eventos.data ?? []).slice(0, 4).map((e) => (
                  <Link
                    key={e.id}
                    to={`/eventos/${e.id}`}
                    className="flex gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-secondary/60"
                  >
                    {e.imagem ? (
                      <img
                        src={e.imagem}
                        alt={e.titulo}
                        loading="lazy"
                        className="size-12 shrink-0 rounded-md border border-border object-cover"
                      />
                    ) : (
                      <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-primary/15 py-1.5 text-center text-primary">
                        <span className="text-base font-bold leading-none">{new Date(e.inicio).getDate()}</span>
                        <span className="text-[10px] uppercase">{dataLonga(e.inicio).split(" de ")[1]?.slice(0, 3)}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-foreground">{e.titulo}</h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {faixaHorario(e.inicio, e.fim)}
                        {e.local && ` | ${e.local}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
        </Painel>
      </div>

      {/* Coluna lateral (direita): próxima reunião + agenda + aniversariantes */}
      <div className="space-y-4">
        <NextMeetingCard />

        <Painel
          title="Minha agenda"
          icon={CalendarClock}
          acao={
            (agenda.data ?? []).length > 0 ? (
              <button
                type="button"
                onClick={() => setSemanaAberta(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Ver mais <ArrowRight className="size-3" />
              </button>
            ) : undefined
          }
        >
          {agenda.loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : (agenda.data ?? []).length === 0 ? (
            <LinhaVazia texto="Sem compromissos próximos." />
          ) : (
            <ul className="space-y-3">
              {(agenda.data ?? []).slice(0, 3).map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-secondary py-1.5 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground">{diaSemana(a.inicio).slice(0, 3)}</span>
                    <span className="text-sm font-semibold text-foreground">{faixaHorario(a.inicio).split(":")[0]}h</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-foreground">{a.titulo}</h3>
                    <p className="truncate text-xs text-muted-foreground">
                      {faixaHorario(a.inicio, a.fim)}
                      {(a.local || a.online) && ` | ${a.online ? "Online" : a.local}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Painel>

        {/* Aniversariantes — SÓ os do mês corrente (a lista da API traz o ano inteiro). */}
        <Painel title={`Aniversariantes de ${mesAtualNome()}`} icon={Cake} to="/aniversariantes">
          {aniversariantes.loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : aniversariantesDoMes.length === 0 ? (
            <LinhaVazia texto="Nenhum aniversariante este mês." />
          ) : (
            <ul className="space-y-3">
              {aniversariantesDoMes.slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar className="size-9 shrink-0">
                    {p.fotoUrl && <AvatarImage src={p.fotoUrl} alt={p.nome} />}
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {iniciais(p.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-foreground">{p.nome}</h3>
                    <p className="truncate text-xs text-muted-foreground">{p.area}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
                    {String(p.dia).padStart(2, "0")}/{String(p.mes).padStart(2, "0")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Painel>
      </div>

      <AgendaSemanaDialog open={semanaAberta} onOpenChange={setSemanaAberta} itens={agenda.data ?? []} />
    </div>
  );
}
