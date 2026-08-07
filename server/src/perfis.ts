// RBAC do portal — a camada de PERFIS DE ACESSO (Fase 0 do PLANO-INTRANET.md).
//
//   Grupo do Entra ID  →  Perfil de acesso (CRUD na UI)  →  Página / Artefato
//   (quem é a pessoa)     (o que o papel pode ver/fazer)    (o que é protegido)
//
// O grupo do Entra continua sendo a fonte da verdade da identidade: ninguém é "adicionado à
// mão" no portal. O Perfil é uma entidade DO PORTAL, criada/editada pelo admin na tela, que
// declara páginas visíveis + permissões por recurso×ação e aponta para 1..N grupos do Entra.
//
// Resolução em runtime: usuário → grupos (memberOf) → perfis → UNIÃO das permissões.
// Sem perfil correspondente, cai no perfil PADRÃO ("Colaborador").
//
// Trava de segurança: ENTRA_ADMIN_GROUP_ID (env) continua valendo como bootstrap de
// super-admin, para que um admin não se tranque fora ao editar o próprio perfil.
import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";
import { getStore, mutate, newId } from "./store.js";
import { getUserGroups, isGraphOn } from "./graph.js";
import type { Acao, Acesso, Perfil } from "./types.js";

// ---------- catálogo (o que a UI de admin oferece) ----------

export interface RecursoDef {
  chave: string;
  label: string;
  acoes: Acao[];
}

const TODAS: Acao[] = ["ver", "criar", "editar", "excluir"];
const SO_VER: Acao[] = ["ver"];

/** Recursos protegidos e as ações que fazem sentido em cada um. */
export const RECURSOS: RecursoDef[] = [
  { chave: "comunicados", label: "Comunicados", acoes: TODAS },
  { chave: "eventos", label: "Eventos", acoes: TODAS },
  { chave: "aniversariantes", label: "Aniversariantes", acoes: TODAS },
  { chave: "links", label: "Links úteis", acoes: TODAS },
  { chave: "social", label: "Redes sociais", acoes: TODAS },
  { chave: "politicas", label: "Políticas internas", acoes: SO_VER },
  { chave: "bibliotecas", label: "Bibliotecas de documentos", acoes: TODAS },
  { chave: "atalhos", label: "Atalhos da empresa", acoes: TODAS },
  { chave: "tickets", label: "Tickets", acoes: ["ver", "criar"] },
  { chave: "feedback", label: "Feedback entre colegas", acoes: ["ver", "criar", "excluir"] },
  { chave: "reportes", label: "Feedback do portal", acoes: ["ver", "criar", "editar", "excluir"] },
  { chave: "ranking", label: "Ranking / pontos", acoes: SO_VER },
  { chave: "organograma", label: "Organograma", acoes: SO_VER },
  { chave: "ferias", label: "Férias / ausências", acoes: SO_VER },
  { chave: "perfis", label: "Perfis de acesso (admin)", acoes: ["ver", "criar", "editar", "excluir"] },
];

export interface PaginaDef {
  rota: string;
  label: string;
  recurso?: string;
  /** página de administração — só entra em perfis admin. */
  admin?: boolean;
}

/** Páginas do menu (espelha src/components/portal/nav.ts + a área de admin). */
export const PAGINAS: PaginaDef[] = [
  { rota: "/", label: "Início" },
  { rota: "/comunicados", label: "Comunicados", recurso: "comunicados" },
  { rota: "/eventos", label: "Eventos", recurso: "eventos" },
  { rota: "/aniversariantes", label: "Aniversariantes", recurso: "aniversariantes" },
  { rota: "/ferias", label: "Quem está de férias", recurso: "ferias" },
  { rota: "/organograma", label: "Organograma", recurso: "organograma" },
  { rota: "/links", label: "Links úteis", recurso: "links" },
  { rota: "/politicas", label: "Políticas internas", recurso: "politicas" },
  { rota: "/documentos", label: "Documentos", recurso: "bibliotecas" },
  { rota: "/social", label: "Redes sociais", recurso: "social" },
  { rota: "/tickets", label: "Tickets", recurso: "tickets" },
  { rota: "/ranking", label: "Ranking", recurso: "ranking" },
  { rota: "/feedback", label: "Feedback", recurso: "feedback" },
  { rota: "/reportar", label: "Feedback do portal", recurso: "reportes" },
  // Toda a administração do portal vive numa página só (abas), visível apenas a admins.
  { rota: "/admin", label: "Administração", recurso: "perfis", admin: true },
];

export function catalogo() {
  return { paginas: PAGINAS, recursos: RECURSOS, acoes: TODAS };
}

/** Permissões totais (usado pelo perfil Administrador). */
function permissoesTotais(): Record<string, Acao[]> {
  const out: Record<string, Acao[]> = {};
  for (const r of RECURSOS) out[r.chave] = [...r.acoes];
  return out;
}

// ---------- perfis de sistema (bootstrap) ----------

/** Perfis criados na primeira execução: Administrador (super) e Colaborador (padrão). */
function perfisIniciais(): Perfil[] {
  const agora = new Date().toISOString();
  const admin: Perfil = {
    id: "perfil_admin",
    nome: "Administrador",
    descricao: "Acesso total ao portal, incluindo a gestão de perfis de acesso.",
    // Já nasce apontando para o grupo de admin do env (bootstrap), quando existir.
    gruposEntra: config.entra.adminGroupId ? [config.entra.adminGroupId] : [],
    gruposNomes: config.entra.adminGroupId ? ["Grupo de administradores (ENTRA_ADMIN_GROUP_ID)"] : [],
    paginas: PAGINAS.map((p) => p.rota),
    permissoes: permissoesTotais(),
    admin: true,
    sistema: true,
    criadoEm: agora,
  };
  const colaborador: Perfil = {
    id: "perfil_colaborador",
    nome: "Colaborador",
    descricao: "Perfil padrão de quem não pertence a nenhum grupo mapeado.",
    gruposEntra: [],
    paginas: PAGINAS.filter((p) => !p.admin).map((p) => p.rota),
    permissoes: {
      comunicados: ["ver"],
      eventos: ["ver"],
      aniversariantes: ["ver"],
      // Links úteis são PESSOAIS: cada colaborador gerencia os seus atalhos.
      links: ["ver", "criar", "editar", "excluir"],
      social: ["ver"],
      politicas: ["ver"],
      // Bibliotecas e atalhos da empresa são PUBLICADOS pelo admin: o colaborador só lê.
      bibliotecas: ["ver"],
      atalhos: ["ver"],
      tickets: ["ver", "criar"],
      feedback: ["ver", "criar"],
      reportes: ["ver", "criar"],
      ranking: ["ver"],
      organograma: ["ver"],
      ferias: ["ver"],
    },
    padrao: true,
    sistema: true,
    criadoEm: agora,
  };
  return [admin, colaborador];
}

// ---------- migrações de perfis já persistidos ----------
// Recursos/páginas NOVOS (ex.: bibliotecas e atalhos da Fase 2) não existem nos perfis que já
// estão gravados na produção — sem isto, o Colaborador ficaria sem enxergar a área nova.
// Só toca em perfis de SISTEMA e só UMA vez (marca em `migracoes`), para nunca desfazer uma
// escolha deliberada do admin.
const MIGRACOES: { id: string; aplicar: (p: Perfil) => void }[] = [
  {
    id: "fase2-bibliotecas-atalhos",
    aplicar: (p) => {
      if (!p.sistema) return;
      const totais: Acao[] = ["ver", "criar", "editar", "excluir"];
      p.permissoes ??= {};
      p.permissoes.bibliotecas ??= p.admin ? [...totais] : ["ver"];
      p.permissoes.atalhos ??= p.admin ? [...totais] : ["ver"];
      p.paginas ??= [];
      if (!p.paginas.includes("/documentos")) p.paginas.push("/documentos");
    },
  },
];

/** Aplica as migrações pendentes. Devolve true se algo mudou (para persistir). */
function migrarPerfis(perfis: Perfil[]): boolean {
  let mudou = false;
  for (const p of perfis) {
    for (const m of MIGRACOES) {
      if ((p.migracoes ?? []).includes(m.id)) continue;
      m.aplicar(p);
      p.migracoes = [...(p.migracoes ?? []), m.id];
      mudou = true;
    }
  }
  return mudou;
}

/** Lista os perfis do store, criando os de sistema na primeira leitura. */
export function listarPerfis(): Perfil[] {
  const s = getStore();
  if (!s.perfis || !s.perfis.length) {
    mutate((st) => {
      if (!st.perfis || !st.perfis.length) st.perfis = perfisIniciais();
    });
  }
  const perfis = getStore().perfis ?? [];
  if (perfis.some((p) => MIGRACOES.some((m) => !(p.migracoes ?? []).includes(m.id)))) {
    mutate((st) => migrarPerfis(st.perfis ?? []));
  }
  return getStore().perfis ?? [];
}

/** Normaliza o corpo recebido da UI em um Perfil válido (defensivo). */
export function normalizarPerfil(body: any, base?: Perfil): Perfil {
  const chaves = new Set(RECURSOS.map((r) => r.chave));
  const rotas = new Set(PAGINAS.map((p) => p.rota));
  const permissoes: Record<string, Acao[]> = {};
  const entrada = (body?.permissoes ?? base?.permissoes ?? {}) as Record<string, unknown>;
  for (const [chave, valor] of Object.entries(entrada)) {
    if (!chaves.has(chave) || !Array.isArray(valor)) continue;
    const permitidas = RECURSOS.find((r) => r.chave === chave)!.acoes;
    const acoes = (valor as Acao[]).filter((a) => permitidas.includes(a));
    if (acoes.length) permissoes[chave] = acoes;
  }
  const paginas = (Array.isArray(body?.paginas) ? body.paginas : base?.paginas ?? []).filter(
    (r: string) => rotas.has(r),
  );
  const gruposEntra = (Array.isArray(body?.gruposEntra) ? body.gruposEntra : base?.gruposEntra ?? [])
    .map((g: unknown) => String(g).trim())
    .filter(Boolean);
  const gruposNomes = Array.isArray(body?.gruposNomes)
    ? body.gruposNomes.map((g: unknown) => String(g))
    : base?.gruposNomes;

  return {
    id: base?.id ?? newId("prf"),
    nome: String(body?.nome ?? base?.nome ?? "").trim().slice(0, 80) || "Novo perfil",
    descricao: String(body?.descricao ?? base?.descricao ?? "").trim().slice(0, 300) || undefined,
    gruposEntra,
    gruposNomes,
    paginas,
    permissoes,
    // `admin`/`sistema` NÃO são editáveis pela API (evita escalar privilégio por payload).
    admin: base?.admin,
    padrao: body?.padrao === undefined ? base?.padrao : Boolean(body.padrao),
    sistema: base?.sistema,
    // Preserva o histórico de migrações (senão os defaults de recursos novos voltariam
    // a ser aplicados por cima do que o admin acabou de decidir nesta edição).
    migracoes: base?.migracoes,
    criadoEm: base?.criadoEm ?? new Date().toISOString(),
    atualizadoEm: base ? new Date().toISOString() : undefined,
  };
}

// ---------- resolução do acesso efetivo ----------

function uniao(perfis: Perfil[]): { paginas: string[]; permissoes: Record<string, Acao[]> } {
  const paginas = new Set<string>();
  const permissoes: Record<string, Set<Acao>> = {};
  for (const p of perfis) {
    for (const r of p.paginas ?? []) paginas.add(r);
    for (const [chave, acoes] of Object.entries(p.permissoes ?? {})) {
      if (!permissoes[chave]) permissoes[chave] = new Set();
      for (const a of acoes) permissoes[chave].add(a);
    }
  }
  return {
    paginas: [...paginas],
    permissoes: Object.fromEntries(Object.entries(permissoes).map(([k, v]) => [k, [...v]])),
  };
}

/** Acesso EFETIVO do usuário: grupos do Entra → perfis → união das permissões. */
export async function acessoDe(upn?: string): Promise<Acesso> {
  const perfis = listarPerfis();
  const { ids: grupos } = await getUserGroups(upn);

  // Bootstrap de super-admin: sem Graph (preview/demo) ou sem grupo de admin configurado, o
  // usuário é admin — é o comportamento que o portal já tinha (checkAdmin em graph.ts).
  const bootstrapAdmin = !isGraphOn || !config.entra.adminGroupId
    ? true
    : grupos.includes(config.entra.adminGroupId);

  let meus = perfis.filter((p) => (p.gruposEntra ?? []).some((g) => grupos.includes(g)));
  if (bootstrapAdmin) {
    const admins = perfis.filter((p) => p.admin);
    for (const a of admins) if (!meus.some((p) => p.id === a.id)) meus.push(a);
  }
  if (!meus.length) {
    const padrao = perfis.find((p) => p.padrao);
    if (padrao) meus = [padrao];
  }

  const isAdmin = bootstrapAdmin || meus.some((p) => p.admin);
  if (isAdmin) {
    return {
      isAdmin: true,
      perfis: meus.map((p) => ({ id: p.id, nome: p.nome })),
      paginas: PAGINAS.map((p) => p.rota),
      permissoes: permissoesTotais(),
      grupos,
    };
  }
  const { paginas, permissoes } = uniao(meus);
  return {
    isAdmin: false,
    perfis: meus.map((p) => ({ id: p.id, nome: p.nome })),
    // Páginas de admin nunca entram para quem não é admin (defesa em profundidade).
    paginas: paginas.filter((r) => !PAGINAS.find((p) => p.rota === r)?.admin),
    permissoes,
    grupos,
  };
}

/** Identidade da requisição (o middleware requireAuth sobrescreve ?upn= com o token real). */
export function upnDaReq(req: Request): string {
  return String(req.query.upn || (req.body as any)?.upn || "").toLowerCase();
}

/** Acesso do autor da requisição (cache curto vem do getUserGroups em graph.ts). */
export function acessoDaReq(req: Request): Promise<Acesso> {
  return acessoDe(upnDaReq(req) || undefined);
}

export function podeNoAcesso(acesso: Acesso, recurso: string, acao: Acao): boolean {
  if (acesso.isAdmin) return true;
  return (acesso.permissoes[recurso] ?? []).includes(acao);
}

/** Middleware: exige uma permissão recurso×ação. O backend é a AUTORIDADE (front é usabilidade). */
export function requerPerm(recurso: string, acao: Acao) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const acesso = await acessoDaReq(req);
      if (podeNoAcesso(acesso, recurso, acao)) return next();
      res.status(403).json({ error: `sem permissão para ${acao} em ${recurso}` });
    } catch (e) {
      // Falha ao resolver o acesso (Graph instável): nega por segurança.
      res.status(403).json({ error: "não foi possível validar as permissões", detail: (e as Error).message });
    }
  };
}

// ---------- segregação de artefatos ----------

/** Um artefato é visível se não declara perfis OU se intersecta os perfis do usuário.
 *  Admin (e quem pode EDITAR o recurso) enxerga tudo — precisa gerenciar o conteúdo. */
export function podeVer(
  item: { perfis?: string[] },
  acesso: Acesso,
  recurso?: string,
): boolean {
  if (!item.perfis || !item.perfis.length) return true;
  if (acesso.isAdmin) return true;
  if (recurso && podeNoAcesso(acesso, recurso, "editar")) return true;
  const meus = new Set(acesso.perfis.map((p) => p.id));
  return item.perfis.some((id) => meus.has(id));
}

/** Filtra uma lista de artefatos pelos perfis do usuário. */
export function filtrarPorPerfil<T extends { perfis?: string[] }>(
  lista: T[],
  acesso: Acesso,
  recurso?: string,
): T[] {
  if (acesso.isAdmin) return lista;
  return lista.filter((i) => podeVer(i, acesso, recurso));
}
