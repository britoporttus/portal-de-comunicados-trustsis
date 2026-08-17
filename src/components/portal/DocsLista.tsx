// Lista de DOCUMENTOS vindos de uma pasta compartilhada do SharePoint/OneDrive.
// Peça compartilhada entre as Políticas internas e as Bibliotecas de documentos (Fase 2):
// os dois recursos usam o MESMO motor no backend (graph.ts › listarDocsDoShare), então a
// apresentação também é uma só — cada subpasta vira uma seção (categoria).
import { useMemo, type ReactNode } from "react";
import {
  ExternalLink, FileText, FileSpreadsheet, Presentation, FileImage, File as FileIcon,
} from "lucide-react";
import type { PoliticaDoc } from "@/lib/types";
import { dataLonga } from "@/lib/format";
import { Button } from "@/components/ui/button";

/** Ícone por tipo de arquivo (o rótulo vem pronto do backend: PDF, Word, Excel…). */
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

interface DocsListaProps {
  docs: PoliticaDoc[];
  /** Selo exibido ao lado do nome (ex.: "Leitura obrigatória" nas políticas). */
  badge?: (d: PoliticaDoc) => ReactNode;
  /** Ações extras à direita, antes do botão de abrir (ex.: alternar obrigatoriedade). */
  acoes?: (d: PoliticaDoc) => ReactNode;
  /** Quando informado, "Abrir" vira um BOTÃO que chama isto (ex.: ler no modal) em vez de
   *  um link direto para o SharePoint. */
  onAbrir?: (d: PoliticaDoc) => void;
}

export function DocsLista({ docs, badge, acoes, onAbrir }: DocsListaProps) {
  // Agrupa por categoria (subpasta), mantendo a ordem já vinda da API (categoria, nome).
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
                    <div className="flex flex-wrap items-center gap-2">
                      {onAbrir ? (
                        <button
                          type="button"
                          onClick={() => onAbrir(d)}
                          className="truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline focus-visible:text-primary focus-visible:underline focus-visible:outline-none"
                        >
                          {d.nome}
                        </button>
                      ) : (
                        <a
                          href={d.webUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-sm font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {d.nome}
                        </a>
                      )}
                      {badge?.(d)}
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {d.tipo ?? "Arquivo"}
                      {tam ? ` · ${tam}` : ""}
                      {d.atualizadoEm ? ` · Atualizado em ${dataLonga(d.atualizadoEm)}` : ""}
                    </p>
                  </div>
                  {acoes?.(d)}
                  {onAbrir ? (
                    <Button variant="outline" size="sm" className="shrink-0" onClick={() => onAbrir(d)}>
                      <ExternalLink className="size-4" /> Abrir
                    </Button>
                  ) : (
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
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
