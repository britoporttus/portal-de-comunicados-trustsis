// Dados iniciais (exemplo) do portal — usados no primeiro boot e no MODO DEMO.
import type { Store, PontoEvento, Feedback, TipoPonto } from "./types.js";

const now = new Date();
const iso = (d: Date) => d.toISOString();
const daysFromNow = (n: number, h = 9, m = 0) => {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  d.setHours(h, m, 0, 0);
  return iso(d);
};

// ---- Gamificação: pontos e feedbacks de exemplo (para o ranking já nascer preenchido) ----
const VALOR: Record<TipoPonto, number> = {
  visita_diaria: 5,
  ler_comunicado: 10,
  confirmar_leitura: 15,
  abrir_social: 8,
  curtir_social: 3,
  comentar_social: 6,
  confirmar_politica: 15,
  feedback_enviado: 5,
  feedback_recebido: 20,
};
// Dia D deste mês (limitado a 27 para não estourar em meses curtos).
const desteMes = (dia: number, h = 10) =>
  iso(new Date(now.getFullYear(), now.getMonth(), Math.min(Math.max(dia, 1), 27), h, 0, 0));

/** Gera N lançamentos de um tipo para um usuário, em dias distintos deste mês.
 *  Usa dedup "seed|…" para NÃO colidir com o dedup real das ações do usuário. */
function lancamentos(upn: string, tipo: TipoPonto, dias: number[]): PontoEvento[] {
  return dias.map((dia, i) => ({
    id: `pt_seed_${upn.split("@")[0]}_${tipo}_${i}`,
    upn,
    tipo,
    pontos: VALOR[tipo],
    dedup: `seed|${upn}|${tipo}|${dia}|${i}`,
    criadoEm: desteMes(dia, 9 + (i % 8)),
  }));
}

function seedPontos(): PontoEvento[] {
  const larissa = "larissa.menezes@trustsis.com.br";
  const ana = "ana.costa@trustsis.com.br";
  const pedro = "pedro.dias@trustsis.com.br";
  const joao = "joao.ribeiro@trustsis.com.br";
  const bruna = "bruna.carvalho@trustsis.com.br";
  const marcos = "marcos.antonio@trustsis.com.br";
  return [
    ...lancamentos(larissa, "visita_diaria", [1, 2, 3, 4, 5, 8, 9, 10]),
    ...lancamentos(larissa, "ler_comunicado", [2, 4, 8, 10]),
    ...lancamentos(larissa, "abrir_social", [3, 5, 9]),
    ...lancamentos(larissa, "confirmar_leitura", [2, 8]),
    ...lancamentos(ana, "visita_diaria", [1, 2, 3, 5, 8, 10]),
    ...lancamentos(ana, "ler_comunicado", [3, 5, 9]),
    ...lancamentos(ana, "abrir_social", [4, 10]),
    ...lancamentos(ana, "confirmar_leitura", [3]),
    ...lancamentos(pedro, "visita_diaria", [2, 4, 5, 9]),
    ...lancamentos(pedro, "ler_comunicado", [4, 9]),
    ...lancamentos(pedro, "abrir_social", [5]),
    ...lancamentos(joao, "visita_diaria", [1, 3, 8]),
    ...lancamentos(joao, "ler_comunicado", [3]),
    ...lancamentos(joao, "confirmar_leitura", [8]),
    ...lancamentos(bruna, "visita_diaria", [2, 5]),
    ...lancamentos(bruna, "abrir_social", [5]),
    ...lancamentos(marcos, "visita_diaria", [3]),
  ];
}

function seedFeedbacks(): Feedback[] {
  return [
    {
      id: "fb_seed_1",
      de: "ana.costa@trustsis.com.br",
      deNome: "Ana Beatriz Costa",
      para: "larissa.menezes@trustsis.com.br",
      paraNome: "Larissa Menezes",
      mensagem:
        "Seu trabalho no redesenho do portal ficou impecável. Atenção aos detalhes e ótima colaboração com o time. Parabéns!",
      criadoEm: desteMes(9, 16),
    },
    {
      id: "fb_seed_2",
      de: "marcos.antonio@trustsis.com.br",
      deNome: "Marcos Antônio",
      para: "ana.costa@trustsis.com.br",
      paraNome: "Ana Beatriz Costa",
      mensagem: "Excelente condução da entrega do trimestre. Liderança de referência para a área.",
      criadoEm: desteMes(6, 11),
    },
    {
      id: "fb_seed_3",
      de: "pedro.dias@trustsis.com.br",
      deNome: "Pedro Henrique Dias",
      para: "joao.ribeiro@trustsis.com.br",
      paraNome: "João Ribeiro",
      mensagem: "Valeu pela ajuda na revisão de código de ontem, salvou o deploy! 🙌",
      criadoEm: desteMes(4, 14),
    },
  ];
}

/** Pontos derivados dos feedbacks (destinatário + remetente) — mantém ranking coerente. */
function pontosDeFeedbacks(fbs: Feedback[]): PontoEvento[] {
  return fbs.flatMap((f) => [
    {
      id: `pt_seed_fbr_${f.id}`, upn: f.para, tipo: "feedback_recebido" as TipoPonto,
      pontos: VALOR.feedback_recebido, refId: f.id,
      dedup: `seed|${f.para}|feedback_recebido|${f.id}`, criadoEm: f.criadoEm,
    },
    {
      id: `pt_seed_fbe_${f.id}`, upn: f.de, tipo: "feedback_enviado" as TipoPonto,
      pontos: VALOR.feedback_enviado, refId: f.id,
      dedup: `seed|${f.de}|feedback_enviado|${f.id}`, criadoEm: f.criadoEm,
    },
  ]);
}

export function seedData(): Store {
  const feedbacks = seedFeedbacks();
  return {
    pontos: [...seedPontos(), ...pontosDeFeedbacks(feedbacks)],
    feedbacks,
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
        leituras: [
          "joao.ribeiro@trustsis.com.br",
          "larissa.menezes@trustsis.com.br",
          "bruna.carvalho@trustsis.com.br",
        ],
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
      { id: "lnk_1", label: "Teams", url: "https://teams.microsoft.com", icon: "users" },
      { id: "lnk_2", label: "Outlook", url: "https://outlook.office.com", icon: "mail" },
      { id: "lnk_3", label: "SharePoint", url: "https://www.office.com/launch/sharepoint", icon: "folder" },
      { id: "lnk_4", label: "OneDrive", url: "https://www.office.com/launch/onedrive", icon: "cloud" },
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
