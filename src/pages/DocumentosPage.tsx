// DOCUMENTOS (Fase 2 do PLANO-INTRANET.md) — bibliotecas de documentos do SharePoint/OneDrive.
//
// Cada biblioteca é uma PASTA COMPARTILHADA (Marketing, Templates, Institucional…) cadastrada
// pelo admin em Administração › Bibliotecas — nada de env por pasta e nada de upload: os
// arquivos continuam morando no SharePoint, o portal só lista (read-only) e abre lá.
// Mesmo motor das Políticas internas (graph.ts › listarDocsDoShare); cada subpasta = categoria.
import { useState } from "react";
import { FolderOpen, RefreshCw, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import type { Biblioteca } from "@/lib/types";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { DocsLista } from "@/components/portal/DocsLista";
import { RestritoBadge } from "@/components/portal/PerfisPicker";
import { BibliotecaIcone } from "@/components/portal/shared";
import { Button } from "@/components/ui/button";

export default function DocumentosPage() {
  const { isAdmin } = usePortal();
  const { data: bibliotecas, loading } = useAsync(() => api.bibliotecas.list(), []);
  // Guarda apenas a escolha EXPLÍCITA do usuário: a biblioteca aberta é derivada
  // (escolhida ?? primeira da lista), o que abre a primeira automaticamente sem precisar
  // de um efeito que sincroniza estado — e sem piscar entre o carregamento e o clique.
  const [escolhida, setEscolhida] = useState<string | null>(null);

  const lista = bibliotecas ?? [];
  const selecionada = lista.find((b) => b.id === escolhida) ?? lista[0] ?? null;
  const selId = selecionada?.id ?? null;

  return (
    <div>
      <PageHeader
        icon={FolderOpen}
        title="Documentos"
        description="Bibliotecas compartilhadas no SharePoint — modelos, materiais e documentos oficiais"
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : lista.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nenhuma biblioteca publicada"
          description={
            isAdmin
              ? "Cadastre as pastas do SharePoint/OneDrive em Administração › Bibliotecas — cada pasta compartilhada vira uma biblioteca aqui."
              : "As bibliotecas de documentos aparecerão aqui assim que forem publicadas."
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lista.map((b) => (
              <CardBiblioteca
                key={b.id}
                biblioteca={b}
                ativa={b.id === selId}
                onClick={() => setEscolhida(b.id)}
              />
            ))}
          </div>

          {selecionada && <DocsDaBiblioteca biblioteca={selecionada} />}
        </div>
      )}
    </div>
  );
}

function CardBiblioteca({ biblioteca: b, ativa, onClick }: {
  biblioteca: Biblioteca;
  ativa: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors",
        ativa ? "border-primary/50 ring-1 ring-primary/30" : "border-border hover:border-primary/40",
      )}
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <BibliotecaIcone nome={b.icone} className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate font-semibold text-foreground">{b.nome}</span>
          <RestritoBadge perfis={b.perfis} />
        </span>
        {b.descricao && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{b.descricao}</span>
        )}
      </span>
    </button>
  );
}

/** Arquivos da biblioteca escolhida (lidos do Graph; o servidor cacheia por alguns minutos). */
function DocsDaBiblioteca({ biblioteca }: { biblioteca: Biblioteca }) {
  const [forcando, setForcando] = useState(false);
  const { data, loading, reload } = useAsync(
    () => api.bibliotecas.docs(biblioteca.id, forcando),
    [biblioteca.id],
  );
  const docs = data ?? [];

  const atualizar = async () => {
    setForcando(true);
    try {
      await reload();
    } finally {
      setForcando(false);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{biblioteca.nome}</h3>
          <p className="text-xs text-muted-foreground">
            {loading ? "Carregando arquivos…" : `${docs.length} arquivo(s) nesta biblioteca`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={atualizar} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Atualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={
              <a href={biblioteca.shareUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Abrir no SharePoint
              </a>
            }
          />
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Biblioteca vazia"
          description="Nenhum arquivo encontrado nesta pasta. Verifique se o link de compartilhamento aponta para a pasta certa e se o app tem permissão Sites.Read.All."
        />
      ) : (
        <DocsLista docs={docs} />
      )}
    </section>
  );
}
