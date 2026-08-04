// Cliente HTTP tipado para a API do portal (proxy /api -> backend Node).
import type {
  Me, AgendaItem, OrgNode, Ausencia,
  Comunicado, Evento, Aniversariante, LinkUtil, PublicacaoSocial,
  TipoPontoCliente, RankingEntry, ResumoPontos, PontosConfig, Feedback, FeedbacksResposta,
  AtividadeDia, Ticket, TicketTipo, TicketPrioridade,
  Reporte, ReporteTipo, ReporteStatus, PoliticaDoc,
} from "./types";
import { getAuthToken } from "./auth";

/** Evento global disparado sempre que o usuário GANHA pontos (leu comunicado, enviou
 *  feedback, confirmou leitura…). O badge do topo escuta e recarrega o resumo — assim os
 *  pontos/posição sincronizam na hora, sem precisar recarregar a página. */
export const PONTOS_EVENT = "pontos:mudou";
export function emitirPontosMudou() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PONTOS_EVENT));
}

/** Sufixo ?upn= para as rotas que dependem da identidade (em produção o backend
 *  sobrescreve com o usuário real do token; no preview usamos o e-mail do `me`). */
function comUpn(base: string, upn?: string): string {
  if (!upn) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}upn=${encodeURIComponent(upn)}`;
}

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  // Barreira de identidade: quando o SSO está ativo (produção), anexa o idToken como
  // Bearer. No preview (auth desligado) getAuthToken() devolve null e nada muda.
  const token = await getAuthToken();
  const r = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts?.headers ?? {}),
    },
  });
  if (!r.ok) throw new Error(`API ${r.status} em ${path}`);
  if (r.status === 204) return undefined as T;
  return (await r.json()) as T;
}

export const api = {
  health: () => req<{ ok: boolean; graph: boolean; mode: string }>("/health"),
  me: () => req<Me>("/me"),
  agenda: () => req<AgendaItem[]>("/agenda"),
  org: () => req<OrgNode>("/org"),
  ferias: () => req<Ausencia[]>("/ferias"),
  departamentos: () => req<string[]>("/departamentos"),

  // Status/execução do scan diário (organograma + férias fixados).
  scan: {
    status: () =>
      req<{ atualizadoEm: string | null; rodando: boolean; pessoas: number; ausencias: number; graph: boolean }>(
        "/scan/status",
      ),
    run: () =>
      req<{ atualizadoEm: string | null; rodando: boolean; pessoas: number; ausencias: number }>("/scan/run", {
        method: "POST",
      }),
  },

  comunicados: {
    list: () => req<Comunicado[]>("/comunicados"),
    get: (id: string) => req<Comunicado>(`/comunicados/${id}`),
    create: (b: Partial<Comunicado>) => req<Comunicado>("/comunicados", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Comunicado>) => req<Comunicado>(`/comunicados/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/comunicados/${id}`, { method: "DELETE" }),
    confirmarLeitura: (id: string, upn: string) =>
      req<Comunicado>(`/comunicados/${id}/ler`, { method: "POST", body: JSON.stringify({ upn }) }).then(
        (r) => (emitirPontosMudou(), r),
      ),
  },
  eventos: {
    list: () => req<Evento[]>("/eventos"),
    get: (id: string) => req<Evento>(`/eventos/${id}`),
    create: (b: Partial<Evento>) => req<Evento>("/eventos", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Evento>) => req<Evento>(`/eventos/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/eventos/${id}`, { method: "DELETE" }),
  },
  aniversariantes: {
    list: () => req<Aniversariante[]>("/aniversariantes"),
    create: (b: Partial<Aniversariante>) => req<Aniversariante>("/aniversariantes", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Aniversariante>) => req<Aniversariante>(`/aniversariantes/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/aniversariantes/${id}`, { method: "DELETE" }),
  },
  links: {
    // Links são personalizados por usuário: passamos o UPN/e-mail do colaborador logado.
    list: (upn?: string) => req<LinkUtil[]>(`/links${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`),
    create: (b: Partial<LinkUtil>, upn?: string) =>
      req<LinkUtil>(`/links${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`, { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<LinkUtil>, upn?: string) =>
      req<LinkUtil>(`/links/${id}${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string, upn?: string) =>
      req<void>(`/links/${id}${upn ? `?upn=${encodeURIComponent(upn)}` : ""}`, { method: "DELETE" }),
  },
  social: {
    list: () => req<PublicacaoSocial[]>("/social"),
    create: (b: Partial<PublicacaoSocial>) => req<PublicacaoSocial>("/social", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<PublicacaoSocial>) => req<PublicacaoSocial>(`/social/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/social/${id}`, { method: "DELETE" }),
  },

  // ---- Gamificação ----
  pontos: {
    config: () => req<PontosConfig>("/pontos/config"),
    ranking: (mes?: string) =>
      req<{ mes: string; entradas: RankingEntry[] }>(`/pontos/ranking${mes ? `?mes=${mes}` : ""}`),
    me: (upn?: string) => req<ResumoPontos>(comUpn("/pontos/me", upn)),
    // Extrato de auditoria por dia (admin): como cada usuário pontuou.
    atividade: (mes?: string) =>
      req<{ mes: string; dias: AtividadeDia[] }>(`/pontos/atividade${mes ? `?mes=${mes}` : ""}`),
    // Registra uma ação pontuável. Best-effort: nunca lança para não quebrar a navegação.
    // Se de fato pontuou, avisa o badge do topo (evento global) para sincronizar na hora.
    registrar: (tipo: TipoPontoCliente, refId: string | undefined, upn?: string) =>
      req<{ registrado: boolean; pontos: number }>(comUpn("/pontos", upn), {
        method: "POST",
        body: JSON.stringify({ tipo, refId }),
      })
        .then((r) => (r.registrado && emitirPontosMudou(), r))
        .catch(() => ({ registrado: false, pontos: 0 })),
  },
  feedbacks: {
    list: (upn?: string) => req<FeedbacksResposta>(comUpn("/feedbacks", upn)),
    create: (b: { para: string; paraNome: string; mensagem: string; deNome: string }, upn?: string) =>
      req<Feedback>(comUpn("/feedbacks", upn), { method: "POST", body: JSON.stringify(b) }).then(
        (r) => (emitirPontosMudou(), r),
      ),
    // ADMIN: apaga um feedback (o backend valida o papel) e reverte os pontos vinculados.
    remove: (id: string, upn?: string) =>
      req<{ ok: boolean; pontosRevertidos: boolean }>(comUpn(`/feedbacks/${id}`, upn), {
        method: "DELETE",
      }).then((r) => (emitirPontosMudou(), r)),
  },

  // ---- Tickets / chamados (em construção: integração futura com trustsis-itsm) ----
  tickets: {
    // "Meus tickets": o backend filtra pelos chamados do usuário atual (por solicitante).
    list: (upn?: string) => req<Ticket[]>(comUpn("/tickets", upn)),
    create: (
      b: { titulo: string; descricao: string; tipo: TicketTipo; prioridade: TicketPrioridade; solicitanteNome: string },
      upn?: string,
    ) => req<Ticket>(comUpn("/tickets", upn), { method: "POST", body: JSON.stringify(b) }),
  },

  // ---- Feedback do portal (bug / melhoria / outro sobre a aplicação) ----
  reportes: {
    // Admin recebe todos; colaborador recebe só os seus (o backend decide pelo papel).
    list: (upn?: string) => req<Reporte[]>(comUpn("/reportes", upn)),
    create: (
      b: { tipo: ReporteTipo; titulo: string; mensagem: string; pagina?: string; deNome: string },
      upn?: string,
    ) => req<Reporte>(comUpn("/reportes", upn), { method: "POST", body: JSON.stringify(b) }),
    // ADMIN: muda o status (triagem/andamento/resolução).
    updateStatus: (id: string, status: ReporteStatus, upn?: string) =>
      req<Reporte>(comUpn(`/reportes/${id}`, upn), { method: "PUT", body: JSON.stringify({ status }) }),
    remove: (id: string, upn?: string) =>
      req<void>(comUpn(`/reportes/${id}`, upn), { method: "DELETE" }),
  },

  // ---- Políticas de utilização interna (documentos do SharePoint, read-only) ----
  politicas: {
    list: () => req<PoliticaDoc[]>("/politicas"),
  },
};
