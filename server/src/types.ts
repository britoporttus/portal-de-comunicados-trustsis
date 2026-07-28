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
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "confraternizacao" | "happy-hour" | "reuniao" | "treinamento" | "outro";
  inicio: string; // ISO
  fim?: string; // ISO
  local: string;
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

export interface Store {
  comunicados: Comunicado[];
  eventos: Evento[];
  aniversariantes: Aniversariante[];
  links: LinkUtil[]; // atalhos padrão (usados quando o usuário ainda não personalizou)
  social: PublicacaoSocial[];
  // Links personalizados por usuário (chave = e-mail/UPN). Cada um gerencia os seus.
  linksByUser?: Record<string, LinkUtil[]>;
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
