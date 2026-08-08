// Visão SEMANAL (minimalista) da agenda do colaborador — abre pelo "Ver mais" do painel da home.
// Recebe os compromissos já carregados (a API cobre os próximos 14 dias) e apenas os posiciona
// numa grade de horas: nada de fetch próprio, nada de biblioteca de calendário.
import * as React from "react";
import { ChevronLeft, ChevronRight, Video, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { AgendaItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const ALTURA_HORA = 46; // px por hora na grade
/** A API da agenda cobre de HOJE até +14 dias — a navegação do calendário respeita essa janela. */
const DIAS_DA_JANELA = 14;

function inicioDaSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay()); // semana começa no domingo (padrão pt-BR do Outlook)
  return x;
}

function somaDias(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hhmm(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function diaPorExtenso(d: Date): string {
  return d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

function rotuloDaSemana(ini: Date): string {
  const fim = somaDias(ini, 6);
  const mesIni = ini.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  const mesFim = fim.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return mesIni === mesFim
    ? `${ini.getDate()} – ${fim.getDate()} de ${mesFim} de ${fim.getFullYear()}`
    : `${ini.getDate()} de ${mesIni} – ${fim.getDate()} de ${mesFim} de ${fim.getFullYear()}`;
}

type Bloco = { item: AgendaItem; ini: Date; fim: Date; col: number; cols: number };

/** Agrupa compromissos que se sobrepõem no tempo para dividi-los em colunas lado a lado. */
function posicionar(itens: { item: AgendaItem; ini: Date; fim: Date }[]): Bloco[] {
  const ordenados = [...itens].sort((a, b) => a.ini.getTime() - b.ini.getTime());
  const blocos: Bloco[] = [];
  let grupo: Bloco[] = [];
  let fimDoGrupo = 0;

  const fechar = () => {
    grupo.forEach((b) => (b.cols = grupo.length));
    blocos.push(...grupo);
    grupo = [];
    fimDoGrupo = 0;
  };

  for (const it of ordenados) {
    if (grupo.length && it.ini.getTime() >= fimDoGrupo) fechar();
    grupo.push({ ...it, col: grupo.length, cols: 1 });
    fimDoGrupo = Math.max(fimDoGrupo, it.fim.getTime());
  }
  if (grupo.length) fechar();
  return blocos;
}

export function AgendaSemanaDialog({
  open,
  onOpenChange,
  itens,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  itens: AgendaItem[];
}) {
  const hoje = React.useMemo(() => new Date(), []);
  const [semana, setSemana] = React.useState(() => inicioDaSemana(new Date()));

  // Janela real de dados: de hoje (00h) até hoje + 14 dias (exclusivo). Fora disso não há o que mostrar,
  // então a navegação por semanas é travada nesses limites.
  const janelaIni = React.useMemo(() => {
    const x = new Date(hoje);
    x.setHours(0, 0, 0, 0);
    return x;
  }, [hoje]);
  const janelaFim = React.useMemo(() => somaDias(janelaIni, DIAS_DA_JANELA), [janelaIni]);

  // Reabrir o diálogo volta para a semana corrente.
  React.useEffect(() => {
    if (open) setSemana(inicioDaSemana(new Date()));
  }, [open]);

  const dias = React.useMemo(() => Array.from({ length: 7 }, (_, i) => somaDias(semana, i)), [semana]);
  const fimDaSemana = React.useMemo(() => somaDias(semana, 7), [semana]);

  // Compromissos da semana visível, já convertidos para Date.
  const daSemana = React.useMemo(
    () =>
      itens
        .map((item) => ({ item, ini: new Date(item.inicio), fim: new Date(item.fim || item.inicio) }))
        .filter((b) => !Number.isNaN(b.ini.getTime()) && b.ini >= semana && b.ini < fimDaSemana),
    [itens, semana, fimDaSemana],
  );

  // Faixa de horas exibida: cobre os compromissos da semana, com 8h–18h como piso.
  const [horaIni, horaFim] = React.useMemo(() => {
    let min = 8;
    let max = 18;
    for (const b of daSemana) {
      min = Math.min(min, b.ini.getHours());
      max = Math.max(max, b.fim.getHours() + (b.fim.getMinutes() > 0 ? 1 : 0));
    }
    return [Math.max(0, min), Math.min(24, Math.max(max, min + 4))];
  }, [daSemana]);

  const horas = React.useMemo(
    () => Array.from({ length: horaFim - horaIni }, (_, i) => horaIni + i),
    [horaIni, horaFim],
  );
  const alturaGrade = horas.length * ALTURA_HORA;

  const topo = (d: Date) => ((d.getHours() * 60 + d.getMinutes() - horaIni * 60) / 60) * ALTURA_HORA;

  const semanaAtual = mesmoDia(semana, inicioDaSemana(hoje));
  // Só avança enquanto a próxima semana ainda tocar a janela de 14 dias; só volta até a semana corrente.
  const podeAvancar = somaDias(semana, 7) < janelaFim;
  const podeVoltar = !semanaAtual;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(1000px,calc(100vw-2rem))] max-w-none gap-3 p-0 sm:max-w-none">
        <DialogHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-semibold">Minha agenda</DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {rotuloDaSemana(semana)} · próximos {DIAS_DA_JANELA} dias
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 pr-8">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Semana anterior"
              disabled={!podeVoltar}
              onClick={() => podeVoltar && setSemana(somaDias(semana, -7))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={semanaAtual}
              onClick={() => setSemana(inicioDaSemana(new Date()))}
            >
              Hoje
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Próxima semana"
              disabled={!podeAvancar}
              onClick={() => podeAvancar && setSemana(somaDias(semana, 7))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Cabeçalho dos dias — alinhado com a coluna de horas (w-12) da grade. */}
        <div className="flex border-b border-border px-4">
          <div className="w-12 shrink-0" />
          <div className="grid flex-1 grid-cols-7">
            {dias.map((d) => {
              const eHoje = mesmoDia(d, hoje);
              const foraDaJanela = d < janelaIni || d >= janelaFim;
              return (
                <div key={d.toISOString()} className={cn("flex flex-col items-center gap-0.5 py-2", foraDaJanela && "opacity-40")}>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{DIAS[d.getDay()]}</span>
                  <span
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full text-sm font-semibold",
                      eHoje ? "bg-primary text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grade de horas */}
        <TooltipProvider delay={120}>
        <div className="max-h-[60vh] overflow-y-auto px-4 pb-4">
          {/* pt-2: o rótulo da primeira hora fica levemente acima da linha e seria cortado pelo scroll. */}
          <div className="flex pt-2">
            {/* Coluna de horas */}
            <div className="w-12 shrink-0" style={{ height: alturaGrade }}>
              {horas.map((h) => (
                <div key={h} className="relative" style={{ height: ALTURA_HORA }}>
                  <span className="absolute -top-1.5 right-2 text-[10px] tabular-nums text-muted-foreground">
                    {String(h).padStart(2, "0")}h
                  </span>
                </div>
              ))}
            </div>

            {/* Dias */}
            <div className="relative grid flex-1 grid-cols-7" style={{ height: alturaGrade }}>
              {/* Linhas de hora (fundo) */}
              <div className="pointer-events-none absolute inset-0">
                {horas.map((h) => (
                  <div key={h} className="border-t border-border/60" style={{ height: ALTURA_HORA }} />
                ))}
              </div>

              {dias.map((d) => {
                const blocos = posicionar(daSemana.filter((b) => mesmoDia(b.ini, d)));
                return (
                  <div
                    key={d.toISOString()}
                    className={cn(
                      "relative border-l border-border/60",
                      mesmoDia(d, hoje) && "bg-primary/[0.04]",
                      // Dia fora da janela de 14 dias: não há dado para mostrar, então fica apagado.
                      (d < janelaIni || d >= janelaFim) && "bg-muted/20",
                    )}
                  >
                    {blocos.map(({ item, ini, fim, col, cols }) => {
                      const top = Math.max(0, topo(ini));
                      const altura = Math.max(22, Math.min(alturaGrade - top, topo(fim) - topo(ini)));
                      // O pill é montado à parte porque o TooltipTrigger do Base UI o recebe via `render`.
                      const pill = (
                        <div
                          className="absolute cursor-default overflow-hidden rounded-[3px] border border-primary/25 bg-primary/10 px-1.5 py-1 text-left transition-colors hover:bg-primary/20"
                          style={{
                            top,
                            height: altura,
                            left: `calc(${(col / cols) * 100}% + 2px)`,
                            width: `calc(${100 / cols}% - 4px)`,
                          }}
                        >
                          <p className="truncate text-[11px] font-semibold leading-tight text-foreground">{item.titulo}</p>
                          {altura > 34 && (
                            <p className="truncate text-[10px] leading-tight text-muted-foreground">
                              {hhmm(ini)} – {hhmm(fim)}
                            </p>
                          )}
                          {altura > 58 && (item.online || item.local) && (
                            <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] leading-tight text-muted-foreground">
                              {item.online ? <Video className="size-3 shrink-0" /> : <MapPin className="size-3 shrink-0" />}
                              <span className="truncate">{item.online ? "Online" : item.local}</span>
                            </p>
                          )}
                        </div>
                      );
                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger render={pill} />
                          <TooltipContent side="top" className="max-w-xs flex-col items-start gap-1 py-2 text-left">
                            <p className="text-xs font-semibold leading-snug">{item.titulo}</p>
                            <p className="text-[11px] leading-snug opacity-80">
                              {diaPorExtenso(ini)} · {hhmm(ini)} – {hhmm(fim)}
                            </p>
                            <p className="flex items-center gap-1 text-[11px] leading-snug opacity-80">
                              {item.online ? <Video className="size-3 shrink-0" /> : <MapPin className="size-3 shrink-0" />}
                              <span>{item.online ? "Reunião online" : item.local || "Sem local definido"}</span>
                            </p>
                            {item.organizador && (
                              <p className="text-[11px] leading-snug opacity-80">Organizador: {item.organizador}</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {daSemana.length === 0 && (
            <p className="pt-3 text-center text-xs text-muted-foreground">
              Sem compromissos nesta semana. A agenda cobre os próximos {DIAS_DA_JANELA} dias.
            </p>
          )}
        </div>
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  );
}
