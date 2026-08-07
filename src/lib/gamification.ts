// Metadados visuais das ações de pontuação (rótulo curto + ícone + valor de referência).
// O valor real é decidido pelo backend (pontos.ts); aqui é só para exibir a legenda.
import {
  CalendarCheck, Megaphone, ShieldCheck, Share2, MessageSquarePlus, Heart,
  ThumbsUp, MessageCircle, ScrollText,
  type LucideIcon,
} from "lucide-react";
import type { TipoPonto } from "./types";

export const TIPO_PONTO_META: Record<TipoPonto, { label: string; icon: LucideIcon; pontos: number }> = {
  visita_diaria: { label: "Visita diária", icon: CalendarCheck, pontos: 5 },
  ler_comunicado: { label: "Ler comunicado", icon: Megaphone, pontos: 10 },
  confirmar_leitura: { label: "Confirmar leitura obrigatória", icon: ShieldCheck, pontos: 15 },
  abrir_social: { label: "Acessar rede social", icon: Share2, pontos: 8 },
  curtir_social: { label: "Curtir publicação", icon: ThumbsUp, pontos: 3 },
  comentar_social: { label: "Comentar publicação", icon: MessageCircle, pontos: 6 },
  confirmar_politica: { label: "Confirmar leitura de política", icon: ScrollText, pontos: 15 },
  feedback_enviado: { label: "Enviar feedback", icon: MessageSquarePlus, pontos: 5 },
  feedback_recebido: { label: "Receber feedback", icon: Heart, pontos: 20 },
};

export const TIPO_PONTO_ORDEM: TipoPonto[] = [
  "visita_diaria", "ler_comunicado", "confirmar_leitura", "confirmar_politica",
  "abrir_social", "curtir_social", "comentar_social",
  "feedback_recebido", "feedback_enviado",
];

/** Últimos N meses (YYYY-MM), do mais recente para o mais antigo. */
export function ultimosMeses(qtd = 6): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < qtd; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Nome do mês (YYYY-MM) por extenso em pt-BR, ex.: "julho de 2026". */
export function nomeDoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const nomes = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${nomes[(m ?? 1) - 1]} de ${ano}`;
}
