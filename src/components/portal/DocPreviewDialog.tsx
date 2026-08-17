// Pop-up de PRÉ-VISUALIZAÇÃO de um documento do SharePoint/OneDrive dentro do portal.
// Em vez de abrir o arquivo em outra aba (SharePoint), o documento aparece embutido num
// iframe (link temporário de visualização do Graph). Sem preview disponível — ou fora do
// Graph (preview/demo) — cai limpo para o link "Abrir no SharePoint".
//
// O carregamento da URL é injetado (`carregarUrl`) para o mesmo diálogo servir tanto às
// Bibliotecas (Documentos) quanto a qualquer outra pasta compartilhada no futuro.
import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import type { PoliticaDoc } from "@/lib/types";
import { dataLonga } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface DocPreviewDialogProps {
  /** Documento aberto (null = diálogo fechado). */
  doc: PoliticaDoc | null;
  onOpenChange: (v: boolean) => void;
  /** Busca o link embutível do documento (devolve null quando não há preview). */
  carregarUrl: (doc: PoliticaDoc) => Promise<string | null>;
}

export function DocPreviewDialog({ doc, onOpenChange, carregarUrl }: DocPreviewDialogProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!doc) return;
    let vivo = true;
    setUrl(null);
    setCarregando(true);
    carregarUrl(doc)
      .then((u) => vivo && setUrl(u))
      .catch(() => vivo && setUrl(null))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
    // carregarUrl é estável o suficiente (recriado por render, mas só reexecuta ao trocar doc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc]);

  return (
    <Dialog open={Boolean(doc)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[min(96vw,1000px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle className="pr-8">{doc?.nome}</DialogTitle>
          <DialogDescription>
            {doc?.tipo ?? "Arquivo"}
            {doc?.atualizadoEm ? ` · Atualizado em ${dataLonga(doc.atualizadoEm)}` : ""}
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
              <p className="max-w-md text-sm text-muted-foreground">
                A pré-visualização não está disponível para este documento. Abra-o no SharePoint
                para visualizar.
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
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
