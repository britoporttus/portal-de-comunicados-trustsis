// Motor de gamificação: registra pontos (com dedup anti-farm), agrega o ranking mensal
// e resolve nomes/fotos dos participantes. O ledger vive no store (JSON) como `pontos`.
import type { PontoEvento, TipoPonto, Pessoa } from "./types.js";
import { getStore, mutate, newId } from "./store.js";
import { getCachedDiretorio } from "./cache.js";
import { isGraphOn } from "./graph.js";
import { mockPeople } from "./mock.js";

/** Valor e rótulo de cada tipo de ação. Fonte da verdade dos pontos (o cliente NUNCA
 *  informa quantos pontos vale — o servidor decide, evitando manipulação). */
export const PONTOS_CONFIG: Record<TipoPonto, { pontos: number; label: string }> = {
  visita_diaria: { pontos: 5, label: "Visita diária ao portal" },
  ler_comunicado: { pontos: 10, label: "Leu um comunicado" },
  confirmar_leitura: { pontos: 15, label: "Confirmou leitura obrigatória" },
  abrir_social: { pontos: 8, label: "Acessou uma rede social" },
  feedback_enviado: { pontos: 5, label: "Enviou um feedback" },
  feedback_recebido: { pontos: 20, label: "Recebeu um feedback" },
};

/** Mês corrente no formato YYYY-MM (horário do servidor). */
export function mesAtual(): string {
  return new Date().toISOString().slice(0, 7);
}

function diaAtual(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Constrói a chave de idempotência de um evento — define a granularidade do "1x". */
function dedupKey(upn: string, tipo: TipoPonto, refId?: string): string {
  switch (tipo) {
    case "visita_diaria":
      return `${upn}|visita_diaria|${diaAtual()}`; // 1x por dia
    case "abrir_social":
      return `${upn}|abrir_social|${refId ?? "?"}|${diaAtual()}`; // 1x/dia por post
    case "ler_comunicado":
    case "confirmar_leitura":
      return `${upn}|${tipo}|${refId ?? "?"}`; // 1x por comunicado (para sempre)
    default:
      // feedback_*: refId é o id (único) do feedback → naturalmente idempotente
      return `${upn}|${tipo}|${refId ?? newId("fb")}`;
  }
}

export interface RegistroResultado {
  registrado: boolean; // false quando já havia pontuado (dedup)
  pontos: number; // pontos concedidos neste registro (0 se dedup)
  tipo: TipoPonto;
}

/** Diretório disponível para resolver nome/foto (cache do Graph, ou mock em demo). */
function diretorio(): Pessoa[] {
  if (isGraphOn) return getCachedDiretorio() ?? [];
  return mockPeople;
}

/** Chave CANÔNICA de identidade: colapsa oid(GUID) e e-mail da MESMA pessoa numa única
 *  chave. Em prod a identidade resolvida oscila entre o oid (GUID) e o e-mail conforme a
 *  sessão/login — sem isso o mesmo colaborador pontua sob duas chaves e aparece DUPLICADO
 *  no ranking. Preferimos o e-mail (estável e legível); caímos no id só se não houver e-mail;
 *  e, se a chave não casar no diretório, devolvemos ela mesma (normalizada). */
function chaveCanonica(upn: string, dir: Pessoa[]): string {
  const chave = (upn || "").toLowerCase();
  if (!chave) return chave;
  const p =
    dir.find((x) => (x.email ?? "").toLowerCase() === chave) ??
    dir.find((x) => x.id.toLowerCase() === chave);
  if (!p) return chave;
  return (p.email ?? "").toLowerCase() || p.id.toLowerCase();
}

/** Concede pontos de uma ação, respeitando o dedup. Idempotente. */
export function registrarPonto(upn: string, tipo: TipoPonto, refId?: string): RegistroResultado {
  const conf = PONTOS_CONFIG[tipo];
  // Grava já na chave canônica → novos eventos ficam consistentes (não duplicam no futuro).
  const chaveUsuario = chaveCanonica(upn, diretorio());
  if (!conf || !chaveUsuario) return { registrado: false, pontos: 0, tipo };
  const dedup = dedupKey(chaveUsuario, tipo, refId);

  return mutate((s) => {
    if (!s.pontos) s.pontos = [];
    if (s.pontos.some((p) => p.dedup === dedup)) {
      return { registrado: false, pontos: 0, tipo };
    }
    const ev: PontoEvento = {
      id: newId("pt"),
      upn: chaveUsuario,
      tipo,
      pontos: conf.pontos,
      refId,
      dedup,
      criadoEm: new Date().toISOString(),
    };
    s.pontos.push(ev);
    return { registrado: true, pontos: conf.pontos, tipo };
  });
}

function nomeDeUpn(upn: string, dir: Pessoa[]): { nome: string; fotoUrl?: string; cargo?: string; area?: string } {
  const chave = (upn || "").toLowerCase();
  // Casa por E-MAIL ou por ID (oid). Em produção a identidade resolvida costuma ser o
  // `oid` (GUID) — não o e-mail — quando o login já é um member @trustsis.com (sem alias
  // de domínio). Sem o match por id, o GUID vazava como "nome" no ranking/feedback.
  const p =
    dir.find((x) => (x.email ?? "").toLowerCase() === chave) ??
    dir.find((x) => x.id.toLowerCase() === chave);
  if (p) return { nome: p.nome, fotoUrl: p.fotoUrl, cargo: p.cargo, area: p.area };
  // Sem correspondência no diretório: se for um e-mail, usa a parte local como nome
  // legível; se for um GUID (sem @), evita exibir o id cru — mostra rótulo neutro.
  if (!chave.includes("@")) return { nome: "Colaborador" };
  const local = chave.split("@")[0].replace(/[._-]+/g, " ");
  const nome = local.replace(/\b\w/g, (c) => c.toUpperCase());
  return { nome };
}

/** Resolve nome/foto/cargo/área de uma chave (e-mail ou oid) contra o diretório atual.
 *  Exposto para outros módulos (ex.: enriquecer os feedbacks com a foto de quem enviou/recebeu). */
export function perfilDeChave(chave: string): { nome: string; fotoUrl?: string; cargo?: string; area?: string } {
  return nomeDeUpn(chave, diretorio());
}

export interface RankingEntry {
  upn: string;
  nome: string;
  fotoUrl?: string;
  cargo?: string;
  area?: string;
  total: number;
  porTipo: Partial<Record<TipoPonto, number>>; // pontos acumulados por tipo
  posicao: number; // 1-based
}

/** Ranking agregado de um mês (YYYY-MM). Ordena por total desc, depois nome. */
export function ranking(mes = mesAtual()): RankingEntry[] {
  const eventos = (getStore().pontos ?? []).filter((p) => p.criadoEm.slice(0, 7) === mes);
  const dir = diretorio();
  const porUsuario = new Map<string, { total: number; porTipo: Partial<Record<TipoPonto, number>> }>();
  for (const e of eventos) {
    // Agrega pela chave canônica → colapsa eventos do mesmo colaborador que ficaram
    // gravados sob oid e e-mail diferentes (sincroniza os dados históricos, sem migração).
    const chave = chaveCanonica(e.upn, dir);
    const cur = porUsuario.get(chave) ?? { total: 0, porTipo: {} };
    cur.total += e.pontos;
    cur.porTipo[e.tipo] = (cur.porTipo[e.tipo] ?? 0) + e.pontos;
    porUsuario.set(chave, cur);
  }
  const linhas = [...porUsuario.entries()].map(([upn, v]) => ({
    upn,
    ...nomeDeUpn(upn, dir),
    total: v.total,
    porTipo: v.porTipo,
  }));
  linhas.sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));
  return linhas.map((l, i) => ({ ...l, posicao: i + 1 }));
}

export interface ResumoPontos {
  mes: string;
  upn: string;
  total: number; // pontos do usuário no mês
  posicao: number | null; // posição no ranking do mês (null se sem pontos)
  participantes: number; // quantas pessoas pontuaram no mês
  porTipo: Partial<Record<TipoPonto, number>>;
}

/** Resumo do usuário atual (para o badge do topo e a seção "meus pontos"). */
export function resumoDoUsuario(upn: string, mes = mesAtual()): ResumoPontos {
  const chave = chaveCanonica(upn, diretorio());
  const rk = ranking(mes);
  const eu = rk.find((r) => r.upn === chave);
  return {
    mes,
    upn: chave,
    total: eu?.total ?? 0,
    posicao: eu?.posicao ?? null,
    participantes: rk.length,
    porTipo: eu?.porTipo ?? {},
  };
}
