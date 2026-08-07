// Políticas de utilização interna. NÃO são cadastradas no portal: são os documentos reais
// compartilhados com todos os colaboradores numa pasta do SharePoint/OneDrive. Esta página
// apenas LISTA (read-only) esse conteúdo via Microsoft Graph e abre cada arquivo no
// SharePoint. Cada subpasta vira uma categoria; arquivos na raiz caem em "Geral".
// A apresentação dos arquivos vive em components/portal/DocsLista (compartilhada com as
// Bibliotecas de documentos, que usam o mesmo motor no backend).
import { ScrollText } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { DocsLista } from "@/components/portal/DocsLista";

export default function PoliticasPage() {
  const { isAdmin } = usePortal();
  const { data, loading } = useAsync(() => api.politicas.list(), []);

  const docs = data ?? [];

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
              ? "As políticas são lidas de uma pasta compartilhada do SharePoint/OneDrive. Informe o link da pasta em Administração › Integração para que os documentos apareçam aqui."
              : "As políticas internas aparecerão aqui assim que forem publicadas na pasta compartilhada."
          }
        />
      ) : (
        <DocsLista docs={docs} />
      )}
    </div>
  );
}
