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
  /** Perfis de acesso do portal que enxergam o item (vazio/ausente = todos). Ver Perfil. */
  perfis?: string[];
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
  /** Perfis de acesso que enxergam o evento (vazio/ausente = todos). */
  perfis?: string[];
  /** Fase 3 — quem já mandou este evento para a própria agenda do Outlook (chaves
   *  canônicas). Evita duplicar o compromisso e permite a UI dizer "já está na sua agenda". */
  naAgenda?: string[];
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
  /** Perfis de acesso que enxergam o atalho (vazio/ausente = todos). */
  perfis?: string[];
  // ---- usados pelos ATALHOS DA EMPRESA (store.atalhos), geridos pelo admin ----
  /** Agrupador na página de links (ex.: "Dashboards", "Sistemas", "Comercial"). */
  categoria?: string;
  /** Texto curto de apoio exibido sob o nome do atalho. */
  descricao?: string;
  /** Ordem manual dentro da categoria (menor primeiro). */
  ordem?: number;
}

/** Biblioteca de documentos: uma pasta compartilhada do SharePoint/OneDrive listada
 *  (read-only) dentro do portal — mesmo padrão já usado nas Políticas internas, agora
 *  com N pastas cadastradas pelo admin na UI (nada de env por biblioteca).
 *  Cada SUBPASTA da pasta vira uma categoria; arquivos na raiz caem em "Geral". */
export interface Biblioteca {
  id: string;
  nome: string;
  descricao?: string;
  /** URL de compartilhamento da pasta (o que o SharePoint/OneDrive gera em "Compartilhar"). */
  shareUrl: string;
  /** Ícone lucide/chave conhecida (ver front src/components/portal/shared.tsx). */
  icone?: string;
  /** Perfis de acesso que enxergam a biblioteca (vazio/ausente = todos). */
  perfis?: string[];
  criadoEm?: string;
  atualizadoEm?: string;
}

/** Fase 5 — comentário INTERNO do portal numa publicação de rede social. Não vai para a
 *  rede: é a conversa dos colaboradores sobre o post (engajamento medido no portal). */
export interface ComentarioSocial {
  id: string;
  de: string; // chave canônica de quem comentou
  deNome: string;
  texto: string;
  criadoEm: string; // ISO
  /** Resolvida na leitura (não persistida) — mesma ideia dos feedbacks. */
  deFoto?: string;
}

export interface PublicacaoSocial {
  id: string;
  rede: "linkedin" | "instagram" | "facebook" | "youtube";
  autor: string;
  texto: string;
  imagemUrl?: string;
  url: string;
  publicadoEm: string;
  /** Perfis de acesso que enxergam a publicação (vazio/ausente = todos). */
  perfis?: string[];
  // ---- Fase 5: engajamento interno (curtidas/comentários vivem NO PORTAL) ----
  /** Chaves canônicas de quem curtiu (a contagem é o length). */
  curtidas?: string[];
  comentarios?: ComentarioSocial[];
  /** Resolvido na leitura para o usuário da requisição (não persistido). */
  euCurti?: boolean;
}

// ---- RBAC do portal: Grupo do Entra → Perfil de acesso → Página/Artefato ----
// A camada do MEIO (Perfil) é o que o admin manipula por CRUD na UI, sem tocar em código
// nem em env. O grupo do Entra continua sendo a fonte da verdade de QUEM é a pessoa.

/** Ações possíveis sobre um recurso do portal. */
export type Acao = "ver" | "criar" | "editar" | "excluir";

/** Perfil de acesso do portal (entidade gerida por CRUD na UI de admin). */
export interface Perfil {
  id: string;
  nome: string;
  descricao?: string;
  /** ids dos grupos do Entra que CONCEDEM este perfil (1..N). */
  gruposEntra: string[];
  /** nomes dos grupos capturados no cadastro (exibição sem bater no Graph). */
  gruposNomes?: string[];
  /** rotas do menu liberadas (ex.: "/", "/comunicados"). */
  paginas: string[];
  /** por recurso (chave do catálogo), quais ações são permitidas. */
  permissoes: Record<string, Acao[]>;
  /** super-perfil: enxerga tudo, inclusive a administração de perfis. */
  admin?: boolean;
  /** perfil-fallback de quem não casa com nenhum grupo. */
  padrao?: boolean;
  /** perfis de sistema (Administrador/Colaborador) não podem ser excluídos. */
  sistema?: boolean;
  /** migrações já aplicadas a este perfil (ex.: "fase2") — evita reaplicar defaults de
   *  recursos novos por cima de uma escolha deliberada do admin. */
  migracoes?: string[];
  criadoEm?: string;
  atualizadoEm?: string;
}

/** Grupo do Entra ID exibido para o admin escolher (vem do Graph, não é persistido). */
export interface GrupoEntra {
  id: string;
  nome: string;
  descricao?: string;
  email?: string;
}

/** Acesso EFETIVO do usuário atual (união dos perfis que os grupos dele concedem). */
export interface Acesso {
  isAdmin: boolean;
  perfis: { id: string; nome: string }[];
  paginas: string[];
  permissoes: Record<string, Acao[]>;
  /** ids dos grupos do Entra do usuário (vazio em modo demo) — ajuda no diagnóstico. */
  grupos?: string[];
}

// ---- Gamificação (ranking + feedback) ----
/** Ações que geram pontos no portal. */
export type TipoPonto =
  | "visita_diaria" // acessou o portal (1x/dia)
  | "ler_comunicado" // abriu o detalhe de um comunicado (1x por comunicado)
  | "confirmar_leitura" // confirmou leitura de um comunicado obrigatório (1x por comunicado)
  | "abrir_social" // acessou uma publicação de rede social (1x/dia por post)
  | "curtir_social" // curtiu uma publicação dentro do portal (1x por post)
  | "comentar_social" // comentou uma publicação dentro do portal (1x/dia por post)
  | "confirmar_politica" // confirmou a leitura de uma política obrigatória (1x por documento)
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

// ---- Tickets / chamados (integração futura com a plataforma trustsis-itsm) ----
// O portal é o BALCÃO de abertura + acompanhamento: cada usuário abre e vê os SEUS chamados.
// A gestão detalhada (workflow, SLA, atribuição de técnico) roda no trustsis-itsm; os status
// e prioridades abaixo espelham o enum do ITSM (.NET) para o dia da sincronização ser trivial.
//   ITSM TicketStatus: New(0) InProgress(1) OnHold(2) Resolved(8) Closed(10) Cancelled(11)
export type TicketStatus =
  | "aberto"        // New
  | "em_andamento"  // InProgress
  | "aguardando"    // OnHold
  | "resolvido"     // Resolved
  | "fechado"       // Closed
  | "cancelado";    // Cancelled
/** ITSM Priority: Low(0) Medium(1) High(2) Critical(3). */
export type TicketPrioridade = "baixa" | "media" | "alta" | "critica";
/** ITSM TicketType (subconjunto exposto no portal): Incident(0), ServiceRequest(1). */
export type TicketTipo = "incidente" | "requisicao";

export interface Ticket {
  id: string;
  numero: number;            // sequencial legível (ex.: #1042)
  titulo: string;            // "nome" do chamado
  descricao: string;
  tipo: TicketTipo;
  prioridade: TicketPrioridade;
  status: TicketStatus;
  solicitante: string;       // upn/e-mail de quem abriu (separa os tickets por usuário)
  solicitanteNome: string;
  responsavel?: string;      // nome do responsável (assignee) — vazio = aguardando triagem
  criadoEm: string;          // ISO — "data de início"
  atualizadoEm?: string;     // ISO
  // Referência no trustsis-itsm (ex.: "INC-0042") quando o chamado for sincronizado com a
  // plataforma de gestão. Enquanto a integração não está ativa, permanece vazio.
  externoRef?: string;
}

// ---- Feedback do portal (bug / melhoria / outro) sobre a PRÓPRIA aplicação ----
// Distinto do Feedback entre colegas (elogios): aqui o colaborador reporta um problema
// da ferramenta ou sugere uma melhoria. Só o autor vê os seus; o admin vê e gerencia todos.
export type ReporteTipo = "bug" | "melhoria" | "outro";
export type ReporteStatus = "aberto" | "em_analise" | "resolvido" | "arquivado";

export interface Reporte {
  id: string;
  tipo: ReporteTipo;
  titulo: string;
  mensagem: string;
  pagina?: string; // rota/tela onde ocorreu (opcional)
  de: string; // upn/e-mail de quem reportou
  deNome: string;
  status: ReporteStatus;
  criadoEm: string; // ISO
  atualizadoEm?: string; // ISO
}

// ---- Políticas de utilização interna ----
// NÃO são cadastradas no portal: são os DOCUMENTOS reais compartilhados com todos os
// colaboradores numa pasta do SharePoint/OneDrive. O portal só LISTA (read-only) o conteúdo
// dessa pasta via Microsoft Graph e abre cada arquivo no SharePoint. Cada subpasta vira uma
// categoria; arquivos na raiz caem em "Geral".
export interface PoliticaDoc {
  id: string;
  nome: string; // nome do arquivo
  categoria?: string; // subpasta (ex.: "RH", "Segurança") ou "Geral"
  tipo?: string; // rótulo amigável do formato (PDF, Word, Excel…)
  tamanho?: number; // bytes
  atualizadoEm?: string; // ISO — última modificação no SharePoint
  webUrl: string; // link para abrir/baixar o documento no SharePoint/OneDrive
  // ---- Fase 4: leitura obrigatória + confirmação (campos resolvidos na LEITURA) ----
  /** O admin exige leitura confirmada deste documento? (store: politicasConfig) */
  obrigatoria?: boolean;
  /** Quando o USUÁRIO da requisição confirmou a leitura (ISO) — ausente = pendente. */
  confirmadoEm?: string;
  /** Quantas pessoas já confirmaram (informativo; só vai para quem gerencia políticas). */
  confirmacoes?: number;
}

/** Configuração por documento de política (o documento em si mora no SharePoint; aqui só
 *  guardamos o que é do PORTAL — se a leitura é obrigatória e quem definiu isso). */
export interface PoliticaConfig {
  obrigatoria?: boolean;
  definidoEm?: string;
  definidoPor?: string;
}

// ---- Auditoria (Fase 6): trilha de "quem mudou o quê e quando" na administração ----
export interface Auditoria {
  id: string;
  em: string; // ISO
  quem: string; // upn/chave de quem fez
  quemNome?: string;
  /** Ação em formato `recurso.verbo` (ex.: "perfis.editar", "marca.salvar"). */
  acao: string;
  /** Alvo legível da ação (nome do perfil, da biblioteca, do documento…). */
  alvo?: string;
  detalhe?: string;
}

export interface Store {
  comunicados: Comunicado[];
  eventos: Evento[];
  aniversariantes: Aniversariante[];
  links: LinkUtil[]; // atalhos padrão (usados quando o usuário ainda não personalizou)
  social: PublicacaoSocial[];
  // Links personalizados por usuário (chave = e-mail/UPN). Cada um gerencia os seus.
  linksByUser?: Record<string, LinkUtil[]>;
  // ATALHOS DA EMPRESA (Fase 2): links institucionais/dashboards externos publicados pelo
  // admin e segregados por perfil. Diferente de `links`/`linksByUser`, que são PESSOAIS.
  atalhos?: LinkUtil[];
  // Bibliotecas de documentos (Fase 2): pastas do SharePoint/OneDrive listadas no portal.
  bibliotecas?: Biblioteca[];
  // Gamificação: ledger de pontos e feedbacks entre colegas.
  pontos?: PontoEvento[];
  feedbacks?: Feedback[];
  // Tickets abertos pelos colaboradores (opcional → produção não reseta ao subir o campo).
  tickets?: Ticket[];
  // Feedback do portal (bugs/melhorias). Políticas NÃO ficam no store: vêm do SharePoint.
  reportes?: Reporte[];
  // Fase 4 — o que é do PORTAL sobre cada política do SharePoint: se a leitura é obrigatória
  // (chave = id do documento no drive) e quem confirmou a leitura de quê.
  politicasConfig?: Record<string, PoliticaConfig>;
  /** politicasLidas[chaveCanonicaDoUsuario][docId] = ISO da confirmação. */
  politicasLidas?: Record<string, Record<string, string>>;
  // Fase 6 — trilha de auditoria das ações de administração (mais recentes primeiro).
  auditoria?: Auditoria[];
  // RBAC: perfis de acesso do portal (opcional → store antigo de produção não reseta;
  // na primeira leitura os perfis de sistema são criados por garantirPerfis()).
  perfis?: Perfil[];
  // Configuração de integração (SSO/Entra, Graph, políticas, ITSM) editada em Administração.
  // Opcional: sem ela o portal cai no .env (bootstrap) — store antigo não reseta.
  integracao?: Integracao;
  // Identidade visual carregada pelo admin (logo da navbar). Opcional → sem ela o portal
  // usa o logo padrão embutido no build.
  marca?: Marca;
}

/** MARCA do portal (Administração › Marca): logos carregados pelo admin e exibidos na navbar.
 *  Guardados como DATA URL (PNG/SVG) no store: o portal não serve arquivos enviados por
 *  upload, e um logo é pequeno o suficiente para caber no JSON (o front reduz antes de
 *  enviar). `logoColapsado` vazio = reusa o expandido; ambos vazios = logo padrão do build. */
export interface Marca {
  /** Logo do menu ABERTO (horizontal, com o nome da empresa) — TEMA CLARO. */
  logoExpandido?: string;
  /** Logo do menu RECOLHIDO (quadrado / só o símbolo) — TEMA CLARO. */
  logoColapsado?: string;
  /** Versão do logo ABERTO para o TEMA ESCURO. Vazio = reusa o do tema claro. */
  logoExpandidoEscuro?: string;
  /** Versão do logo RECOLHIDO para o TEMA ESCURO. Vazio = reusa o do tema claro. */
  logoColapsadoEscuro?: string;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/** Configuração de integração persistida (ver server/src/settings.ts).
 *  `clientSecret` NUNCA é devolvido pela API — só `temSecret: boolean`. */
export interface Integracao {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  adminGroupId: string;
  demoUserUpn: string;
  politicasShareUrl: string;
  itsmBaseUrl: string;
  itsmApiScope: string;
  itsmTenantSubdomain: string;
  /** Barreira de SSO no backend (valida o Bearer em /api). */
  authRequired: boolean;
  atualizadoEm?: string;
  atualizadoPor?: string;
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
