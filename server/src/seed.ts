// Dados iniciais (exemplo) do portal — usados no primeiro boot e no MODO DEMO.
import type { Store } from "./types.js";

const now = new Date();
const iso = (d: Date) => d.toISOString();
const daysFromNow = (n: number, h = 9, m = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(h, m, 0, 0);
  return iso(d);
};

export function seedData(): Store {
  return {
    comunicados: [
      {
        id: "com_1",
        titulo: "Recesso de feriado prolongado",
        resumo: "Escritórios fechados na sexta-feira; retorno na segunda.",
        conteudo:
          "Comunicamos que, em função do feriado, os escritórios da TrustSis permanecerão fechados na próxima sexta-feira. As equipes de plantão seguem o cronograma habitual. Bom descanso a todos!",
        categoria: "feriado",
        prioridade: "alta",
        autor: "Recursos Humanos",
        publicadoEm: daysFromNow(-1, 8, 30),
        fixado: true,
      },
      {
        id: "com_2",
        titulo: "Abertura das inscrições para férias 2026",
        resumo: "Solicite seu período de férias pelo portal do RH até o fim do mês.",
        conteudo:
          "Já estão abertas as inscrições para o planejamento de férias de 2026. Acesse o portal do RH e registre sua preferência de período. As aprovações seguem por ordem de solicitação e alinhamento com a liderança.",
        categoria: "ferias",
        prioridade: "media",
        autor: "Recursos Humanos",
        publicadoEm: daysFromNow(-2, 10, 0),
      },
      {
        id: "com_3",
        titulo: "Nova política de segurança da informação",
        resumo: "Atualização obrigatória sobre uso de MFA e senhas corporativas.",
        conteudo:
          "Entra em vigor a nova política de segurança da informação. A autenticação multifator (MFA) passa a ser obrigatória em todos os sistemas. Leia o documento completo na área de Documentos e conclua o treinamento até o fim da semana.",
        categoria: "interno",
        prioridade: "alta",
        autor: "Segurança da Informação",
        publicadoEm: daysFromNow(-3, 14, 0),
        obrigatorio: true,
        publico: "todos",
        leituras: [],
      },
      {
        id: "com_4",
        titulo: "Benefício de vale-cultura disponível",
        resumo: "RH anuncia novo benefício para todos os colaboradores CLT.",
        conteudo:
          "A partir deste mês, todos os colaboradores CLT passam a contar com o vale-cultura. A adesão é opcional e pode ser feita pelo portal de benefícios. Dúvidas com o time de Pessoas.",
        categoria: "rh",
        prioridade: "baixa",
        autor: "Recursos Humanos",
        publicadoEm: daysFromNow(-5, 11, 0),
        publico: "clt",
      },
    ],
    eventos: [
      {
        id: "evt_1",
        titulo: "Happy Hour de fim de mês",
        descricao: "Encontro descontraído do time. Bebidas e petiscos por conta da casa.",
        tipo: "happy-hour",
        inicio: daysFromNow(2, 18, 30),
        fim: daysFromNow(2, 21, 0),
        local: "Rooftop — Sede SP",
      },
      {
        id: "evt_2",
        titulo: "Reunião geral (All Hands) Q3",
        descricao: "Resultados do trimestre e prioridades. Presença de toda a empresa.",
        tipo: "reuniao",
        inicio: daysFromNow(5, 10, 0),
        fim: daysFromNow(5, 11, 30),
        local: "Auditório + Teams",
      },
      {
        id: "evt_3",
        titulo: "Confraternização de aniversário da TrustSis",
        descricao: "Celebração dos nossos anos de casa. Traga a família!",
        tipo: "confraternizacao",
        inicio: daysFromNow(12, 12, 0),
        fim: daysFromNow(12, 17, 0),
        local: "Espaço Villa Garden",
      },
      {
        id: "evt_4",
        titulo: "Treinamento: LGPD na prática",
        descricao: "Workshop obrigatório sobre proteção de dados.",
        tipo: "treinamento",
        inicio: daysFromNow(8, 14, 0),
        fim: daysFromNow(8, 16, 0),
        local: "Sala Ada Lovelace",
      },
    ],
    aniversariantes: [
      { id: "ani_1", nome: "Mariana Rocha", area: "Comercial", dia: now.getDate(), mes: now.getMonth() + 1 },
      { id: "ani_2", nome: "Carlos Eduardo Lima", area: "Tecnologia", dia: Math.min(28, now.getDate() + 2), mes: now.getMonth() + 1 },
      { id: "ani_3", nome: "Beatriz Nunes", area: "Financeiro", dia: Math.min(28, now.getDate() + 5), mes: now.getMonth() + 1 },
      { id: "ani_4", nome: "Rafael Souza", area: "Consultoria", dia: Math.min(28, now.getDate() + 9), mes: now.getMonth() + 1 },
      { id: "ani_5", nome: "Juliana Alves", area: "RH", dia: Math.min(28, now.getDate() + 14), mes: now.getMonth() + 1 },
    ],
    links: [
      { id: "lnk_1", label: "Outlook", url: "https://outlook.office.com", icon: "mail" },
      { id: "lnk_2", label: "Teams", url: "https://teams.microsoft.com", icon: "users" },
      { id: "lnk_3", label: "OneDrive", url: "https://www.office.com/launch/onedrive", icon: "cloud" },
      { id: "lnk_4", label: "SharePoint", url: "https://www.office.com/launch/sharepoint", icon: "folder" },
      { id: "lnk_5", label: "App Interno", url: "https://app.trustsis.com.br", icon: "layout-grid" },
      { id: "lnk_6", label: "Service Desk", url: "https://suporte.trustsis.com.br", icon: "life-buoy" },
    ],
    social: [
      {
        id: "soc_1",
        rede: "linkedin",
        autor: "TrustSis Consultoria",
        texto:
          "Tivemos a honra de participar do maior evento de cibersegurança do país. Obrigado a todos que passaram pelo nosso estande! 🚀 #TrustSis #Segurança",
        url: "https://www.linkedin.com/company/trustsis",
        publicadoEm: daysFromNow(-1, 16, 0),
      },
      {
        id: "soc_2",
        rede: "instagram",
        autor: "@trustsis",
        texto: "Bastidores do nosso time de consultoria em ação. Pessoas no centro de tudo. 💙",
        url: "https://instagram.com/trustsis",
        publicadoEm: daysFromNow(-3, 12, 0),
      },
      {
        id: "soc_3",
        rede: "linkedin",
        autor: "TrustSis Consultoria",
        texto:
          "Vagas abertas! Estamos crescendo e procurando talentos em tecnologia e consultoria. Confira em nosso site.",
        url: "https://www.linkedin.com/company/trustsis",
        publicadoEm: daysFromNow(-6, 9, 0),
      },
    ],
  };
}
