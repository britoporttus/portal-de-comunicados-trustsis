// Políticas de utilização interna. Os documentos NÃO são cadastrados no portal: são os
// arquivos reais compartilhados numa pasta do SharePoint/OneDrive, listados read-only via
// Microsoft Graph (cada subpasta vira uma categoria).
//
// FASE 4 — leitura obrigatória: o admin marca quais documentos EXIGEM confirmação; o
// colaborador lê o documento num pop-up (preview do Graph, com fallback para o SharePoint) e
// registra "Li e concordo". A confirmação é por usuário+documento, idempotente, e pontua uma
// única vez. As pendências sobem para o topo da lista e aparecem num aviso no cabeçalho.
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollText, ShieldAlert, Check, ExternalLink, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { PoliticaDoc } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { dataLonga } from "@/lib/format";
import { Link } from "react-router-dom";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { DocsLista } from "@/components/portal/DocsLista";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

export default function PoliticasPage() {
  const { me, isAdmin, pode } = usePortal();
  const podeExigir = pode("politicas", "editar");
  const { data, loading, reload } = useAsync(() => api.politicas.list(me?.email), [me?.email]);

  const docs = useMemo(() => data ?? [], [data]);
  const pendentes = docs.filter((d) => d.obrigatoria && !d.confirmadoEm);

  // Documento aberto no pop-up de leitura.
  const [aberto, setAberto] = useState<PoliticaDoc | null>(null);

  const alternarObrigatoria = useCallback(
    async (d: PoliticaDoc) => {
      await api.politicas.definirObrigatoria(d.id, !d.obrigatoria, d.nome, me?.email);
      await reload();
    },
    [me?.email, reload],
  );

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        eyebrow="Governança"
        title="Políticas internas"
        description="Documentos oficiais compartilhados no SharePoint — leitura para todos os colaboradores"
      />

      {/* Aviso de pendência: o colaborador precisa saber, ao entrar, o que falta confirmar. */}
      {pendentes.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
          <ShieldAlert className="size-5 shrink-0 text-warning" />
          <p className="flex-1 text-sm text-foreground">
            Você tem <strong>{pendentes.length}</strong>{" "}
            {pendentes.length === 1 ? "política pendente" : "políticas pendentes"} de leitura
            obrigatória.
          </p>
          <Button size="sm" onClick={() => setAberto(pendentes[0])}>
            Ler agora
          </Button>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhum documento disponível"
          description={
            isAdmin
              ? "As políticas são lidas de uma pasta compartilhada do SharePoint/OneDrive. Informe o link da pasta em Administração › Integração para que os documentos apareçam aqui."
              : "As políticas internas aparecerão aqui assim que forem publicadas na pasta compartilhada."
          }
          action={
            isAdmin ? (
              <Button size="sm" render={<Link to="/admin?tab=integracao" />}>
                Cadastrar link da pasta
              </Button>
            ) : undefined
          }
        />
      ) : (
        <DocsLista
          docs={docs}
          onAbrir={(d) => setAberto(d)}
          badge={(d) =>
            d.obrigatoria ? (
              d.confirmadoEm ? (
                <Badge variant="outline" className="gap-1 border-primary/40 bg-primary/10 text-primary">
                  <Check className="size-3" /> Leitura confirmada
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-warning/40 bg-warning/10 text-warning">
                  <ShieldAlert className="size-3" /> Leitura obrigatória
                </Badge>
              )
            ) : null
          }
          acoes={(d) =>
            podeExigir ? (
              <label className="hidden shrink-0 items-center gap-2 text-[11px] text-muted-foreground sm:flex">
                <Switch
                  checked={Boolean(d.obrigatoria)}
                  onCheckedChange={() => void alternarObrigatoria(d)}
                  aria-label={`Exigir leitura de ${d.nome}`}
                />
                Exigir leitura
                {d.confirmacoes ? <span className="text-foreground">({d.confirmacoes})</span> : null}
              </label>
            ) : null
          }
        />
      )}

      <LeituraDialog
        doc={aberto}
        onOpenChange={(v) => !v && setAberto(null)}
        onConfirmado={async () => {
          setAberto(null);
          await reload();
        }}
        upn={me?.email}
      />
    </div>
  );
}

/** Pop-up de leitura: mostra o documento embutido (link temporário do Graph) e, quando a
 *  política é obrigatória, oferece o "Li e concordo". Sem preview disponível, o pop-up cai
 *  para o link do SharePoint — a confirmação continua possível. */
function LeituraDialog({
  doc,
  upn,
  onOpenChange,
  onConfirmado,
}: {
  doc: PoliticaDoc | null;
  upn?: string;
  onOpenChange: (v: boolean) => void;
  onConfirmado: () => void | Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!doc) return;
    let vivo = true;
    setUrl(null);
    setCarregando(true);
    api.politicas
      .preview(doc.id)
      .then((r) => vivo && setUrl(r.url))
      .catch(() => vivo && setUrl(null))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [doc]);

  const confirmar = async () => {
    if (!doc) return;
    setConfirmando(true);
    try {
      await api.politicas.confirmar(doc.id, upn);
      await onConfirmado();
    } finally {
      setConfirmando(false);
    }
  };

  return (
    <Dialog open={Boolean(doc)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,1000px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="pr-8">{doc?.nome}</DialogTitle>
          <DialogDescription>
            {doc?.obrigatoria
              ? doc.confirmadoEm
                ? `Leitura confirmada em ${dataLonga(doc.confirmadoEm)}.`
                : "Este documento exige confirmação de leitura."
              : "Documento publicado no SharePoint."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[45vh] flex-1 bg-secondary">
          {carregando ? (
            <div className="grid h-full place-items-center py-16 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Carregando documento…
              </span>
            </div>
          ) : url ? (
            <iframe
              src={url}
              title={doc?.nome ?? "Documento"}
              className="h-[60vh] w-full border-0 bg-background"
            />
          ) : (
            <div className="grid h-full place-items-center gap-3 px-6 py-16 text-center">
              <p className="text-sm text-muted-foreground">
                A pré-visualização não está disponível para este documento. Abra-o no SharePoint
                para ler e volte aqui para confirmar.
              </p>
              {doc && (
                <Button
                  variant="outline"
                  size="sm"
                  render={
                    <a href={doc.webUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="size-4" /> Abrir no SharePoint
                    </a>
                  }
                />
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border p-4">
          {doc && (
            <Button
              variant="ghost"
              size="sm"
              render={
                <a href={doc.webUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> Abrir no SharePoint
                </a>
              }
            />
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {doc?.obrigatoria && !doc.confirmadoEm && (
              <Button size="sm" onClick={confirmar} disabled={confirmando}>
                <Check className="size-4" /> {confirmando ? "Registrando…" : "Li e concordo"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
