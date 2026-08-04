// Políticas de utilização interna. NÃO são cadastradas no portal: são os documentos reais
// compartilhados com todos os colaboradores numa pasta do SharePoint/OneDrive. Esta página
// apenas LISTA (read-only) esse conteúdo via Microsoft Graph e abre cada arquivo no
// SharePoint. Cada subpasta vira uma categoria; arquivos na raiz caem em "Geral".
import { useMemo } from "react";
import {
  ScrollText, ExternalLink, FileText, FileSpreadsheet, Presentation, FileImage, File as FileIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import type { PoliticaDoc } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { dataLonga } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Button } from "@/components/ui/button";

/** Ícone por tipo de arquivo. */
function iconeDoTipo(tipo?: string) {
  switch (tipo) {
    case "Excel":
      return FileSpreadsheet;
    case "PowerPoint":
      return Presentation;
    case "Imagem":
      return FileImage;
    case "PDF":
    case "Word":
    case "Texto":
      return FileText;
    default:
      return FileIcon;
  }
}

/** Tamanho legível (KB/MB) a partir de bytes. */
function tamanhoLegivel(bytes?: number): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function PoliticasPage() {
  const { isAdmin } = usePortal();
  const { data, loading } = useAsync(() => api.politicas.list(), []);

  const docs = data ?? [];

  // Agrupa por categoria (subpasta), mantendo a ordem já vinda da API (categoria asc, nome asc).
  const grupos = useMemo(() => {
    const mapa = new Map<string, PoliticaDoc[]>();
    for (const d of docs) {
      const cat = d.categoria?.trim() || "Geral";
      const arr = mapa.get(cat);
      if (arr) arr.push(d);
      else mapa.set(cat, [d]);
    }
    return [...mapa.entries()];
  }, [docs]);

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title="Políticas internas"
        description="Documentos oficiais compartilhados no SharePoint — leitura para todos os colaboradores"
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhum documento disponível"
          description={
            isAdmin
              ? "As políticas são lidas de uma pasta compartilhada do SharePoint/OneDrive. Configure o link da pasta em POLITICAS_SHARE_URL (nas Configurações) para que os documentos apareçam aqui."
              : "As políticas internas aparecerão aqui assim que forem publicadas na pasta compartilhada."
          }
        />
      ) : (
        <div className="space-y-6">
          {grupos.map(([categoria, itens]) => (
            <section key={categoria}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {categoria}
              </h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                {itens.map((d) => {
                  const Icon = iconeDoTipo(d.tipo);
                  const tam = tamanhoLegivel(d.tamanho);
                  return (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{d.nome}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {d.tipo ?? "Arquivo"}
                          {tam ? ` · ${tam}` : ""}
                          {d.atualizadoEm ? ` · Atualizado em ${dataLonga(d.atualizadoEm)}` : ""}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        render={
                          <a href={d.webUrl} target="_blank" rel="noreferrer">
                            <ExternalLink className="size-4" /> Abrir
                          </a>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
