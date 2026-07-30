// Card compacto "Próxima reunião" exibido na coluna direita da Início, logo acima da agenda.
// Lê a agenda (Graph/calendarView) e destaca o próximo compromisso.
import { CalendarClock, MapPin, Video, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { diaSemana, faixaHorario } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

const OUTLOOK_CAL = "https://outlook.office.com/calendar/view/week";

export function NextMeetingCard() {
  const { data, loading } = useAsync(() => api.agenda());

  // Próximo compromisso: o primeiro que ainda não terminou (a agenda já vem ordenada).
  const proxima = (() => {
    const lista = data ?? [];
    const agora = Date.now();
    return lista.find((a) => +new Date(a.fim || a.inicio) >= agora) ?? lista[0];
  })();

  return (
    <aside className="w-full rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 shadow-sm backdrop-blur-sm">
      <div className="mb-1.5 flex items-center gap-1.5 text-primary">
        <CalendarClock className="size-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Próxima reunião</span>
      </div>

      {loading ? (
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
      ) : !proxima ? (
        <p className="text-xs text-muted-foreground">Sem reuniões próximas.</p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-foreground">
              {proxima.titulo}
            </h3>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-foreground/80">
              <span className="shrink-0 capitalize">
                {diaSemana(proxima.inicio).slice(0, 3)}, {faixaHorario(proxima.inicio, proxima.fim)}
              </span>
              {(proxima.local || proxima.online) && (
                <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground">
                  <span className="shrink-0 text-muted-foreground/50">|</span>
                  {proxima.online ? <Video className="size-3 shrink-0" /> : <MapPin className="size-3 shrink-0" />}
                  <span className="truncate">{proxima.online ? "Online" : proxima.local}</span>
                </span>
              )}
            </p>
          </div>
          <a
            href={OUTLOOK_CAL}
            target="_blank"
            rel="noreferrer"
            title="Ver no calendário"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowUpRight className="size-4" />
          </a>
        </div>
      )}
    </aside>
  );
}
