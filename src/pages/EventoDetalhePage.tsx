// Detalhe de um evento: foto/descrição completa. Acessado pela home (card clicável)
// ou pelo título na lista de eventos.
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { diaSemana, dataLonga, faixaHorario } from "@/lib/format";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Badge } from "@/components/ui/badge";
import { BotaoAgenda } from "@/components/portal/BotaoAgenda";
import { TIPO_META } from "./EventosPage";

export default function EventoDetalhePage() {
  const { id = "" } = useParams();
  const { data: e, loading, error } = useAsync(() => api.eventos.get(id), [id]);

  const meta = e ? TIPO_META[e.tipo] : null;
  const Icon = meta?.icon;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/eventos"
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-secondary hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Voltar aos eventos
      </Link>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error || !e ? (
        <EmptyState
          icon={CalendarDays}
          title="Evento não encontrado"
          description="Ele pode ter sido removido. Volte à lista de eventos."
        />
      ) : (
        <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {e.imagem && (
            // Banner: mostra a imagem INTEIRA (object-contain, sem corte) sobre uma cópia
            // borrada dela mesma — preenche a moldura sem faixas vazias, seja qual for a
            // proporção do arquivo enviado.
            <div className="relative flex max-h-96 items-center justify-center overflow-hidden border-b border-border bg-secondary">
              <img
                src={e.imagem}
                alt=""
                aria-hidden
                className="pointer-events-none absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl"
              />
              <img
                src={e.imagem}
                alt={e.titulo}
                className="relative max-h-96 w-auto max-w-full object-contain"
              />
            </div>
          )}
          <div className="p-6">
            {meta && Icon && (
              <Badge className={`mb-2 gap-1 border-transparent ${meta.className}`}>
                <Icon className="size-3" />
                {meta.label}
              </Badge>
            )}
            <h1 className="text-2xl font-bold text-foreground">{e.titulo}</h1>

            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-4" />
                <span className="capitalize">{diaSemana(e.inicio)}</span>, {dataLonga(e.inicio)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-4" />
                {faixaHorario(e.inicio, e.fim)}
              </span>
              {e.local && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" />
                  {e.local}
                </span>
              )}
            </div>

            {e.descricao && (
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {e.descricao}
              </p>
            )}

            {/* Fase 3: leva o evento para o calendário do Outlook de quem está lendo. */}
            <div className="mt-5 border-t border-border pt-4">
              <BotaoAgenda evento={e} />
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
