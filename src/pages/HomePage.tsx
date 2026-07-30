// Página inicial (dashboard): acesso rápido + comunicados, agenda, eventos e aniversariantes.
import { Link } from "react-router-dom";
import {
  Megaphone, CalendarDays, Cake, CalendarClock, ArrowRight, MapPin, Video, Pin,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import {
  dataLonga, diaSemana, faixaHorario, tempoRelativo, mesAtualNome, iniciais,
} from "@/lib/format";
import { LinkIcon, CategoriaBadge } from "@/components/portal/shared";
import { NextMeetingCard } from "@/components/portal/NextMeetingCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePortal } from "@/context/PortalProvider";

function Painel({
  title, icon: Icon, to, children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
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

export default function HomePage() {
  const { me } = usePortal();
  const comunicados = useAsync(() => api.comunicados.list());
  const agenda = useAsync(() => api.agenda());
  const eventos = useAsync(() => api.eventos.list());
  const aniversariantes = useAsync(() => api.aniversariantes.list());
  const links = useAsync(() => api.links.list(me?.email), [me?.email]);

  return (
    <div className="space-y-6">
      {/* Acesso rápido */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Acesso rápido</h2>
        {links.loading ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : (links.data ?? []).length === 0 ? (
          <LinhaVazia texto="Nenhum atalho cadastrado." />
        ) : (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-12">
            {(links.data ?? []).slice(0, 16).map((l) => (
              <a
                key={l.id}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card/80 p-1.5 text-center shadow-sm backdrop-blur-sm transition-colors hover:border-primary/40 hover:bg-secondary"
              >
                <span className="flex size-6 items-center justify-center rounded-md bg-secondary">
                  <LinkIcon url={l.url} icon={l.icon} label={l.label} className="size-4" />
                </span>
                <span className="line-clamp-1 text-[10px] font-medium text-foreground">{l.label}</span>
              </a>
            ))}
          </div>
        )}
      </section>

      {/* Grade principal */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Comunicados */}
        <div className="lg:col-span-2">
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
                {(comunicados.data ?? []).slice(0, 5).map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
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
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </div>

        {/* Próxima reunião + Agenda */}
        <div className="space-y-4">
          <NextMeetingCard />
          <Painel title="Minha agenda" icon={CalendarClock}>
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
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-foreground">{a.titulo}</h3>
                    <p className="text-xs text-muted-foreground">{faixaHorario(a.inicio, a.fim)}</p>
                    {(a.local || a.online) && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        {a.online ? <Video className="size-3" /> : <MapPin className="size-3" />}
                        {a.online ? "Online" : a.local}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          </Painel>
        </div>

        {/* Próximos eventos */}
        <div className="lg:col-span-2">
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
                  <div key={e.id} className="flex gap-3 rounded-lg border border-border p-3">
                    <div className="flex w-12 shrink-0 flex-col items-center rounded-md bg-primary/15 py-1.5 text-center text-primary">
                      <span className="text-base font-bold leading-none">{new Date(e.inicio).getDate()}</span>
                      <span className="text-[10px] uppercase">{dataLonga(e.inicio).split(" de ")[1]?.slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-foreground">{e.titulo}</h3>
                      <p className="text-xs text-muted-foreground">{faixaHorario(e.inicio, e.fim)}</p>
                      {e.local && (
                        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3" /> {e.local}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Painel>
        </div>

        {/* Aniversariantes */}
        <Painel title={`Aniversariantes de ${mesAtualNome()}`} icon={Cake} to="/aniversariantes">
          {aniversariantes.loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : (aniversariantes.data ?? []).length === 0 ? (
            <LinhaVazia texto="Nenhum aniversariante este mês." />
          ) : (
            <ul className="space-y-3">
              {(aniversariantes.data ?? []).slice(0, 3).map((p) => (
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
    </div>
  );
}
