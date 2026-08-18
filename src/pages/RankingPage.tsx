// Ranking mensal (gamificação): pódio dos 3 primeiros, prêmio do mês, tabela completa
// e o resumo de pontos do próprio usuário. Os pontos vêm do ledger agregado no backend.
import { useMemo, useState } from "react";
import { Trophy, Medal, Gift, Crown, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { iniciais } from "@/lib/format";
import { TIPO_PONTO_META, TIPO_PONTO_ORDEM, nomeDoMes, ultimosMeses } from "@/lib/gamification";
import type { RankingEntry } from "@/lib/types";
import { PageHeader, EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Droplist } from "@/components/ui/droplist";
import { cn } from "@/lib/utils";

const MEDALHA = ["text-warning", "text-muted-foreground", "text-[#cd7f32]"]; // ouro, prata, bronze

function Podio({ top, meUpn }: { top: RankingEntry[]; meUpn: string }) {
  // Ordem visual: 2º, 1º, 3º (o 1º no centro e mais alto).
  const ordem = [top[1], top[0], top[2]].filter(Boolean) as RankingEntry[];
  const alturas: Record<number, string> = { 1: "h-28", 2: "h-20", 3: "h-16" };
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {ordem.map((e) => (
        <div key={e.upn} className="flex w-24 flex-col items-center sm:w-32">
          <div className="relative">
            {e.posicao === 1 && (
              <Crown className="absolute -top-5 left-1/2 size-6 -translate-x-1/2 text-warning" />
            )}
            <Avatar className={cn("mb-2 border-2", e.posicao === 1 ? "size-16 border-warning" : "size-12 border-border")}>
              {e.fotoUrl && <AvatarImage src={e.fotoUrl} alt={e.nome} />}
              <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                {iniciais(e.nome)}
              </AvatarFallback>
            </Avatar>
          </div>
          <p className="line-clamp-1 text-center text-xs font-semibold text-foreground">{e.nome.split(" ")[0]}</p>
          <p className="text-center text-[11px] font-bold text-primary">{e.total} pts</p>
          <div
            className={cn(
              "mt-2 flex w-full items-start justify-center rounded-t-lg border border-b-0 border-border pt-2 text-lg font-bold",
              alturas[e.posicao],
              e.upn === meUpn ? "bg-primary/15 text-primary" : "bg-secondary text-foreground",
            )}
          >
            {e.posicao}º
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RankingPage() {
  const { me } = usePortal();
  const meses = useMemo(() => ultimosMeses(), []);
  // Valor do filtro é a chave "AAAA-MM" (string) — o label é o nome do mês.
  const mesOptions = useMemo(() => meses.map((m) => ({ value: m, label: nomeDoMes(m) })), [meses]);
  const [mes, setMes] = useState(meses[0]);
  const meUpn = (me?.email ?? "").toLowerCase();

  const { data, loading } = useAsync(() => api.pontos.ranking(mes), [mes]);
  const entradas = data?.entradas ?? [];
  const top3 = entradas.slice(0, 3);
  const eu = entradas.find((e) => e.upn === meUpn);
  const ehMesAtual = mes === meses[0];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Trophy}
        eyebrow="Engajamento"
        title="Ranking"
        description="Pontue interagindo com o portal. Quem lidera no fim do mês leva o prêmio."
        action={
          <Droplist
            value={mes}
            onChange={(v) => setMes(v)}
            options={mesOptions}
            className="w-44"
            aria-label="Mês"
          />
        }
      />

      {/* Faixa do prêmio do mês */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 to-primary/5 p-4">
        <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
          <Gift className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Prêmio de {nomeDoMes(mes)}
          </p>
          <p className="text-xs text-muted-foreground">
            {top3[0]
              ? `${top3[0].nome} está na frente com ${top3[0].total} pontos. ${ehMesAtual ? "Ainda dá tempo de virar!" : "Campeão(ã) do mês."}`
              : "Ninguém pontuou ainda neste mês. Seja o primeiro!"}
          </p>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : entradas.length === 0 ? (
        <EmptyState icon={Sparkles} title="Sem pontuação neste mês" description="Interaja com o portal para começar a pontuar." />
      ) : (
        <>
          {top3.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <Podio top={top3} meUpn={meUpn} />
            </div>
          )}

          {/* Meu resumo */}
          {eu && (
            <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {me?.fotoUrl && <AvatarImage src={me.fotoUrl} alt={me.nome} />}
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {me ? iniciais(me.nome) : "··"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Você está em {eu.posicao}º lugar</p>
                    <p className="text-xs text-muted-foreground">{eu.total} pontos acumulados em {nomeDoMes(mes)}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TIPO_PONTO_ORDEM.filter((t) => (eu.porTipo[t] ?? 0) > 0).map((t) => {
                    const M = TIPO_PONTO_META[t];
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
                        title={M.label}
                      >
                        <M.icon className="size-3 text-primary" />
                        {eu.porTipo[t]}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tabela completa */}
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <ul className="divide-y divide-border">
              {entradas.map((e) => (
                <li
                  key={e.upn}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    e.upn === meUpn && "bg-primary/10",
                  )}
                >
                  <div className="w-7 shrink-0 text-center">
                    {e.posicao <= 3 ? (
                      <Medal className={cn("mx-auto size-5", MEDALHA[e.posicao - 1])} />
                    ) : (
                      <span className="text-sm font-semibold text-muted-foreground">{e.posicao}</span>
                    )}
                  </div>
                  <Avatar className="size-9 shrink-0">
                    {e.fotoUrl && <AvatarImage src={e.fotoUrl} alt={e.nome} />}
                    <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                      {iniciais(e.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.nome}
                      {e.upn === meUpn && <span className="ml-1.5 text-xs font-normal text-primary">(você)</span>}
                    </p>
                    {(e.cargo || e.area) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {[e.cargo, e.area].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground">{e.total}</p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">pontos</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Como pontuar */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Como ganhar pontos</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {TIPO_PONTO_ORDEM.map((t) => {
                const M = TIPO_PONTO_META[t];
                return (
                  <div key={t} className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <M.icon className="size-4 shrink-0 text-primary" />
                    <span className="flex-1 text-sm text-foreground">{M.label}</span>
                    <span className="text-xs font-semibold text-primary">+{M.pontos}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* A auditoria de pontos por dia mora agora em Administração › Atividade de pontos. */}
    </div>
  );
}
