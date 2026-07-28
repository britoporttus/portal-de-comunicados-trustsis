// Tipos do domínio no frontend (espelham server/src/types.ts).
export type Prioridade = "alta" | "media" | "baixa";
export type Categoria = "feriado" | "rh" | "ferias" | "interno" | "ti" | "evento";

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
}

export interface Evento {
  id: string;
  titulo: string;
  descricao: string;
  tipo: "confraternizacao" | "happy-hour" | "reuniao" | "treinamento" | "outro";
  inicio: string;
  fim?: string;
  local: string;
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
}
