// Card compacto "Próxima reunião" exibido na coluna direita da Início, logo acima da agenda.
// Lê a agenda (Graph/calendarView) e destaca o próximo compromisso.
import { CalendarClock, MapPin, Video, ArrowUpRight } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { dataLonga, diaSemana, faixaHorario } from "@/lib/format";
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
    <aside className="flex w-full flex-col gap-1 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-primary">
        <CalendarClock className="size-3.5" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">Próxima reunião</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-4/5 rounded" />
          <Skeleton className="h-3 w-3/5 rounded" />
        </div>
      ) : !proxima ? (
        <p className="text-sm text-muted-foreground">Sem reuniões próximas.</p>
      ) : (
        <>
          <h3 className="line-clamp-1 text-sm font-semibold leading-snug text-foreground">
            {proxima.titulo}
          </h3>
          <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-foreground/80">
            <span>
              {diaSemana(proxima.inicio)}, {dataLonga(proxima.inicio).replace(/ de \d{4}$/, "")} ·{" "}
              {faixaHorario(proxima.inicio, proxima.fim)}
            </span>
            {(proxima.local || proxima.online) && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                {proxima.online ? <Video className="size-3" /> : <MapPin className="size-3" />}
                {proxima.online ? "Online" : proxima.local}
              </span>
            )}
          </p>
          <a
            href={OUTLOOK_CAL}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Ver no calendário <ArrowUpRight className="size-3.5" />
          </a>
        </>
      )}
    </aside>
  );
}
