// Badge de pontos no topbar: registra a VISITA DIÁRIA (1x/dia, dedup no backend) e mostra
// o total do usuário no mês + posição no ranking. Clique leva à página de Ranking.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy } from "lucide-react";
import { api } from "@/lib/api";
import { usePortal } from "@/context/PortalProvider";
import type { ResumoPontos } from "@/lib/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function PontosBadge() {
  const { me } = usePortal();
  const [resumo, setResumo] = useState<ResumoPontos | null>(null);

  useEffect(() => {
    let vivo = true;
    if (!me?.email) return;
    (async () => {
      // Primeiro pontua a visita do dia, depois lê o resumo já atualizado.
      await api.pontos.registrar("visita_diaria", undefined, me.email);
      try {
        const r = await api.pontos.me(me.email);
        if (vivo) setResumo(r);
      } catch {
        /* silencioso: gamificação não pode quebrar o topbar */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [me?.email]);

  const total = resumo?.total ?? 0;
  const posicao = resumo?.posicao;

  const link = (
    <Link
      to="/ranking"
      aria-label="Ver ranking"
      className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-secondary"
    >
      <Trophy className="size-4 text-primary" />
      <span className="tabular-nums">{total}</span>
      {posicao != null && (
        <span className="hidden text-[10px] font-medium text-muted-foreground sm:inline">
          · {posicao}º
        </span>
      )}
    </Link>
  );

  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger render={link} />
        <TooltipContent side="bottom">
          {total} ponto{total === 1 ? "" : "s"} este mês
          {posicao != null ? ` · ${posicao}º lugar` : ""}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
