// Helpers de formatação (datas em pt-BR) e metadados visuais de categorias/prioridades.
import type { Categoria, Prioridade } from "./types";

export function saudacao(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

export function dataLonga(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function diaSemana(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { weekday: "long" });
}

export function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function faixaHorario(inicio: string, fim?: string): string {
  return fim ? `${hora(inicio)} – ${hora(fim)}` : hora(inicio);
}

export function tempoRelativo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "ontem" : `há ${d} dias`;
}

export function mesAtualNome(): string {
  return MESES[new Date().getMonth()];
}

export const CATEGORIA_META: Record<Categoria, { label: string; className: string }> = {
  feriado: { label: "Feriado", className: "bg-info/15 text-info border-info/30" },
  rh: { label: "RH", className: "bg-primary/15 text-primary border-primary/30" },
  ferias: { label: "Férias", className: "bg-success/15 text-success border-success/30" },
  interno: { label: "Interno", className: "bg-secondary text-secondary-foreground border-border" },
  ti: { label: "TI", className: "bg-accent text-accent-foreground border-border" },
  evento: { label: "Evento", className: "bg-warning/15 text-warning border-warning/30" },
};

export const PRIORIDADE_META: Record<Prioridade, { label: string; className: string; dot: string }> = {
  alta: { label: "Alta", className: "bg-destructive/15 text-destructive border-destructive/30", dot: "bg-destructive" },
  media: { label: "Média", className: "bg-warning/15 text-warning border-warning/30", dot: "bg-warning" },
  baixa: { label: "Baixa", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground" },
};
