// Tipos compartilhados do domínio do portal.
export type Prioridade = "alta" | "media" | "baixa";
export type Categoria = "feriado" | "rh" | "ferias" | "interno" | "ti" | "evento";

/** Público-alvo por tipo de contrato. "todos" = sem restrição de contrato. */
export type PublicoAlvo = "todos" | "clt" | "pj";

export interface Comunicado {
  id: string;
  titulo: string;
  resumo: string;
  conteudo: string;
  categoria: Categoria;
  prioridade: Prioridade;
  autor: string;
  publicadoEm: string; // ISO
  fixado?: boolean;
  // Segmentação: por tipo de contrato e/ou por departamentos/grupos.
  publico?: PublicoAlvo; // default "todos"
  departamentos?: string[]; // vazio/ausente = todos os departamentos
  obrigatorio?: boolean; // exige confirmação de leitura
  leituras?: string[]; // e-mails/UPN de quem confirmou a leitura
  imagens?: string[]; // até 3 imagens anexadas (data URLs comprimidas)
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "confraternizacao" | "happy-hour" | "reuniao" | "treinamento" | "outro";
  inicio: string; // ISO
  fim?: string; // ISO
  local: string;
  imagem?: string; // foto opcional (data URL comprimida) — aparece no lugar da data
}

export interface Aniversariante {
  id: string;
  nome: string;
  area: string;
  dia: number; // 1-31
  mes: number; // 1-12
  fotoUrl?: string;
}

export interface LinkUtil {
  id: string;
  label: string;
  url: string;
  icon: string; // nome do ícone lucide ou chave conhecida
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

// ---- Gamificação (ranking + feedback) ----
/** Ações que geram pontos no portal. */
export type TipoPonto =
  | "visita_diaria" // acessou o portal (1x/dia)
  | "ler_comunicado" // abriu o detalhe de um comunicado (1x por comunicado)
  | "confirmar_leitura" // confirmou leitura de um comunicado obrigatório (1x por comunicado)
  | "abrir_social" // acessou uma publicação de rede social (1x/dia por post)
  | "feedback_enviado" // enviou um feedback a um colega
  | "feedback_recebido"; // recebeu um feedback de um colega

/** Um lançamento no ledger de pontos. Imutável; ranking é a agregação destes. */
export interface PontoEvento {
  id: string;
  upn: string; // quem pontuou (e-mail/UPN em minúsculas)
  tipo: TipoPonto;
  pontos: number;
  refId?: string; // id do comunicado/social/feedback relacionado (contexto/dedup)
  dedup: string; // chave de idempotência (evita farm de pontos)
  criadoEm: string; // ISO
}

/** Feedback entre colaboradores (aba de feedback). Gera pontos ao destinatário. */
export interface Feedback {
  id: string;
  de: string; // upn de quem enviou
  deNome: string; // nome de quem enviou (capturado no envio)
  para: string; // upn do destinatário
  paraNome: string; // nome do destinatário
  mensagem: string;
  criadoEm: string; // ISO
  // Fotos resolvidas no MOMENTO da resposta (não persistidas — evita inchar o store com
  // data URLs). Preenchidas a partir do diretório para o mural/listas mostrarem o rosto.
  deFoto?: string;
  paraFoto?: string;
}

export interface Store {
  comunicados: Comunicado[];
  eventos: Evento[];
  aniversariantes: Aniversariante[];
  links: LinkUtil[]; // atalhos padrão (usados quando o usuário ainda não personalizou)
  social: PublicacaoSocial[];
  // Links personalizados por usuário (chave = e-mail/UPN). Cada um gerencia os seus.
  linksByUser?: Record<string, LinkUtil[]>;
  // Gamificação: ledger de pontos e feedbacks entre colegas.
  pontos?: PontoEvento[];
  feedbacks?: Feedback[];
}

// ---- Graph / pessoas ----
export interface Pessoa {
  id: string;
  nome: string;
  cargo?: string;
  area?: string;
  email?: string;
  telefone?: string;
  fotoUrl?: string;
  /** Tipo de contrato derivado do employeeType do Entra ("clt" | "pj"). */
  tipoContrato?: PublicoAlvo;
  /** id do gestor (campo manager do Entra) — usado para montar a árvore do organograma. */
  managerId?: string;
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
  diretorio?: Pessoa[]; // diretório completo da empresa (todos os usuários do Entra)
}
