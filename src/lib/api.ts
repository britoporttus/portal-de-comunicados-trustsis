// Cliente HTTP tipado para a API do portal (proxy /api -> backend Node).
import type {
  Me, AgendaItem, OrgNode, Ausencia,
  Comunicado, Evento, Aniversariante, LinkUtil, PublicacaoSocial,
  TipoPontoCliente, RankingEntry, ResumoPontos, PontosConfig, Feedback, FeedbacksResposta,
  AtividadeDia, Ticket, TicketTipo, TicketPrioridade,
  Reporte, ReporteTipo, ReporteStatus, PoliticaDoc, Biblioteca,
  Perfil, GrupoEntra, CatalogoAcesso, IntegracaoConfig, Marca, Auditoria,
  Relatorios, MeuDrive,
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
  // Sem token (portal embutido no preview, onde o login do Entra é impossível) o cliente NÃO
  // diz quem é: quem decide a identidade é o backend, com a única identidade sancionada em
  // Administração › Integração. Não existe mais cabeçalho de "entrar como".
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
    // Fase 3 — cria o compromisso na agenda (Outlook) de QUEM pediu. `demo: true` quando o
    // Graph está desligado (preview): a marcação vale, mas nada é escrito no calendário.
    adicionarNaAgenda: (id: string, upn?: string) =>
      req<{ ok: boolean; ja?: boolean; demo?: boolean; evento: Evento }>(
        comUpn(`/eventos/${id}/agenda`, upn),
        { method: "POST" },
      ),
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
    // O UPN vai junto para o backend marcar `euCurti` (a comparação é por chave canônica).
    list: (upn?: string) => req<PublicacaoSocial[]>(comUpn("/social", upn)),
    create: (b: Partial<PublicacaoSocial>) => req<PublicacaoSocial>("/social", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<PublicacaoSocial>) => req<PublicacaoSocial>(`/social/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/social/${id}`, { method: "DELETE" }),
    // ---- Fase 5: engajamento interno (curtidas/comentários vivem no portal) ----
    curtir: (id: string, upn?: string) =>
      req<PublicacaoSocial>(comUpn(`/social/${id}/curtir`, upn), { method: "POST" }).then(
        (r) => (emitirPontosMudou(), r),
      ),
    comentar: (id: string, texto: string, deNome?: string, upn?: string) =>
      req<PublicacaoSocial>(comUpn(`/social/${id}/comentarios`, upn), {
        method: "POST",
        body: JSON.stringify({ texto, deNome }),
      }).then((r) => (emitirPontosMudou(), r)),
    removerComentario: (id: string, cid: string, upn?: string) =>
      req<PublicacaoSocial>(comUpn(`/social/${id}/comentarios/${cid}`, upn), { method: "DELETE" }),
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
    // Cada doc já vem com `obrigatoria` (decisão do admin) e `confirmadoEm` (deste usuário).
    list: (upn?: string) => req<PoliticaDoc[]>(comUpn("/politicas", upn)),
    // Link embutível para LER a política dentro do portal (null = cai no SharePoint).
    preview: (docId: string) => req<{ url: string | null }>(`/politicas/${docId}/preview`),
    // ADMIN: exigir (ou não) confirmação de leitura de um documento.
    definirObrigatoria: (docId: string, obrigatoria: boolean, nome?: string, upn?: string) =>
      req<{ docId: string; obrigatoria?: boolean }>(comUpn(`/politicas/${docId}/obrigatoria`, upn), {
        method: "PUT",
        body: JSON.stringify({ obrigatoria, nome }),
      }),
    // "Li e concordo" — idempotente, pontua uma única vez por documento.
    confirmar: (docId: string, upn?: string) =>
      req<{ docId: string; confirmadoEm: string }>(comUpn(`/politicas/${docId}/ler`, upn), {
        method: "POST",
      }).then((r) => (emitirPontosMudou(), r)),
  },

  // ---- Auditoria da administração (Fase 6): quem mudou o quê e quando ----
  auditoria: {
    list: (limite = 200, upn?: string) =>
      req<Auditoria[]>(comUpn(`/auditoria?limite=${limite}`, upn)),
  },

  // ---- Relatórios da administração: cobertura de leitura, engajamento e uso do portal ----
  relatorios: {
    get: (upn?: string) => req<Relatorios>(comUpn("/relatorios", upn)),
  },

  // ---- OneDrive pessoal ("Meus arquivos"): navegação read-only no drive do usuário ----
  // Sem `pasta` = raiz. O backend usa a identidade da requisição: ninguém alcança outro drive.
  meuDrive: {
    list: (pasta?: string, upn?: string) =>
      req<MeuDrive>(comUpn(`/meudrive${pasta ? `?pasta=${encodeURIComponent(pasta)}` : ""}`, upn)),
  },

  // ---- Atalhos da EMPRESA (institucionais/dashboards externos, segregados por perfil) ----
  // Não confundir com `links`, que são os atalhos PESSOAIS de cada colaborador.
  atalhos: {
    list: () => req<LinkUtil[]>("/atalhos"),
    create: (b: Partial<LinkUtil>) => req<LinkUtil>("/atalhos", { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<LinkUtil>) =>
      req<LinkUtil>(`/atalhos/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string) => req<void>(`/atalhos/${id}`, { method: "DELETE" }),
  },

  // ---- Bibliotecas de documentos (pastas do SharePoint/OneDrive cadastradas na UI) ----
  bibliotecas: {
    list: () => req<Biblioteca[]>("/bibliotecas"),
    // Documentos de UMA biblioteca (lidos do Graph, cache curto no servidor).
    docs: (id: string, forcar = false) =>
      req<PoliticaDoc[]>(`/bibliotecas/${id}/docs${forcar ? "?forcar=true" : ""}`),
    // upn vai junto para a AUDITORIA (Fase 6) atribuir a ação a quem a fez.
    create: (b: Partial<Biblioteca>, upn?: string) =>
      req<Biblioteca>(comUpn("/bibliotecas", upn), { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Biblioteca>, upn?: string) =>
      req<Biblioteca>(comUpn(`/bibliotecas/${id}`, upn), { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string, upn?: string) =>
      req<void>(comUpn(`/bibliotecas/${id}`, upn), { method: "DELETE" }),
  },

  // ---- RBAC: perfis de acesso do portal (Grupo do Entra → Perfil → Página/Artefato) ----
  acesso: {
    // Catálogo de páginas/recursos/ações: monta a matriz de permissões da tela de admin.
    catalogo: () => req<CatalogoAcesso>("/acesso/catalogo"),
  },
  // Grupos do Entra disponíveis para associar a um perfil (o admin escolhe, não digita GUID).
  gruposEntra: (upn?: string) => req<GrupoEntra[]>(comUpn("/grupos-entra", upn)),
  perfis: {
    list: (upn?: string) => req<Perfil[]>(comUpn("/perfis", upn)),
    create: (b: Partial<Perfil>, upn?: string) =>
      req<Perfil>(comUpn("/perfis", upn), { method: "POST", body: JSON.stringify(b) }),
    update: (id: string, b: Partial<Perfil>, upn?: string) =>
      req<Perfil>(comUpn(`/perfis/${id}`, upn), { method: "PUT", body: JSON.stringify(b) }),
    remove: (id: string, upn?: string) =>
      req<{ ok: boolean; artefatosAtualizados: number }>(comUpn(`/perfis/${id}`, upn), {
        method: "DELETE",
      }),
  },
  // ---- Configuração de integração (SSO/Entra, Graph, políticas, ITSM) editável no admin ----
  // O `.env` do servidor é só bootstrap; o que for salvo aqui tem precedência.
  integracao: {
    get: (upn?: string) => req<IntegracaoConfig>(comUpn("/integracao", upn)),
    // `clientSecret` vazio/ausente PRESERVA o segredo já salvo (o GET nunca o devolve).
    save: (b: Partial<IntegracaoConfig> & { clientSecret?: string }, upn?: string) =>
      req<IntegracaoConfig>(comUpn("/integracao", upn), { method: "PUT", body: JSON.stringify(b) }),
    // Valida as credenciais SALVAS pegando um token app-only e lendo os grupos do tenant.
    testar: (upn?: string) =>
      req<{ ok: boolean; detalhe: string; grupos?: number }>(comUpn("/integracao/testar", upn), {
        method: "POST",
      }),
  },

  // ---- Marca do portal (logo da navbar), gerida em Administração › Marca ----
  // A LEITURA é pública (fica antes da barreira no backend, para o logo aparecer também na
  // tela de login); só a gravação exige permissão de administração.
  marca: {
    get: () => req<Marca>("/marca"),
    // Campo ausente = não mexe; string vazia = remove aquele logo (volta ao padrão do build).
    save: (
      b: Partial<
        Pick<Marca, "logoExpandido" | "logoColapsado" | "logoExpandidoEscuro" | "logoColapsadoEscuro">
      >,
      upn?: string,
    ) =>
      req<Marca>(comUpn("/marca", upn), { method: "PUT", body: JSON.stringify(b) }),
  },

  // Opções de perfil (id+nome) para o seletor de segregação dos artefatos (Fase 1).
  // Aberto a qualquer autenticado — publicar conteúdo não exige ser admin do RBAC.
  perfisOpcoes: () => req<{ id: string; nome: string }[]>("/perfis/opcoes"),
};
