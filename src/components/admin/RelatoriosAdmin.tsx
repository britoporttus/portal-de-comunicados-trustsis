// RELATÓRIOS (Administração) — visão de gestor sobre o portal: a leitura obrigatória chegou
// a todo mundo? o pessoal está usando? o que está em aberto?
//
// A tela é só LEITURA de `GET /api/relatorios` (o backend já agrega tudo em uma chamada).
// Por isso não há filtro nem paginação aqui: um único fetch, números prontos e um CSV para
// quem quiser levar a cobertura de leitura para o Excel / uma reunião.
//
// Regra importante: cobertura percentual depende do snapshot diário do diretório. Quando ele
// não existe (`base.fonte === "nenhuma"`), o backend devolve `null` em vez de um percentual
// mentiroso — a UI mostra "—" e explica o motivo, nunca inventa 0%.
import { useMemo } from "react";
import {
  BarChart3, Download, RefreshCw, Users, Megaphone, FileCheck2, Trophy,
  LifeBuoy, MessageSquareWarning, MessageSquare, Heart, Info, CalendarDays, FolderOpen,
  LayoutGrid, ShieldCheck, Lock,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { usePortal } from "@/context/PortalProvider";
import { tempoRelativo, dataLonga } from "@/lib/format";
import type { Relatorios, SerieItem } from "@/lib/types";
import { EmptyState, ListSkeleton } from "@/components/portal/page-kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Números grandes com separador de milhar pt-BR (o portal é todo em pt-BR). */
function num(n: number): string {
  return n.toLocaleString("pt-BR");
}

/** Fração 0..1 → "45%". `null` = sem base para comparar (ver comentário do topo). */
function pct(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`;
}

/** "2026-08-01" → "01/08" (rótulo curto da mini-série de 14 dias). */
function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return dia && mes ? `${dia}/${mes}` : iso;
}

/**
 * Data COMPLETA (com ano) só para o CSV: `dataLonga` é ótima na tela ("7 de agosto"), mas
 * numa planilha que pode cruzar anos o ano é obrigatório.
 */
function dataCsv(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

// ---------------------------------------------------------------- peças visuais

/** Cartão de KPI: um número grande + rótulo, opcionalmente com uma nota de apoio. */
function Kpi({
  icon: Icon, label, valor, nota,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: string;
  nota?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5 text-primary" />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{valor}</p>
      {nota && <p className="mt-0.5 truncate text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

/** Bloco padrão (card com título) para agrupar tabelas e séries. */
function Bloco({
  icon: Icon, titulo, acao, children, className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-card p-4 shadow-sm ${className ?? ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Icon className="size-4 text-primary" />
        <h3 className="flex-1 text-sm font-semibold text-foreground">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Barra de progresso simples (não uso o Progress do UI: aqui a barra vive dentro de célula). */
function Barra({ fracao }: { fracao: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(2, Math.round(fracao * 100))}%` }}
      />
    </div>
  );
}

/** Série em barras horizontais — proporcional ao MAIOR valor, para comparar entre si. */
function SerieBarras({ itens, vazio = "Sem dados no período." }: { itens: SerieItem[]; vazio?: string }) {
  if (itens.length === 0) return <p className="text-xs text-muted-foreground">{vazio}</p>;
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="space-y-2">
      {itens.map((i) => (
        <li key={i.rotulo} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate capitalize text-foreground">{i.rotulo}</span>
            <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">{num(i.valor)}</span>
          </div>
          <Barra fracao={i.valor / max} />
        </li>
      ))}
    </ul>
  );
}

/** Mini-série de colunas (14 dias). Sem lib de gráfico: são divs com altura proporcional. */
function MiniColunas({ itens }: { itens: SerieItem[] }) {
  const max = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <div>
      <div className="flex h-16 items-end gap-1">
        {itens.map((i) => (
          <div
            key={i.rotulo}
            className="flex-1 rounded-t-sm bg-primary/70"
            style={{ height: `${Math.max(4, (i.valor / max) * 100)}%` }}
            title={`${diaCurto(i.rotulo)}: ${i.valor} pessoa(s)`}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{diaCurto(itens[0]?.rotulo ?? "")}</span>
        <span>pico {num(max)}</span>
        <span>{diaCurto(itens[itens.length - 1]?.rotulo ?? "")}</span>
      </div>
    </div>
  );
}

/** Lista rótulo → valor (contadores de conteúdo). */
function Contadores({ itens }: { itens: { icon: React.ComponentType<{ className?: string }>; label: string; valor: number }[] }) {
  return (
    <dl className="space-y-2 text-xs">
      {itens.map(({ icon: Icon, label, valor }) => (
        <div key={label} className="flex items-center justify-between gap-3">
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <Icon className="size-3.5" /> {label}
          </dt>
          <dd className="font-semibold tabular-nums text-foreground">{num(valor)}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------------------------------------------------------------- exportação CSV

/** Escapa uma célula para CSV com separador ";" (aspas duplicadas quando necessário). */
function celula(v: string | number): string {
  const s = String(v ?? "");
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Baixa a cobertura de leitura (comunicados obrigatórios + políticas) como CSV.
 * Separador ";" e BOM UTF-8 porque o Excel em pt-BR abre assim sem pedir importação.
 */
function exportarCsv(r: Relatorios) {
  const linhas: (string | number)[][] = [
    ["Tipo", "Item", "Data", "Confirmações", "Pessoas na base", "Cobertura"],
    ...r.comunicados.obrigatoriosDetalhe.map((c) => [
      "Comunicado obrigatório",
      c.titulo,
      dataCsv(c.publicadoEm),
      c.confirmacoes,
      r.base.pessoas,
      pct(c.cobertura),
    ]),
    ...r.politicas.detalhe.map((p) => [
      "Política obrigatória",
      p.nome,
      dataCsv(p.definidaEm),
      p.confirmacoes,
      r.base.pessoas,
      pct(p.cobertura),
    ]),
  ];

  // BOM (\uFEFF): sem ele o Excel pt-BR estraga os acentos do arquivo.
  const csv = "\uFEFF" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-leitura-obrigatoria-${r.geradoEm.slice(0, 10)}.csv`;
  a.click();
  // Revoga no próximo tick: revogar na mesma linha cancela o download em alguns navegadores.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// ---------------------------------------------------------------- tela

export function RelatoriosAdmin() {
  const { me } = usePortal();
  const { data, loading, error, reload } = useAsync(() => api.relatorios.get(me?.email), [me?.email]);

  // Sem snapshot do diretório não existe denominador: os percentuais somem da tela.
  const semBase = data?.base.fonte === "nenhuma";
  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { icon: Users, label: "Pessoas na base", valor: num(data.base.pessoas), nota: semBase ? "sem snapshot do diretório" : "último scan do diretório" },
      { icon: Megaphone, label: "Comunicados", valor: num(data.comunicados.total), nota: `${num(data.comunicados.ultimos30)} nos últimos 30 dias` },
      { icon: FileCheck2, label: "Cobertura média (obrigatórios)", valor: pct(data.comunicados.coberturaMedia), nota: `${num(data.comunicados.obrigatorios)} comunicado(s) obrigatório(s)` },
      { icon: ShieldCheck, label: "Políticas obrigatórias", valor: num(data.politicas.obrigatorias), nota: `${num(data.politicas.pessoasQueConfirmaram)} pessoa(s) já confirmaram` },
      { icon: Trophy, label: "Participantes no mês", valor: num(data.engajamento.participantes), nota: `${num(data.engajamento.pontosNoMes)} pontos distribuídos` },
      { icon: LifeBuoy, label: "Chamados em aberto", valor: num(data.tickets.abertos), nota: data.tickets.maisAntigoDias === null ? `${num(data.tickets.total)} no total` : `mais antigo: ${data.tickets.maisAntigoDias} dia(s)` },
      { icon: MessageSquareWarning, label: "Feedbacks em aberto", valor: num(data.reportes.abertos), nota: `${num(data.reportes.total)} recebido(s) no total` },
    ];
  }, [data, semBase]);

  if (loading) return <ListSkeleton rows={6} />;

  if (error || !data) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Não foi possível montar os relatórios"
        description={error ?? "A API não devolveu dados. Tente recarregar em alguns instantes."}
        action={
          <Button variant="outline" size="lg" onClick={reload}>
            <RefreshCw /> Recarregar
          </Button>
        }
      />
    );
  }

  const { comunicados, politicas, social, engajamento, tickets, reportes, conteudo } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          Panorama do portal: cobertura da leitura obrigatória, engajamento e o que está em aberto.
        </p>
        <Button variant="outline" size="lg" onClick={() => exportarCsv(data)}>
          <Download /> Exportar CSV
        </Button>
      </div>

      {/* Aviso único e discreto: explica de uma vez todos os "—" da tela. */}
      {semBase && (
        <p className="flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          Ainda não há snapshot do diretório, então só mostramos números absolutos: sem a base de
          pessoas não é possível calcular percentual de cobertura. Rode a sincronização em
          Administração › Diagnóstico.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Kpi key={k.label} {...k} />
        ))}
      </div>

      <Bloco
        icon={Megaphone}
        titulo="Comunicados de leitura obrigatória"
        acao={<Badge variant="outline" className="border-border text-muted-foreground">{num(comunicados.obrigatorios)}</Badge>}
      >
        {comunicados.obrigatoriosDetalhe.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhum comunicado está marcado como leitura obrigatória.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comunicado</TableHead>
                  <TableHead className="w-32">Publicado</TableHead>
                  <TableHead className="w-28">Confirmações</TableHead>
                  <TableHead className="w-48">Cobertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comunicados.obrigatoriosDetalhe.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm text-foreground">{c.titulo}</TableCell>
                    <TableCell
                      className="whitespace-nowrap text-xs text-muted-foreground"
                      title={dataLonga(c.publicadoEm)}
                    >
                      {tempoRelativo(c.publicadoEm)}
                    </TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums text-foreground">
                      {num(c.confirmacoes)}
                    </TableCell>
                    <TableCell>
                      {c.cobertura === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Barra fracao={c.cobertura} />
                          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                            {pct(c.cobertura)}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Bloco>

      <Bloco
        icon={ShieldCheck}
        titulo="Políticas de leitura obrigatória"
        acao={
          <Badge variant="outline" className="border-border text-muted-foreground">
            {num(politicas.confirmacoesTotais)} confirmação(ões)
          </Badge>
        }
      >
        {politicas.detalhe.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma política está exigindo confirmação de leitura.
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Política</TableHead>
                  <TableHead className="w-32">Definida em</TableHead>
                  <TableHead className="w-28">Confirmações</TableHead>
                  <TableHead className="w-48">Cobertura</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {politicas.detalhe.map((p) => (
                  <TableRow key={p.docId}>
                    <TableCell className="text-sm text-foreground">{p.nome}</TableCell>
                    <TableCell
                      className="whitespace-nowrap text-xs text-muted-foreground"
                      title={p.definidaEm ? dataLonga(p.definidaEm) : undefined}
                    >
                      {p.definidaEm ? tempoRelativo(p.definidaEm) : "—"}
                    </TableCell>
                    <TableCell className="text-sm font-semibold tabular-nums text-foreground">
                      {num(p.confirmacoes)}
                    </TableCell>
                    <TableCell>
                      {p.cobertura === null ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Barra fracao={p.cobertura} />
                          <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">
                            {pct(p.cobertura)}
                          </span>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Bloco>

      {/* ENGAJAMENTO — de onde vêm os pontos, uso diário do portal e quem mais participa. */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Bloco icon={Trophy} titulo="Pontos por tipo de ação">
          <SerieBarras itens={engajamento.porTipo} vazio="Ninguém pontuou neste mês." />
        </Bloco>

        <Bloco icon={CalendarDays} titulo="Pessoas ativas (14 dias)">
          <MiniColunas itens={engajamento.porDia} />
          <p className="mt-2 text-xs text-muted-foreground">
            Pessoas distintas que pontuaram por dia — proxy de uso do portal.
          </p>
        </Bloco>

        <Bloco icon={Users} titulo="Quem mais participa no mês">
          {engajamento.top.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem pontuação no mês.</p>
          ) : (
            <ol className="space-y-2">
              {engajamento.top.map((p, i) => (
                <li key={p.chave} className="flex items-center gap-2 text-xs">
                  <span className="w-4 shrink-0 text-right font-semibold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="flex-1 truncate text-foreground">{p.nome}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-primary">
                    {num(p.pontos)} pts
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Bloco>
      </div>

      {/* CONTEÚDO E CANAIS — o que foi publicado e o que chega de volta pelos canais. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Bloco icon={Heart} titulo="Mural social">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Publicações", valor: social.publicacoes },
              { label: "Curtidas", valor: social.curtidas },
              { label: "Comentários", valor: social.comentarios },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-secondary/30 p-2">
                <p className="text-lg font-semibold tabular-nums text-foreground">{num(s.valor)}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          {social.top.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma publicação no mural.</p>
          ) : (
            <ul className="space-y-1.5">
              {social.top.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate text-foreground">{p.autor}</span>
                  <Badge variant="outline" className="border-border text-[10px] text-muted-foreground">
                    {p.rede}
                  </Badge>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Heart className="size-3" /> {num(p.curtidas)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="size-3" /> {num(p.comentarios)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Bloco>

        <Bloco icon={FolderOpen} titulo="Conteúdo publicado">
          <Contadores
            itens={[
              { icon: CalendarDays, label: "Eventos futuros na agenda", valor: conteudo.eventosFuturos },
              { icon: FolderOpen, label: "Bibliotecas de documentos", valor: conteudo.bibliotecas },
              { icon: LayoutGrid, label: "Atalhos da empresa", valor: conteudo.atalhos },
              { icon: ShieldCheck, label: "Perfis de acesso", valor: conteudo.perfis },
              { icon: Lock, label: "Itens restritos por perfil", valor: conteudo.artefatosRestritos },
              { icon: Megaphone, label: "Comunicados restritos", valor: comunicados.restritos },
            ]}
          />
        </Bloco>

        <Bloco
          icon={LifeBuoy}
          titulo="Chamados"
          acao={
            <Badge variant="outline" className="border-border text-muted-foreground">
              {num(tickets.abertos)} em aberto
            </Badge>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Por status
              </p>
              <SerieBarras itens={tickets.porStatus} vazio="Nenhum chamado registrado." />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Por prioridade
              </p>
              <SerieBarras itens={tickets.porPrioridade} vazio="Nenhum chamado registrado." />
            </div>
          </div>
        </Bloco>

        <Bloco
          icon={MessageSquareWarning}
          titulo="Feedbacks do portal"
          acao={
            <Badge variant="outline" className="border-border text-muted-foreground">
              {num(reportes.abertos)} em aberto
            </Badge>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Por status
              </p>
              <SerieBarras itens={reportes.porStatus} vazio="Nenhum feedback recebido." />
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Por tipo
              </p>
              <SerieBarras itens={reportes.porTipo} vazio="Nenhum feedback recebido." />
            </div>
          </div>
        </Bloco>
      </div>

      {/* Comunicados por categoria: mostra onde a comunicação interna está concentrada. */}
      <Bloco icon={BarChart3} titulo="Comunicados por categoria">
        <SerieBarras itens={comunicados.porCategoria} vazio="Nenhum comunicado publicado." />
      </Bloco>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="text-xs text-muted-foreground" title={dataLonga(data.geradoEm)}>
          Gerado em {tempoRelativo(data.geradoEm)} · mês de referência do engajamento:{" "}
          {engajamento.mes}
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          <RefreshCw /> Recarregar
        </Button>
      </div>
    </div>
  );
}
