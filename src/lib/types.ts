// Tipos do domínio no frontend (espelham server/src/types.ts).
export type Prioridade = "alta" | "media" | "baixa";
export type Categoria = "feriado" | "rh" | "ferias" | "interno" | "ti" | "evento";

export type PublicoAlvo = "todos" | "clt" | "pj";

export interface Comunicado {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  categoria: Categoria;
  prioridade: Prioridade;
  autor: string;
  publicadoEm: string;
  fixado?: boolean;
  publico?: PublicoAlvo;
  departamentos?: string[];
  /** Perfis de acesso que enxergam o comunicado (vazio/ausente = todos). */
  perfis?: string[];
  obrigatorio?: boolean;
  leituras?: string[];
  imagens?: string[]; // até 3 imagens anexadas (data URLs)
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "confraternizacao" | "happy-hour" | "reuniao" | "treinamento" | "outro";
  inicio: string;
  fim?: string;
  local: string;
  imagem?: string; // foto opcional (data URL) — aparece no lugar da data
  /** Perfis de acesso que enxergam o evento (vazio/ausente = todos). */
  perfis?: string[];
}

export interface Aniversariante {
  id: string;
  nome: string;
  area: string;
  dia: number;
  mes: number;
  fotoUrl?: string;
}

export interface LinkUtil {
  id: string;
  label: string;
  url: string;
  icon: string;
  perfis?: string[];
  // Campos usados pelos ATALHOS DA EMPRESA (publicados pelo admin, segregados por perfil).
  categoria?: string;
  descricao?: string;
  ordem?: number;
}

/** Biblioteca de documentos: pasta do SharePoint/OneDrive listada (read-only) no portal.
 *  Mesmo motor das Políticas internas, agora com N pastas cadastradas na UI de admin. */
export interface Biblioteca {
  id: string;
  nome: string;
  descricao?: string;
  shareUrl: string;
  icone?: string;
  perfis?: string[];
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface PublicacaoSocial {
  id: string;
  rede: "linkedin" | "instagram" | "facebook" | "youtube";
  autor: string;
  texto: string;
  imagemUrl?: string;
  url: string;
  publicadoEm: string;
  perfis?: string[];
}

// ---- RBAC do portal: Grupo do Entra → Perfil de acesso → Página/Artefato ----
export type Acao = "ver" | "criar" | "editar" | "excluir";

export interface Perfil {
  id: string;
  nome: string;
  descricao?: string;
  gruposEntra: string[];
  gruposNomes?: string[];
  paginas: string[];
  permissoes: Record<string, Acao[]>;
  admin?: boolean;
  padrao?: boolean;
  sistema?: boolean;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface GrupoEntra {
  id: string;
  nome: string;
  descricao?: string;
  email?: string;
}

/** Acesso EFETIVO do usuário logado (união dos perfis concedidos pelos grupos do Entra). */
export interface Acesso {
  isAdmin: boolean;
  perfis: { id: string; nome: string }[];
  paginas: string[];
  permissoes: Record<string, Acao[]>;
  grupos?: string[];
}

/** Catálogo do RBAC (páginas/recursos/ações) — alimenta a matriz da tela de perfis. */
export interface RecursoDef {
  chave: string;
  label: string;
  acoes: Acao[];
}
export interface PaginaDef {
  rota: string;
  label: string;
  recurso?: string;
  admin?: boolean;
}
export interface CatalogoAcesso {
  paginas: PaginaDef[];
  recursos: RecursoDef[];
  acoes: Acao[];
}

export interface Pessoa {
  id: string;
  nome: string;
  cargo?: string;
  area?: string;
  email?: string;
  telefone?: string;
  fotoUrl?: string;
  tipoContrato?: PublicoAlvo;
  /** id do gestor (campo manager do Entra) — monta a hierarquia do organograma. */
  managerId?: string;
}

export interface Me extends Pessoa {
  isAdmin: boolean;
  /** Acesso efetivo resolvido pelo backend (perfis, páginas e permissões). */
  acesso?: Acesso;
  /** O backend confirmou uma identidade CONFIÁVEL nesta sessão? `false` = o portal não deve
   *  exibir conteúdo (mostra o gate de acesso). Ausente (backend antigo) → assume true. */
  autenticado?: boolean;
  /** Como a identidade foi obtida: `token` (SSO do Entra), `preview` (a única identidade
   *  sancionada pelo admin, usada dentro do iframe do preview), `demo` (Entra não
   *  configurado) ou `nenhuma`. Ver server/src/auth.ts. */
  origem?: "token" | "preview" | "demo" | "nenhuma";
}

export interface AgendaItem {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  local?: string;
  online?: boolean;
  organizador?: string;
}

export interface Ausencia {
  pessoa: Pessoa;
  mensagem?: string;
  ate?: string;
}

export interface OrgNode extends Pessoa {
  gestor?: Pessoa;
  liderados: Pessoa[];
  diretorio?: Pessoa[];
}

// ---- Gamificação (ranking + feedback) ----
export type TipoPonto =
  | "visita_diaria"
  | "ler_comunicado"
  | "confirmar_leitura"
  | "abrir_social"
  | "feedback_enviado"
  | "feedback_recebido";

/** Tipos de ação que o CLIENTE pode registrar diretamente (os demais são server-side). */
export type TipoPontoCliente = "visita_diaria" | "ler_comunicado" | "abrir_social";

export type PontosConfig = Record<TipoPonto, { pontos: number; label: string }>;

export interface RankingEntry {
  upn: string;
  nome: string;
  fotoUrl?: string;
  cargo?: string;
  area?: string;
  total: number;
  porTipo: Partial<Record<TipoPonto, number>>;
  posicao: number;
}

export interface ResumoPontos {
  mes: string;
  upn: string;
  total: number;
  posicao: number | null;
  participantes: number;
  porTipo: Partial<Record<TipoPonto, number>>;
}

/** Extrato de auditoria do admin: como cada usuário pontuou, por dia. */
export interface AtividadeItem {
  tipo: TipoPonto;
  label: string;
  pontos: number;
  hora: string; // HH:MM
  refId?: string;
}
export interface AtividadeUsuario {
  upn: string;
  nome: string;
  fotoUrl?: string;
  cargo?: string;
  area?: string;
  total: number;
  itens: AtividadeItem[];
}
export interface AtividadeDia {
  dia: string; // YYYY-MM-DD
  total: number;
  usuarios: AtividadeUsuario[];
}

export interface Feedback {
  id: string;
  de: string;
  deNome: string;
  para: string;
  paraNome: string;
  mensagem: string;
  criadoEm: string;
  /** Fotos resolvidas pelo backend (diretório) — mostram o rosto no mural/listas. */
  deFoto?: string;
  paraFoto?: string;
}

export interface FeedbacksResposta {
  recentes: Feedback[];
  recebidos: Feedback[];
  enviados: Feedback[];
}

// ---- Tickets / chamados (integração futura com trustsis-itsm) ----
export type TicketStatus =
  | "aberto" | "em_andamento" | "aguardando" | "resolvido" | "fechado" | "cancelado";
export type TicketPrioridade = "baixa" | "media" | "alta" | "critica";
export type TicketTipo = "incidente" | "requisicao";

export interface Ticket {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  tipo: TicketTipo;
  prioridade: TicketPrioridade;
  status: TicketStatus;
  solicitante: string;
  solicitanteNome: string;
  responsavel?: string;
  criadoEm: string;
  atualizadoEm?: string;
  externoRef?: string;
}

// ---- Feedback do portal (bug / melhoria / outro) ----
export type ReporteTipo = "bug" | "melhoria" | "outro";
export type ReporteStatus = "aberto" | "em_analise" | "resolvido" | "arquivado";

export interface Reporte {
  id: string;
  tipo: ReporteTipo;
  titulo: string;
  mensagem: string;
  pagina?: string;
  de: string;
  deNome: string;
  status: ReporteStatus;
  criadoEm: string;
  atualizadoEm?: string;
}

// ---- Políticas de utilização interna ----
// Documentos compartilhados numa pasta do SharePoint/OneDrive (read-only). Cada subpasta
// vira uma categoria; arquivos na raiz caem em "Geral".
export interface PoliticaDoc {
  id: string;
  nome: string;
  categoria?: string;
  tipo?: string; // rótulo do formato (PDF, Word…)
  tamanho?: number; // bytes
  atualizadoEm?: string; // ISO
  webUrl: string; // abrir/baixar no SharePoint
}

// ---- Configuração de integração (SSO / Entra ID / Graph / políticas / ITSM) ----
// Editável em Administração. O `.env` do servidor é só o BOOTSTRAP: o que o admin salva
// no portal passa a ter precedência — `origem` diz, campo a campo, quem está mandando.
export type OrigemCampo = "env" | "store" | "vazio";

export interface IntegracaoConfig {
  tenantId: string;
  clientId: string;
  /** O segredo NUNCA volta do backend: só a informação de que existe um salvo. */
  temSecret: boolean;
  adminGroupId: string;
  demoUserUpn: string;
  politicasShareUrl: string;
  itsmBaseUrl: string;
  itsmApiScope: string;
  itsmTenantSubdomain: string;
  authRequired: boolean;
  // Estado derivado pelo backend — o que está de fato ligado agora.
  graphAtivo: boolean;
  ssoConfigurado: boolean;
  barreiraAtiva: boolean;
  itsmAtivo: boolean;
  /** De onde vem o valor efetivo de cada campo (chave = nome do campo). */
  origem: Record<string, OrigemCampo>;
  atualizadoEm?: string; // ISO
  atualizadoPor?: string; // UPN de quem salvou
}

// ---- Marca do portal (logo da navbar), carregada em Administração › Marca ----
// Data URL (PNG/SVG) guardada no store do backend. Vazio = logo padrão do build.
export interface Marca {
  /** Logo do menu ABERTO (horizontal, com o nome) — TEMA CLARO. */
  logoExpandido: string;
  /** Logo do menu RECOLHIDO (quadrado) — TEMA CLARO. Vazio = reusa o expandido. */
  logoColapsado: string;
  /** Logo do menu ABERTO no TEMA ESCURO. Vazio = reusa o do tema claro. */
  logoExpandidoEscuro?: string;
  /** Logo do menu RECOLHIDO no TEMA ESCURO. Vazio = reusa o do tema claro. */
  logoColapsadoEscuro?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}
