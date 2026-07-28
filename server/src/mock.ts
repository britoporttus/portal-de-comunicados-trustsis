// Dados DEMO para pessoas/agenda/organograma/ausências — usados quando o Graph não
// está configurado. Mantém o portal totalmente navegável sem Entra.
import type { Pessoa, AgendaItem, Ausencia, OrgNode } from "./types.js";

export const mockPeople: Pessoa[] = [
  { id: "u_joao", nome: "João Ribeiro", cargo: "Analista de Sistemas", area: "Tecnologia", email: "joao.ribeiro@trustsis.com.br", telefone: "+55 11 99999-0001" },
  { id: "u_ana", nome: "Ana Beatriz Costa", cargo: "Gerente de Tecnologia", area: "Tecnologia", email: "ana.costa@trustsis.com.br" },
  { id: "u_pedro", nome: "Pedro Henrique Dias", cargo: "Desenvolvedor Pleno", area: "Tecnologia", email: "pedro.dias@trustsis.com.br" },
  { id: "u_larissa", nome: "Larissa Menezes", cargo: "Designer de Produto", area: "Tecnologia", email: "larissa.menezes@trustsis.com.br" },
  { id: "u_marcos", nome: "Marcos Antônio", cargo: "Diretor de Operações", area: "Diretoria", email: "marcos.antonio@trustsis.com.br" },
  { id: "u_bruna", nome: "Bruna Carvalho", cargo: "Analista de RH", area: "Recursos Humanos", email: "bruna.carvalho@trustsis.com.br" },
];

const iso = (offsetDays: number, h: number, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export function mockAgenda(): AgendaItem[] {
  return [
    { id: "ag1", titulo: "Daily do time de Tecnologia", inicio: iso(0, 9, 30), fim: iso(0, 9, 45), online: true, organizador: "Ana Beatriz Costa" },
    { id: "ag2", titulo: "Reunião de alinhamento — Projeto Aurora", inicio: iso(0, 11, 0), fim: iso(0, 12, 0), local: "Sala Turing", organizador: "Marcos Antônio" },
    { id: "ag3", titulo: "1:1 com gestora", inicio: iso(0, 15, 0), fim: iso(0, 15, 30), online: true, organizador: "Ana Beatriz Costa" },
    { id: "ag4", titulo: "Revisão de código — Portal Interno", inicio: iso(1, 10, 0), fim: iso(1, 11, 0), online: true },
    { id: "ag5", titulo: "Planejamento de sprint", inicio: iso(2, 14, 0), fim: iso(2, 15, 30), local: "Sala Ada Lovelace" },
  ];
}

export function mockOrg(): OrgNode {
  return {
    ...mockPeople[0],
    gestor: mockPeople[1],
    liderados: [],
  };
}

export function mockVacations(): Ausencia[] {
  return [
    { pessoa: mockPeople[2], mensagem: "Em férias, retorno em breve. Para urgências, falar com a equipe.", ate: iso(6, 18) },
    { pessoa: mockPeople[3], mensagem: "Ausente por motivo de folga. Retorno amanhã.", ate: iso(1, 18) },
  ];
}
