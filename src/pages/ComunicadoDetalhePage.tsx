// Detalhe de um comunicado: conteúdo COMPLETO + imagens. Acessado pela home (card
// clicável) ou pelo título na lista de comunicados.
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Megaphone, Pin, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { tempoRelativo } from "@/lib/format";
import { CategoriaBadge, PrioridadeBadge } from "@/components/portal/shared";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function ComunicadoDetalhePage() {
  const { id = "" } = useParams();
  const { data: c, loading, error } = useAsync(() => api.comunicados.get(id), [id]);
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/comunicados"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" /> Voltar aos comunicados
      </Link>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : error || !c ? (
        <EmptyState
          icon={Megaphone}
          title="Comunicado não encontrado"
          description="Ele pode ter sido removido. Volte à lista de comunicados."
        />
      ) : (
        <article className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <CategoriaBadge categoria={c.categoria} />
            <PrioridadeBadge prioridade={c.prioridade} />
            {c.obrigatorio && (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                <AlertTriangle className="size-3" /> Leitura obrigatória
              </span>
            )}
            {c.fixado && <Pin className="size-4 text-primary" />}
          </div>

          <h1 className="mt-3 text-2xl font-bold text-foreground">{c.titulo}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {c.autor} · {tempoRelativo(c.publicadoEm)}
          </p>

          {c.resumo && <p className="mt-4 text-base text-muted-foreground">{c.resumo}</p>}

          {c.conteudo && (
            <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {c.conteudo}
            </div>
          )}

          {(c.imagens ?? []).length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {(c.imagens ?? []).map((src, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setLightbox(src)}
                  className="overflow-hidden rounded-xl border border-border bg-secondary transition-opacity hover:opacity-90"
                >
                  <img
                    src={src}
                    alt={`Imagem ${i + 1} do comunicado`}
                    className="h-52 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </article>
      )}

      <Dialog open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)}>
        <DialogContent className="max-w-3xl border-none bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">Imagem do comunicado</DialogTitle>
          {lightbox && (
            <img
              src={lightbox}
              alt="Imagem do comunicado"
              className="max-h-[85vh] w-full rounded-xl object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
