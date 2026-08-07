// RELATÓRIOS da administração (etapa final da Fase 6 do PLANO-INTRANET.md).
//
// Responde as perguntas que a reunião levantou sobre o portal: "o comunicado obrigatório
// chegou a todo mundo?", "quem ainda não confirmou a política?", "o pessoal está usando?".
//
// Princípios:
//  - AGREGA o que já existe no store (comunicados/leituras, políticas confirmadas, ledger de
//    pontos, social, tickets, reportes). Nada de coleta nova, nada de bater no Graph aqui:
//    o relatório tem de abrir rápido e funcionar até em modo demo.
//  - A BASE de comparação (quantas pessoas existem) vem do snapshot diário do diretório
//    (cache.ts). Sem snapshot, as coberturas viram `null` em vez de um percentual mentiroso.
import { getStore } from "./store.js";
import { getCachedDiretorio } from "./cache.js";
import { isGraphOn } from "./graph.js";
import { mockPeople } from "./mock.js";
import { PONTOS_CONFIG, canonizar, mesAtual, perfilDeChave } from "./pontos.js";
import type { PontoEvento, TipoPonto } from "./types.js";

/** Par rótulo/valor — o formato que os gráficos de barra da UI consomem. */
export interface SerieItem {
  rotulo: string;
  valor: number;
}

/** Cobertura de leitura de UM comunicado obrigatório. */
export interface CoberturaComunicado {
  id: string;
  titulo: string;
  publicadoEm: string;
  confirmacoes: number;
  /** 0..1 — `null` quando não há base de usuários para comparar. */
  cobertura: number | null;
}

/** Cobertura de UMA política marcada como leitura obrigatória. */
export interface CoberturaPolitica {
  docId: string;
  nome: string;
  definidaEm?: string;
  confirmacoes: number;
  cobertura: number | null;
}

export interface Relatorios {
  geradoEm: string;
  /** Base de comparação das coberturas. `fonte: "nenhuma"` = percentuais indisponíveis. */
  base: { pessoas: number; fonte: "diretorio" | "nenhuma" };
  comunicados: {
    total: number;
    obrigatorios: number;
    ultimos30: number;
    restritos: number;
    /** média das coberturas dos obrigatórios (0..1) ou null sem base. */
    coberturaMedia: number | null;
    porCategoria: SerieItem[];
    /** Obrigatórios do mais recente para o mais antigo (o que exige acompanhamento). */
    obrigatoriosDetalhe: CoberturaComunicado[];
  };
  politicas: {
    obrigatorias: number;
    confirmacoesTotais: number;
    pessoasQueConfirmaram: number;
    detalhe: CoberturaPolitica[];
  };
  social: {
    publicacoes: number;
    curtidas: number;
    comentarios: number;
    top: { id: string; autor: string; rede: string; curtidas: number; comentarios: number }[];
  };
  engajamento: {
    mes: string;
    participantes: number;
    pontosNoMes: number;
    porTipo: SerieItem[];
    /** Últimos 14 dias: pessoas distintas que pontuaram por dia. */
    porDia: SerieItem[];
    top: { chave: string; nome: string; pontos: number }[];
  };
  tickets: {
    total: number;
    abertos: number;
    porStatus: SerieItem[];
    porPrioridade: SerieItem[];
    /** Idade (dias) do chamado aberto mais antigo — null se não há nenhum em aberto. */
    maisAntigoDias: number | null;
  };
  reportes: {
    total: number;
    abertos: number;
    porStatus: SerieItem[];
    porTipo: SerieItem[];
  };
  conteudo: {
    eventosFuturos: number;
    bibliotecas: number;
    atalhos: number;
    perfis: number;
    /** Artefatos com `perfis[]` preenchido (conteúdo segregado). */
    artefatosRestritos: number;
  };
}

const DIA_MS = 86_400_000;
/** Quantos dias a série de atividade cobre. */
const JANELA_DIAS = 14;

function contar<T>(itens: T[], chave: (i: T) => string | undefined): SerieItem[] {
  const mapa = new Map<string, number>();
  for (const i of itens) {
    const k = chave(i) || "—";
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor);
}

function fracao(parte: number, base: number): number | null {
  if (!base) return null;
  return Math.min(1, parte / base);
}

/** Rótulo legível de um enum do store ("em_andamento" → "em andamento"). */
function rotulo(v?: string): string {
  return (v ?? "—").replace(/_/g, " ");
}

export function montarRelatorios(): Relatorios {
  const s = getStore();
  const agora = Date.now();
  // Mesma fonte que o ranking usa (pontos.ts › diretorio): snapshot diário com Graph,
  // pessoas de exemplo em demo — assim o preview mostra percentuais de verdade.
  const diretorio = isGraphOn ? getCachedDiretorio() ?? [] : mockPeople;
  const pessoas = diretorio.length;
  const base: Relatorios["base"] = {
    pessoas,
    fonte: pessoas ? "diretorio" : "nenhuma",
  };

  // ---------- comunicados ----------
  const comunicados = s.comunicados ?? [];
  const obrigatorios = comunicados.filter((c) => c.obrigatorio);
  const obrigatoriosDetalhe: CoberturaComunicado[] = obrigatorios
    .map((c) => {
      const confirmacoes = new Set((c.leituras ?? []).map((u) => canonizar(u) || u)).size;
      return {
        id: c.id,
        titulo: c.titulo,
        publicadoEm: c.publicadoEm,
        confirmacoes,
        cobertura: fracao(confirmacoes, pessoas),
      };
    })
    .sort((a, b) => (a.publicadoEm < b.publicadoEm ? 1 : -1));
  const comCobertura = obrigatoriosDetalhe.filter((c) => c.cobertura !== null);

  // ---------- políticas (Fase 4) ----------
  const politicasConfig = s.politicasConfig ?? {};
  const lidas = s.politicasLidas ?? {};
  /** docId → nº de pessoas que confirmaram. */
  const confirmacoesPorDoc = new Map<string, number>();
  for (const porDoc of Object.values(lidas)) {
    for (const docId of Object.keys(porDoc ?? {})) {
      confirmacoesPorDoc.set(docId, (confirmacoesPorDoc.get(docId) ?? 0) + 1);
    }
  }
  const politicasDetalhe: CoberturaPolitica[] = Object.entries(politicasConfig)
    .filter(([, cfg]) => cfg?.obrigatoria)
    .map(([docId, cfg]) => {
      const confirmacoes = confirmacoesPorDoc.get(docId) ?? 0;
      return {
        docId,
        // O nome do arquivo mora no SharePoint; guardamos o que a UI mandou ao exigir a
        // leitura. Sem ele, o id do documento é o melhor rótulo disponível.
        nome: cfg?.nome || docId,
        definidaEm: cfg?.definidoEm,
        confirmacoes,
        cobertura: fracao(confirmacoes, pessoas),
      };
    })
    .sort((a, b) => a.confirmacoes - b.confirmacoes);

  // ---------- social (Fase 5) ----------
  const social = s.social ?? [];
  const engajamentoSocial = social.map((p) => ({
    id: p.id,
    autor: p.autor,
    rede: p.rede,
    curtidas: (p.curtidas ?? []).length,
    comentarios: (p.comentarios ?? []).length,
  }));

  // ---------- engajamento (ledger de pontos) ----------
  const mes = mesAtual();
  const pontos: PontoEvento[] = s.pontos ?? [];
  const doMes = pontos.filter((p) => (p.criadoEm ?? "").startsWith(mes));
  const porTipoMapa = new Map<TipoPonto, number>();
  const porPessoa = new Map<string, number>();
  for (const p of doMes) {
    porTipoMapa.set(p.tipo, (porTipoMapa.get(p.tipo) ?? 0) + p.pontos);
    const chave = canonizar(p.upn) || p.upn;
    porPessoa.set(chave, (porPessoa.get(chave) ?? 0) + p.pontos);
  }
  // Últimos 14 dias: pessoas DISTINTAS que pontuaram no dia (proxy de uso do portal).
  const porDia: SerieItem[] = [];
  for (let i = JANELA_DIAS - 1; i >= 0; i--) {
    const dia = new Date(agora - i * DIA_MS).toISOString().slice(0, 10);
    const ativos = new Set(
      pontos.filter((p) => (p.criadoEm ?? "").startsWith(dia)).map((p) => canonizar(p.upn) || p.upn),
    );
    porDia.push({ rotulo: dia, valor: ativos.size });
  }

  // ---------- tickets / reportes ----------
  const tickets = s.tickets ?? [];
  const emAberto = tickets.filter((t) => !["fechado", "resolvido", "cancelado"].includes(t.status));
  const maisAntigo = emAberto
    .map((t) => new Date(t.criadoEm).getTime())
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)[0];
  const reportes = s.reportes ?? [];

  // ---------- conteúdo publicado ----------
  const eventos = s.eventos ?? [];
  const temPerfis = (i: { perfis?: string[] }) => Boolean(i.perfis?.length);
  const artefatosRestritos =
    comunicados.filter(temPerfis).length +
    eventos.filter(temPerfis).length +
    social.filter(temPerfis).length +
    (s.bibliotecas ?? []).filter(temPerfis).length +
    (s.atalhos ?? []).filter(temPerfis).length;

  return {
    geradoEm: new Date().toISOString(),
    base,
    comunicados: {
      total: comunicados.length,
      obrigatorios: obrigatorios.length,
      ultimos30: comunicados.filter(
        (c) => agora - new Date(c.publicadoEm).getTime() <= 30 * DIA_MS,
      ).length,
      restritos: comunicados.filter(temPerfis).length,
      coberturaMedia: comCobertura.length
        ? comCobertura.reduce((acc, c) => acc + (c.cobertura ?? 0), 0) / comCobertura.length
        : null,
      porCategoria: contar(comunicados, (c) => rotulo(c.categoria)),
      obrigatoriosDetalhe,
    },
    politicas: {
      obrigatorias: politicasDetalhe.length,
      confirmacoesTotais: [...confirmacoesPorDoc.values()].reduce((a, b) => a + b, 0),
      pessoasQueConfirmaram: Object.keys(lidas).length,
      detalhe: politicasDetalhe,
    },
    social: {
      publicacoes: social.length,
      curtidas: engajamentoSocial.reduce((a, p) => a + p.curtidas, 0),
      comentarios: engajamentoSocial.reduce((a, p) => a + p.comentarios, 0),
      top: engajamentoSocial
        .sort((a, b) => b.curtidas + b.comentarios - (a.curtidas + a.comentarios))
        .slice(0, 5),
    },
    engajamento: {
      mes,
      participantes: porPessoa.size,
      pontosNoMes: doMes.reduce((a, p) => a + p.pontos, 0),
      porTipo: [...porTipoMapa.entries()]
        .map(([tipo, valor]) => ({ rotulo: PONTOS_CONFIG[tipo]?.label ?? rotulo(tipo), valor }))
        .sort((a, b) => b.valor - a.valor),
      porDia,
      top: [...porPessoa.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([chave, pontos]) => ({ chave, nome: perfilDeChave(chave).nome, pontos })),
    },
    tickets: {
      total: tickets.length,
      abertos: emAberto.length,
      porStatus: contar(tickets, (t) => rotulo(t.status)),
      porPrioridade: contar(tickets, (t) => rotulo(t.prioridade)),
      maisAntigoDias: maisAntigo ? Math.floor((agora - maisAntigo) / DIA_MS) : null,
    },
    reportes: {
      total: reportes.length,
      abertos: reportes.filter((r) => r.status === "aberto" || r.status === "em_analise").length,
      porStatus: contar(reportes, (r) => rotulo(r.status)),
      porTipo: contar(reportes, (r) => rotulo(r.tipo)),
    },
    conteudo: {
      eventosFuturos: eventos.filter((e) => new Date(e.inicio).getTime() >= agora).length,
      bibliotecas: (s.bibliotecas ?? []).length,
      atalhos: (s.atalhos ?? []).length,
      perfis: (s.perfis ?? []).length,
      artefatosRestritos,
    },
  };
}
