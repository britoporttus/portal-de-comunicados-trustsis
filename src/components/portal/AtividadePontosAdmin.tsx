// Painel de AUDITORIA do admin: mostra, por DIA, quem pontuou e COMO pontuou (cada ação
// com valor e horário). Só é montado para admins (a página decide). Carrega sob demanda.
import { ShieldAlert } from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { iniciais } from "@/lib/format";
import { TIPO_PONTO_META } from "@/lib/gamification";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ListSkeleton } from "@/components/portal/page-kit";

/** "2026-08-03" → "sábado, 3 de agosto". Usa meio-dia para evitar deslocamento de fuso. */
function rotuloDia(dia: string): string {
  const d = new Date(`${dia}T12:00:00`);
  const s = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AtividadePontosAdmin({ mes }: { mes: string }) {
  const { data, loading } = useAsync(() => api.pontos.atividade(mes), [mes]);
  const dias = data?.dias ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Atividade de pontos por dia</h3>
        <span className="rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </span>
      </div>

      {loading ? (
        <ListSkeleton rows={4} />
      ) : dias.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma pontuação registrada neste mês.</p>
      ) : (
        <Accordion className="gap-1">
          {dias.map((d) => (
            <AccordionItem key={d.dia} value={d.dia}>
              <AccordionTrigger>
                <span className="flex flex-1 items-center justify-between gap-3 pr-3">
                  <span className="font-medium text-foreground">{rotuloDia(d.dia)}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    {d.usuarios.length} pessoa{d.usuarios.length === 1 ? "" : "s"}
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                      {d.total} pts
                    </span>
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-3">
                  {d.usuarios.map((u) => (
                    <li key={u.upn} className="rounded-xl border border-border bg-secondary/30 p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="size-8 shrink-0">
                          {u.fotoUrl && <AvatarImage src={u.fotoUrl} alt={u.nome} />}
                          <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                            {iniciais(u.nome)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{u.nome}</p>
                          {(u.cargo || u.area) && (
                            <p className="truncate text-xs text-muted-foreground">
                              {[u.cargo, u.area].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-primary">
                          +{u.total}
                        </span>
                      </div>
                      {/* Como pontuou: cada ação com horário e valor */}
                      <ul className="mt-2 space-y-1 border-t border-border/60 pt-2">
                        {u.itens.map((it, i) => {
                          const Icon = TIPO_PONTO_META[it.tipo]?.icon;
                          return (
                            <li
                              key={`${u.upn}-${i}`}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              {Icon && <Icon className="size-3.5 shrink-0 text-primary/80" />}
                              <span className="flex-1 truncate text-foreground/90">{it.label}</span>
                              <span className="tabular-nums text-muted-foreground">{it.hora}</span>
                              <span className="w-10 shrink-0 text-right font-semibold tabular-nums text-primary">
                                +{it.pontos}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}
