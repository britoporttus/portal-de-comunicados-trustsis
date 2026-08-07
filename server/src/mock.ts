// Dados DEMO para pessoas/agenda/organograma/ausências — usados quando o Graph não
// está configurado. Mantém o portal totalmente navegável sem Entra.
import type { Pessoa, AgendaItem, Ausencia, OrgNode, PoliticaDoc, GrupoEntra } from "./types.js";

export const mockPeople: Pessoa[] = [
  { id: "u_joao", nome: "João Ribeiro", cargo: "Analista de Sistemas", area: "Tecnologia", email: "joao.ribeiro@trustsis.com.br", telefone: "+55 11 99999-0001", managerId: "u_ana" },
  { id: "u_ana", nome: "Ana Beatriz Costa", cargo: "Gerente de Tecnologia", area: "Tecnologia", email: "ana.costa@trustsis.com.br", managerId: "u_marcos" },
  { id: "u_pedro", nome: "Pedro Henrique Dias", cargo: "Desenvolvedor Pleno", area: "Tecnologia", email: "pedro.dias@trustsis.com.br", managerId: "u_ana" },
  { id: "u_larissa", nome: "Larissa Menezes", cargo: "Designer de Produto", area: "Tecnologia", email: "larissa.menezes@trustsis.com.br", managerId: "u_ana" },
  { id: "u_marcos", nome: "Marcos Antônio", cargo: "Diretor de Operações", area: "Diretoria", email: "marcos.antonio@trustsis.com.br" },
  { id: "u_bruna", nome: "Bruna Carvalho", cargo: "Analista de RH", area: "Recursos Humanos", email: "bruna.carvalho@trustsis.com.br", managerId: "u_marcos" },
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
    liderados: [mockPeople[2], mockPeople[3]],
    diretorio: mockPeople,
  };
}

export function mockVacations(): Ausencia[] {
  return [
    { pessoa: mockPeople[2], mensagem: "Em férias, retorno em breve. Para urgências, falar com a equipe.", ate: iso(6, 18) },
    { pessoa: mockPeople[3], mensagem: "Ausente por motivo de folga. Retorno amanhã.", ate: iso(1, 18) },
  ];
}

// Grupos do Entra DEMO — alimentam o multi-select da tela de Perfis de acesso no preview,
// onde o Graph está desligado. Em produção vêm de listGroups() (Group.Read.All).
export function mockGrupos(): GrupoEntra[] {
  return [
    { id: "grp-admins", nome: "TI — Administradores do portal", descricao: "Gestão do portal" },
    { id: "grp-ti", nome: "Tecnologia", descricao: "Time de tecnologia" },
    { id: "grp-rh", nome: "Recursos Humanos", descricao: "Time de RH" },
    { id: "grp-comercial", nome: "Comercial", descricao: "Time comercial" },
    { id: "grp-marketing", nome: "Marketing", descricao: "Time de marketing" },
    { id: "grp-diretoria", nome: "Diretoria", descricao: "Diretoria executiva" },
    { id: "grp-todos", nome: "Todos os colaboradores", descricao: "Grupo geral da empresa" },
  ];
}

// Documentos de política DEMO — simulam os arquivos que viriam da pasta compartilhada do
// SharePoint. Usados no preview/sem Graph para a página ficar navegável. webUrl é fictício.
export function mockPoliticas(): PoliticaDoc[] {
  return [
    { id: "d1", nome: "Código de Conduta.pdf", categoria: "Geral", tipo: "PDF", tamanho: 482_000, atualizadoEm: iso(-20, 12), webUrl: "https://sharepoint.com" },
    { id: "d2", nome: "Política de Segurança da Informação.pdf", categoria: "Segurança", tipo: "PDF", tamanho: 731_000, atualizadoEm: iso(-45, 12), webUrl: "https://sharepoint.com" },
    { id: "d3", nome: "Uso Aceitável de E-mail e Internet.docx", categoria: "Segurança", tipo: "Word", tamanho: 96_000, atualizadoEm: iso(-12, 12), webUrl: "https://sharepoint.com" },
    { id: "d4", nome: "Manual do Colaborador.pdf", categoria: "RH", tipo: "PDF", tamanho: 1_240_000, atualizadoEm: iso(-60, 12), webUrl: "https://sharepoint.com" },
    { id: "d5", nome: "Política de Home Office.pdf", categoria: "RH", tipo: "PDF", tamanho: 210_000, atualizadoEm: iso(-8, 12), webUrl: "https://sharepoint.com" },
  ];
}
