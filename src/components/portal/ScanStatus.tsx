// Mostra quando o organograma/férias foram sincronizados pela última vez (scan diário)
// e, para admin, um botão "Atualizar agora" que força um novo scan do Graph.
// Só aparece com Graph ligado (produção) — em demo o scan não roda.
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { tempoRelativo } from "@/lib/format";
import { usePortal } from "@/context/PortalProvider";
import { Button } from "@/components/ui/button";

export function ScanStatus({ onRefreshed }: { onRefreshed?: () => void | Promise<void> }) {
  const { isAdmin } = usePortal();
  const { data, reload } = useAsync(() => api.scan.status());
  const [rodando, setRodando] = useState(false);

  // Sem Graph (preview/demo) não há scan — não exibe nada.
  if (!data?.graph) return null;

  const atualizar = async () => {
    setRodando(true);
    try {
      await api.scan.run();
      await reload();
      await onRefreshed?.();
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span>
        {data.atualizadoEm
          ? `Atualizado ${tempoRelativo(data.atualizadoEm)}`
          : "Ainda não sincronizado"}
      </span>
      {isAdmin && (
        <Button size="xs" variant="outline" onClick={atualizar} disabled={rodando || data.rodando}>
          <RefreshCw className={"size-3.5" + (rodando || data.rodando ? " animate-spin" : "")} />
          {rodando || data.rodando ? "Atualizando…" : "Atualizar agora"}
        </Button>
      )}
    </div>
  );
}
