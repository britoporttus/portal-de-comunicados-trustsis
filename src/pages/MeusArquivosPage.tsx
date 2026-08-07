// MEUS ARQUIVOS — navegação READ-ONLY no OneDrive PESSOAL de quem está logado.
//
// Nada de upload/renomear/excluir: o portal só LISTA a pasta e o arquivo abre no
// OneDrive/Office (webUrl). O backend resolve a identidade pelo token, então cada
// colaborador alcança apenas o próprio drive — não existe "ver o drive do outro".
//
// A API (`api.meuDrive.list`) devolve UMA pasta por vez e NÃO manda o caminho completo,
// então a trilha (breadcrumb) é mantida aqui como uma PILHA de pastas visitadas: navegar
// para dentro empilha, clicar num nível da trilha corta a pilha até ali.
import { useState } from "react";
import {
  HardDrive, RefreshCw, Folder, ChevronRight, ShieldAlert, Clock,
  FileText, FileSpreadsheet, Presentation, FileImage, File as FileIcon,
} from "lucide-react";
import { api } from "@/lib/api";
import type { ArquivoPessoal } from "@/lib/types";
import { tempoRelativo } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { cn } from "@/lib/utils";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

/** Ícone por tipo de arquivo (o rótulo vem pronto do backend: PDF, Word, Excel…).
 *  Mesma tabela do DocsLista — mantida local porque lá o helper não é exportado. */
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

/** Um nível da trilha: a raiz não tem id (sem `pastaId` a API devolve a raiz do drive). */
interface Nivel {
  id?: string;
  nome: string;
}

const RAIZ: Nivel = { nome: "Meus arquivos" };

export default function MeusArquivosPage() {
  const { me } = usePortal();
  const upn = me?.email;
  const [trilha, setTrilha] = useState<Nivel[]>([RAIZ]);
  const atual = trilha[trilha.length - 1];
  const naRaiz = trilha.length === 1;

  // Recarrega ao trocar de pasta: a chave da dependência é o id do nível atual.
  const { data, loading, error, reload } = useAsync(
    () => api.meuDrive.list(atual.id, upn),
    [atual.id, upn],
  );

  const itens = data?.itens ?? [];
  const recentes = naRaiz ? (data?.recentes ?? []) : [];

  /** Entra numa pasta empilhando o nível (o nome vem do próprio item clicado). */
  const abrirPasta = (item: ArquivoPessoal) =>
    setTrilha((t) => [...t, { id: item.id, nome: item.nome }]);

  /** Volta para um nível já visitado cortando a pilha (índice 0 = raiz). */
  const voltarPara = (indice: number) => setTrilha((t) => t.slice(0, indice + 1));

  return (
    <div>
      <PageHeader
        icon={HardDrive}
        title="Meus arquivos"
        description="Seu OneDrive pessoal, somente leitura — o portal apenas lista as pastas; o arquivo abre no OneDrive/Office."
        action={
          <Button variant="ghost" size="sm" onClick={() => reload()} disabled={loading}>
            <RefreshCw className={cn("size-4", loading && "animate-spin")} /> Atualizar
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Trilha: só faz sentido mostrar quando há para onde voltar. */}
        {trilha.length > 1 && (
          <Breadcrumb>
            <BreadcrumbList>
              {trilha.map((nivel, i) => {
                const ultimo = i === trilha.length - 1;
                return (
                  <BreadcrumbItem key={`${nivel.id ?? "raiz"}-${i}`}>
                    {ultimo ? (
                      <BreadcrumbPage className="font-medium">{nivel.nome}</BreadcrumbPage>
                    ) : (
                      <>
                        <BreadcrumbLink
                          render={
                            <button type="button" onClick={() => voltarPara(i)}>
                              {nivel.nome}
                            </button>
                          }
                        />
                        <BreadcrumbSeparator>
                          <ChevronRight />
                        </BreadcrumbSeparator>
                      </>
                    )}
                  </BreadcrumbItem>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
        )}

        {/* Instrução PRONTA do backend (ex.: falta consentimento Files.Read.All no Entra):
            exibida como veio, sem reescrever a mensagem. */}
        {data?.erro && (
          <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
            <p className="text-sm text-warning">{data.erro}</p>
          </div>
        )}

        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <EmptyState
            icon={ShieldAlert}
            title="Não foi possível carregar seus arquivos"
            description={error}
          />
        ) : data?.demo ? (
          // Preview sem Graph: não existe OneDrive real para listar (e não inventamos arquivos).
          <EmptyState
            icon={HardDrive}
            title="Sem OneDrive neste ambiente"
            description="No preview o portal roda sem conexão com o Microsoft 365, então não há OneDrive pessoal para listar. Com o Graph configurado, seus arquivos aparecem aqui."
          />
        ) : (
          <>
            {recentes.length > 0 && <Recentes itens={recentes} />}

            {itens.length === 0 ? (
              <EmptyState
                icon={Folder}
                title="Nada por aqui"
                description={
                  naRaiz
                    ? "Seu OneDrive não tem arquivos nem pastas na raiz."
                    : "Esta pasta está vazia."
                }
              />
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                {/* O backend já ordena pastas primeiro. */}
                {itens.map((item) =>
                  item.pasta ? (
                    <LinhaPasta key={item.id} item={item} onAbrir={() => abrirPasta(item)} />
                  ) : (
                    <LinhaArquivo key={item.id} item={item} />
                  ),
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** Recentes: atalho para os últimos arquivos mexidos (só a raiz traz esta lista). */
function Recentes({ itens }: { itens: ArquivoPessoal[] }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Clock className="size-3.5" /> Recentes
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {itens.map((item) => {
          const Icon = iconeDoTipo(item.tipo);
          return (
            <a
              key={`recente-${item.id}`}
              href={item.webUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2 shadow-sm transition-colors hover:border-primary/40 hover:bg-accent/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{item.nome}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {item.tipo ?? "Arquivo"}
                  {item.atualizadoEm ? ` · atualizado ${tempoRelativo(item.atualizadoEm)}` : ""}
                </span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}

/** Pasta: botão que navega para dentro (a linha inteira é clicável). */
function LinhaPasta({ item, onAbrir }: { item: ArquivoPessoal; onAbrir: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onAbrir}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Folder className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{item.nome}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            Pasta
            {typeof item.itens === "number" ? ` · ${item.itens} item(ns)` : ""}
            {item.atualizadoEm ? ` · atualizada ${tempoRelativo(item.atualizadoEm)}` : ""}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </button>
    </li>
  );
}

/** Arquivo: link direto para o OneDrive/Office (read-only, abre em outra aba). */
function LinhaArquivo({ item }: { item: ArquivoPessoal }) {
  const Icon = iconeDoTipo(item.tipo);
  const tam = tamanhoLegivel(item.tamanho);
  return (
    <li>
      <a
        href={item.webUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{item.nome}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {item.tipo ?? "Arquivo"}
            {tam ? ` · ${tam}` : ""}
            {item.atualizadoEm ? ` · atualizado ${tempoRelativo(item.atualizadoEm)}` : ""}
          </span>
        </span>
      </a>
    </li>
  );
}
