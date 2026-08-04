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
}

export interface PublicacaoSocial {
  id: string;
  rede: "linkedin" | "instagram" | "facebook" | "youtube";
  autor: string;
  texto: string;
  imagemUrl?: string;
  url: string;
  publicadoEm: string;
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
export interface Politica {
  id: string;
  titulo: string;
  conteudo: string;
  categoria?: string;
  ordem?: number;
  atualizadoEm: string;
}
