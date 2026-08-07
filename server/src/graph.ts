// Integração com o Microsoft Graph via fluxo app-only (client credentials).
// Sempre degrada para dados DEMO quando o Graph não está configurado ou falha,
// para que o portal continue funcionando no preview.
import { ConfidentialClientApplication } from "@azure/msal-node";
import { config, graphEnabled } from "./config.js";
import { aoMudarIntegracao } from "./settings.js";
import type {
  Pessoa, AgendaItem, Ausencia, OrgNode, Aniversariante, PoliticaDoc, GrupoEntra,
  ArquivoPessoal, MeuDrive,
} from "./types.js";
import { mockPeople, mockAgenda, mockOrg, mockVacations, mockPoliticas, mockGrupos } from "./mock.js";

const GRAPH = "https://graph.microsoft.com/v1.0";

let cca: ConfidentialClientApplication | null = null;
function client(): ConfidentialClientApplication {
  if (!cca) {
    cca = new ConfidentialClientApplication({
      auth: {
        clientId: config.entra.clientId,
        authority: `https://login.microsoftonline.com/${config.entra.tenantId}`,
        clientSecret: config.entra.clientSecret,
      },
    });
  }
  return cca;
}

// Ao mudar a configuração na tela de Administração, o cliente/token/caches montados com as
// credenciais ANTIGAS ficam inválidos — descarta tudo para o próximo uso reconstruir.
aoMudarIntegracao(() => {
  cca = null;
  tokenCache = null;
  gruposCache.clear();
});

let tokenCache: { value: string; exp: number } | null = null;
async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.value;
  const res = await client().acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  if (!res?.accessToken) throw new Error("sem access token do Graph");
  tokenCache = { value: res.accessToken, exp: (res.expiresOn?.getTime() ?? Date.now() + 3_000_000) };
  return res.accessToken;
}

async function graphGetUrl<T = any>(fullUrl: string): Promise<T> {
  const token = await getToken();
  const r = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Graph ${r.status} em ${fullUrl}: ${body.slice(0, 300)}`);
  }
  return (await r.json()) as T;
}

async function graphGet<T = any>(path: string): Promise<T> {
  return graphGetUrl<T>(`${GRAPH}${path}`);
}

/** POST no Graph (usado para ESCREVER: criar evento no calendário, pedir preview de doc). */
async function graphPost<T = any>(path: string, body: unknown): Promise<T> {
  const token = await getToken();
  const r = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
  });
  if (!r.ok) {
    const texto = await r.text().catch(() => "");
    throw new Error(`Graph ${r.status} em ${path}: ${texto.slice(0, 300)}`);
  }
  // 202/204 sem corpo (algumas ações) → devolve objeto vazio.
  const txt = await r.text();
  return (txt ? JSON.parse(txt) : {}) as T;
}

/** Lista TODOS os usuários do diretório (paginando @odata.nextLink), já filtrando
 *  contas sem nome/e-mail (salas, serviços). `extraSelect` adiciona campos ao $select. */
async function listAllUsers(extraSelect = "", expand = ""): Promise<any[]> {
  const sel = extraSelect ? `${SELECT},${extraSelect}` : SELECT;
  const exp = expand ? `&$expand=${expand}` : "";
  const out: any[] = [];
  let next: string | null = `${GRAPH}/users?$select=${sel}${exp}&$top=100`;
  let guard = 0;
  while (next && guard < 25) {
    const res: { value: any[]; "@odata.nextLink"?: string } = await graphGetUrl(next);
    out.push(...res.value);
    next = res["@odata.nextLink"] ?? null;
    guard++;
  }
  return out.filter((u) => u.displayName && (u.mail || u.userPrincipalName));
}

/** Preenche fotoUrl de várias pessoas em paralelo (best-effort). */
async function attachPhotos(pessoas: Pessoa[]): Promise<void> {
  await Promise.all(
    pessoas.map(async (p) => {
      p.fotoUrl = await fetchPhotoDataUrl(p.id);
    }),
  );
}

/** Deriva o tipo de contrato (CLT/PJ) a partir do campo livre employeeType do Entra. */
function tipoContratoDe(employeeType?: string): "clt" | "pj" | undefined {
  const t = (employeeType ?? "").toLowerCase();
  if (!t) return undefined;
  if (/\bpj\b|contractor|prestador|terceir|autonom/.test(t)) return "pj";
  if (/\bclt\b|employee|funcion|efetiv|colaborador/.test(t)) return "clt";
  return undefined;
}

// Exceção explícita: e-mails que devem SEMPRE aparecer no diretório, mesmo sem gestor
// E sem cargo/área preenchidos no Entra. Caso do joao.brito@trustsis.com — sócio que não
// tem manager nem cargo/área no Graph, então caía fora do filtro do CEO (e da regra de
// "topo com cargo ou área"), aparecendo como e-mail cru e sem foto nas confirmações/ranking/mural.
const SEMPRE_MANTER = new Set<string>(["joao.brito@trustsis.com"]);

function emailDe(p: Pessoa): string {
  return (p.email ?? "").toLowerCase();
}

/** Mantém o CEO (Claudio) e quem reporta a ele — direta ou indiretamente — MAIS somente os
 *  e-mails da lista SEMPRE_MANTER (exceção manual e EXPLÍCITA p/ quem precisa aparecer mesmo
 *  fora da cadeia do CEO, ex.: joao.brito@trustsis.com). Todo o resto que não está na cadeia
 *  do CEO fica de fora (inclui salas, contas de serviço e demais pessoas de topo que o usuário
 *  não quer no diretório). Seguro contra ciclos (usa conjunto de visitados). */
function limitarAoCeo(pessoas: Pessoa[]): Pessoa[] {
  const byId = new Map(pessoas.map((p) => [p.id, p]));
  const ceo =
    pessoas.find((p) => /\bceo\b/i.test(p.area ?? "")) ??
    pessoas.find((p) => /\bceo\b/i.test(p.cargo ?? "")) ??
    pessoas.find((p) => /cl[aá]udio/i.test(p.nome));
  if (!ceo) {
    console.warn("[graph] CEO (Claudio) não encontrado — mantendo diretório completo");
    return pessoas;
  }
  const filhosDe = new Map<string, Pessoa[]>();
  for (const p of pessoas) {
    const mgr = p.managerId && byId.has(p.managerId) && p.managerId !== p.id ? p.managerId : null;
    if (!mgr) continue;
    if (!filhosDe.has(mgr)) filhosDe.set(mgr, []);
    filhosDe.get(mgr)!.push(p);
  }
  const keep = new Set<string>([ceo.id]);
  const fila = [ceo.id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const f of filhosDe.get(atual) ?? []) {
      if (!keep.has(f.id)) {
        keep.add(f.id);
        fila.push(f.id);
      }
    }
  }
  // Além da cadeia do CEO, mantém APENAS os e-mails da lista SEMPRE_MANTER (exceção manual).
  // Nada mais é reintroduzido — pessoas de topo fora da cadeia do CEO ficam de fora.
  for (const p of pessoas) {
    if (keep.has(p.id)) continue;
    if (SEMPRE_MANTER.has(emailDe(p))) keep.add(p.id);
  }
  return pessoas.filter((p) => keep.has(p.id));
}

function mapPessoa(u: any): Pessoa {
  return {
    id: u.id,
    nome: u.displayName ?? "—",
    cargo: u.jobTitle ?? undefined,
    area: u.department ?? undefined,
    email: u.mail ?? u.userPrincipalName ?? undefined,
    telefone: u.mobilePhone ?? (u.businessPhones?.[0] as string) ?? undefined,
    tipoContrato: tipoContratoDe(u.employeeType),
    managerId: u.manager?.id ?? undefined,
  };
}

const SELECT =
  "id,displayName,jobTitle,department,mail,userPrincipalName,mobilePhone,businessPhones,employeeType,accountEnabled";

async function fetchPhotoDataUrl(idOrUpn: string): Promise<string | undefined> {
  try {
    const token = await getToken();
    const r = await fetch(`${GRAPH}/users/${encodeURIComponent(idOrUpn)}/photos/96x96/$value`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return undefined;
    const buf = Buffer.from(await r.arrayBuffer());
    const ct = r.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return undefined;
  }
}

// Re-export do LIVE BINDING de config.ts: quem importa `isGraphOn` daqui vê o valor atual
// (o admin pode ligar/desligar o Graph pela tela de Administração, sem restart).
export { graphEnabled as isGraphOn };

// Domínios IRMÃOS: um login de GUEST @porttus.com corresponde ao MEMBER equivalente
// @trustsis.com (MESMA pessoa — porttus é a holding; o tenant trustsis é onde ficam
// mailbox/agenda/organograma). Restrito a domínios EXPLÍCITOS de confiança para não
// mapear guests aleatórios por coincidência de local-part (evita vazamento de dados).
const DOMAIN_ALIASES: Record<string, string> = { "porttus.com": "trustsis.com" };

// Cache de resolução (identidade do token -> chave de diretório). Evita reconsultar o
// Graph a cada request; a 1ª chamada por usuário/processo faz o lookup, as demais servem do cache.
const dirKeyCache = new Map<string, string>();

/** Confirma que um UPN/e-mail resolve em /users e devolve a própria chave (ou null). */
async function userResolves(key: string): Promise<string | null> {
  try {
    const u = await graphGet<{ id?: string }>(`/users/${encodeURIComponent(key)}?$select=id`);
    return u?.id ? key : null;
  } catch {
    return null;
  }
}

/** Resolve a MELHOR chave de diretório para o usuário logado:
 *  1) se o login for de um domínio-alias (guest @porttus.com), tenta o member equivalente
 *     no domínio-alvo (@trustsis.com) — é onde estão os dados reais;
 *  2) senão (ou se o member não existir), usa o `oid` (imutável, sempre resolvível).
 *  Sem Graph (preview/demo) a barreira nem chama isto. */
export async function resolveDirectoryKey(id: {
  oid?: string;
  upn?: string;
  email?: string;
}): Promise<string> {
  const cacheKey = id.oid || id.upn || id.email || "";
  const cached = dirKeyCache.get(cacheKey);
  if (cached) return cached;

  let resolved = id.oid || id.upn || id.email || "";
  if (graphEnabled) {
    for (const s of [id.upn, id.email]) {
      if (!s || !s.includes("@")) continue;
      const [local, domain] = s.toLowerCase().split("@");
      const alvo = DOMAIN_ALIASES[domain];
      if (!alvo || !local) continue;
      const hit = await userResolves(`${local}@${alvo}`);
      if (hit) {
        resolved = hit;
        break;
      }
    }
  }
  if (cacheKey) dirKeyCache.set(cacheKey, resolved);
  return resolved;
}

/** Perfil do colaborador atual (identidade do preview em modo app-only, ou o UPN passado).
 *
 *  `resolvido` diz se a pessoa veio DE FATO do diretório do Entra (true) ou se é o usuário
 *  fictício de demonstração (false). O /api/me usa isso para decidir se existe identidade
 *  confiável — sem ela o portal mostra o gate de acesso em vez do conteúdo. */
export async function getProfile(
  upn?: string,
): Promise<Pessoa & { isAdmin: boolean; resolvido: boolean }> {
  const target = upn || config.entra.demoUserUpn;
  if (!graphEnabled || !target) {
    const p = mockPeople[0];
    return { ...p, isAdmin: true, resolvido: false };
  }
  try {
    const u = await graphGet(`/users/${encodeURIComponent(target)}?$select=${SELECT}`);
    const pessoa = mapPessoa(u);
    pessoa.fotoUrl = await fetchPhotoDataUrl(target);
    const isAdmin = await checkAdmin(u.id);
    return { ...pessoa, isAdmin, resolvido: true };
  } catch (e) {
    console.warn("[graph] getProfile falhou, usando demo:", (e as Error).message);
    return { ...mockPeople[0], isAdmin: true, resolvido: false };
  }
}

async function checkAdmin(userId: string): Promise<boolean> {
  if (!config.entra.adminGroupId) return true; // sem grupo configurado: libera admin em demo
  const { ids } = await getUserGroups(userId);
  return ids.includes(config.entra.adminGroupId);
}

// ---------- Grupos do Entra (base do RBAC de perfis — ver server/src/perfis.ts) ----------
// Cache CURTO por usuário: o acesso é resolvido em quase toda requisição protegida, então
// consultar memberOf a cada chamada dobraria a latência. 5 min é o compromisso entre
// refletir mudança de grupo rápido e não martelar o Graph.
const GRUPOS_TTL_MS = 5 * 60_000;
const gruposCache = new Map<string, { ids: string[]; nomes: string[]; exp: number }>();

/** Grupos (ids + nomes) de que o usuário é membro. Vazio em modo demo/sem Graph. */
export async function getUserGroups(
  idOrUpn?: string,
): Promise<{ ids: string[]; nomes: string[] }> {
  const alvo = (idOrUpn || config.entra.demoUserUpn || "").toLowerCase();
  if (!graphEnabled || !alvo) return { ids: [], nomes: [] };
  const hit = gruposCache.get(alvo);
  if (hit && hit.exp > Date.now()) return { ids: hit.ids, nomes: hit.nomes };
  try {
    const res = await graphGet<{ value: any[] }>(
      `/users/${encodeURIComponent(alvo)}/memberOf/microsoft.graph.group?$select=id,displayName&$top=200`,
    );
    const ids = res.value.map((g) => String(g.id));
    const nomes = res.value.map((g) => String(g.displayName ?? g.id));
    gruposCache.set(alvo, { ids, nomes, exp: Date.now() + GRUPOS_TTL_MS });
    return { ids, nomes };
  } catch (e) {
    console.warn("[graph] getUserGroups falhou:", (e as Error).message);
    // Cacheia o vazio por pouco tempo para não repetir a falha a cada request.
    gruposCache.set(alvo, { ids: [], nomes: [], exp: Date.now() + 30_000 });
    return { ids: [], nomes: [] };
  }
}

/** Catálogo de grupos do tenant — alimenta o multi-select da tela de perfis (o admin
 *  ESCOLHE o grupo, não digita GUID). Requer Group.Read.All (Application). */
export async function listGroups(): Promise<GrupoEntra[]> {
  if (!graphEnabled) return mockGrupos();
  try {
    const out: GrupoEntra[] = [];
    let next: string | null =
      `${GRAPH}/groups?$select=id,displayName,description,mail&$orderby=displayName&$top=100`;
    let guard = 0;
    while (next && guard < 20) {
      const res: { value: any[]; "@odata.nextLink"?: string } = await graphGetUrl(next);
      for (const g of res.value) {
        if (!g.displayName) continue;
        out.push({
          id: String(g.id),
          nome: String(g.displayName),
          descricao: g.description || undefined,
          email: g.mail || undefined,
        });
      }
      next = res["@odata.nextLink"] ?? null;
      guard++;
    }
    return out;
  } catch (e) {
    console.warn("[graph] listGroups falhou:", (e as Error).message);
    return [];
  }
}

/** Agenda (próximos 14 dias) do colaborador. */
export async function getAgenda(upn?: string): Promise<AgendaItem[]> {
  const target = upn || config.entra.demoUserUpn;
  if (!graphEnabled || !target) return mockAgenda();
  try {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + 14);
    const q =
      `/users/${encodeURIComponent(target)}/calendarView` +
      `?startDateTime=${start.toISOString()}&endDateTime=${end.toISOString()}` +
      `&$select=subject,start,end,location,isOnlineMeeting,organizer&$orderby=start/dateTime&$top=30`;
    const res = await graphGet<{ value: any[] }>(q);
    return res.value.map((e, i) => ({
      id: e.id ?? `ag_${i}`,
      titulo: e.subject ?? "(sem título)",
      inicio: e.start?.dateTime ? `${e.start.dateTime}Z`.replace("ZZ", "Z") : new Date().toISOString(),
      fim: e.end?.dateTime ? `${e.end.dateTime}Z`.replace("ZZ", "Z") : new Date().toISOString(),
      local: e.location?.displayName || undefined,
      online: Boolean(e.isOnlineMeeting),
      organizador: e.organizer?.emailAddress?.name || undefined,
    }));
  } catch (e) {
    console.warn("[graph] getAgenda falhou, usando demo:", (e as Error).message);
    return mockAgenda();
  }
}

/** Fase 3 — cria um compromisso no calendário do colaborador (Outlook).
 *  App-only exige a permissão de APLICAÇÃO `Calendars.ReadWrite` com consentimento do admin;
 *  sem ela o Graph responde 403 e devolvemos a mensagem para a UI explicar o que falta.
 *  Sem Graph (preview/demo) devolve `demo: true` — a UI segue funcionando sem escrever nada. */
export async function criarEventoNaAgenda(
  upn: string,
  ev: { titulo: string; descricao?: string; inicio: string; fim?: string; local?: string },
): Promise<{ ok: boolean; demo?: boolean; id?: string; erro?: string }> {
  const alvo = (upn || config.entra.demoUserUpn || "").trim();
  if (!graphEnabled || !alvo) return { ok: true, demo: true };
  // Fim ausente = 1 hora de duração (padrão razoável para um convite de portal).
  const inicio = new Date(ev.inicio);
  const fim = ev.fim ? new Date(ev.fim) : new Date(inicio.getTime() + 60 * 60_000);
  try {
    const criado = await graphPost<{ id?: string }>(
      `/users/${encodeURIComponent(alvo)}/events`,
      {
        subject: ev.titulo,
        body: { contentType: "text", content: ev.descricao || "Evento publicado no portal." },
        start: { dateTime: inicio.toISOString().slice(0, 19), timeZone: "UTC" },
        end: { dateTime: fim.toISOString().slice(0, 19), timeZone: "UTC" },
        location: ev.local ? { displayName: ev.local } : undefined,
        // O portal apenas COLOCA na agenda de quem pediu: nada de convidar terceiros.
        isReminderOn: true,
        reminderMinutesBeforeStart: 60,
      },
    );
    return { ok: true, id: criado?.id };
  } catch (e) {
    const msg = (e as Error).message;
    const semPermissao = /\b403\b/.test(msg);
    console.warn("[graph] criarEventoNaAgenda falhou:", msg);
    return {
      ok: false,
      erro: semPermissao
        ? "O aplicativo não tem a permissão Calendars.ReadWrite (Application) concedida no Entra ID."
        : msg,
    };
  }
}

/** Diretório COMPLETO da empresa (todos os usuários ATIVOS @trustsis.com ligados ao CEO,
 *  com foto). É a parte PESADA do organograma (listagem paginada + fotos) — por isso é
 *  extraída aqui para o scan diário (cache.ts) chamar 1x/dia, sem depender de um upn. */
export async function fetchDiretorioLive(): Promise<Pessoa[]> {
  if (!graphEnabled) return mockOrg().diretorio ?? [];
  try {
    // Expande o gestor (manager) de cada usuário para montar a árvore hierárquica.
    // Se o tenant não permitir $expand=manager, cai para a listagem simples (árvore plana).
    let todos: any[];
    try {
      todos = await listAllUsers("", "manager($select=id)");
    } catch {
      todos = await listAllUsers();
    }
    const brutos = todos.filter((u) => {
      // Somente usuários ATIVOS no Entra e com e-mail do domínio @trustsis.com.
      if (u.accountEnabled === false) return false;
      const mail = String(u.mail ?? u.userPrincipalName ?? "").toLowerCase();
      return mail.endsWith("@trustsis.com");
    });
    // Só o CEO (Claudio) e seus liderados diretos/indiretos (filtra antes das fotos
    // para não baixar fotos de quem será removido).
    const diretorio = limitarAoCeo(brutos.map(mapPessoa));
    await attachPhotos(diretorio);
    diretorio.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return diretorio;
  } catch (e) {
    console.warn("[graph] fetchDiretorioLive falhou:", (e as Error).message);
    return [];
  }
}

/** Organograma: estrutura pessoal (gestor/liderados) + diretório COMPLETO da empresa.
 *  O `diretorio` (pesado) vem do cache diário quando `opts.diretorio` é passado — assim a
 *  página abre instantânea; sem cache, busca ao vivo (fallback). */
export async function getOrg(
  upn?: string,
  opts?: { diretorio?: Pessoa[] },
): Promise<OrgNode> {
  const target = upn || config.entra.demoUserUpn;
  if (!graphEnabled || !target) return mockOrg();

  // CAMINHO RÁPIDO (instantâneo): com o diretório do scan diário em mãos, a estrutura
  // pessoal (self/gestor/liderados) é DERIVADA do próprio cache — SEM nenhuma chamada ao
  // vivo ao Graph. A página de organograma só consome `diretorio` (já cacheado com fotos),
  // então isto elimina o delay de vários segundos que vinha das ~4 chamadas por request
  // (perfil + foto + manager + directReports) que rodavam a cada abertura da tela.
  if (opts?.diretorio && opts.diretorio.length) {
    const dir = opts.diretorio;
    const alvo = target.toLowerCase();
    const self =
      dir.find((p) => p.id.toLowerCase() === alvo) ??
      dir.find((p) => (p.email ?? "").toLowerCase() === alvo);
    if (self) {
      const gestor = self.managerId ? dir.find((p) => p.id === self.managerId) : undefined;
      const liderados = dir.filter((p) => p.managerId === self.id);
      return { ...self, gestor, liderados, diretorio: dir };
    }
    // Usuário fora do diretório cacheado (ex.: fora da cadeia do CEO): serve mesmo assim o
    // diretório fixado, com estrutura pessoal mínima — continua SEM chamada ao vivo.
    return { id: alvo, nome: "—", liderados: [], diretorio: dir };
  }

  // Sem cache (1ª vez / snapshot ainda vazio): caminho ao vivo (mais lento, inclui baixar
  // o diretório completo). Assim que o scan diário roda, as próximas aberturas são instantâneas.
  try {
    const u = await graphGet(`/users/${encodeURIComponent(target)}?$select=${SELECT}`);
    const self = mapPessoa(u);
    self.fotoUrl = await fetchPhotoDataUrl(target);

    let gestor: Pessoa | undefined;
    try {
      const m = await graphGet(`/users/${encodeURIComponent(target)}/manager?$select=${SELECT}`);
      gestor = mapPessoa(m);
      gestor.fotoUrl = await fetchPhotoDataUrl(gestor.id);
    } catch { /* topo da cadeia */ }

    let liderados: Pessoa[] = [];
    try {
      const dr = await graphGet<{ value: any[] }>(
        `/users/${encodeURIComponent(target)}/directReports?$select=${SELECT}`,
      );
      liderados = dr.value.map(mapPessoa);
      await attachPhotos(liderados);
    } catch { /* sem liderados */ }

    // Diretório do cache diário (instantâneo) ou ao vivo (1ª vez / cache vazio).
    const diretorio = opts?.diretorio ?? (await fetchDiretorioLive());

    return { ...self, gestor, liderados, diretorio };
  } catch (e) {
    console.warn("[graph] getOrg falhou, usando demo:", (e as Error).message);
    return mockOrg();
  }
}

/** Aniversariantes REAIS: lê o campo `birthday` de cada usuário do Entra (User.Read.All).
 *  Em modo demo retorna vazio (o endpoint cai para o store). */
export async function getBirthdays(): Promise<Aniversariante[]> {
  if (!graphEnabled) return [];
  try {
    const users = await listAllUsers("birthday");
    const comData = users.filter((u) => {
      if (!u.birthday) return false;
      // Graph devolve "0001-01-01T..." quando não há aniversário cadastrado.
      if (String(u.birthday).startsWith("0001")) return false;
      // MESMO filtro do diretório: só contas ATIVAS @trustsis.com. Sem isto, um GUEST
      // @porttus.com (mesma pessoa que já é member @trustsis.com) entrava também e o
      // colaborador aparecia DUPLICADO na lista de aniversariantes.
      if (u.accountEnabled === false) return false;
      const mail = String(u.mail ?? u.userPrincipalName ?? "").toLowerCase();
      return mail.endsWith("@trustsis.com");
    });
    const list = await Promise.all(
      comData.map(async (u) => {
        const d = new Date(u.birthday);
        const p: Aniversariante = {
          id: u.id,
          nome: u.displayName ?? "—",
          area: u.department ?? "",
          dia: d.getUTCDate(),
          mes: d.getUTCMonth() + 1,
          fotoUrl: await fetchPhotoDataUrl(u.id),
        };
        return p;
      }),
    );
    return list.sort((a, b) => a.mes - b.mes || a.dia - b.dia);
  } catch (e) {
    console.warn("[graph] getBirthdays falhou:", (e as Error).message);
    return [];
  }
}

/** Lista os departamentos existentes (campo department) dos usuários ATIVOS @trustsis.com.
 *  Leve: NÃO baixa fotos. Usado nos seletores de departamento (comunicados). */
export async function getDepartments(): Promise<string[]> {
  if (!graphEnabled) {
    const set = new Set(mockPeople.map((p) => p.area).filter(Boolean) as string[]);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }
  try {
    const users = (await listAllUsers()).filter((u) => {
      if (u.accountEnabled === false) return false;
      const mail = String(u.mail ?? u.userPrincipalName ?? "").toLowerCase();
      return mail.endsWith("@trustsis.com");
    });
    const set = new Set<string>();
    for (const u of users) {
      const d = String(u.department ?? "").trim();
      if (d) set.add(d);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"));
  } catch (e) {
    console.warn("[graph] getDepartments falhou:", (e as Error).message);
    return [];
  }
}

// ---------- Políticas internas (documentos do SharePoint/OneDrive) ----------
// As políticas NÃO são cadastradas no portal: são os arquivos reais compartilhados com
// todos os colaboradores numa pasta do SharePoint/OneDrive. O portal apenas LISTA essa
// pasta via Graph (`/shares`) e abre cada documento. Requer a permissão de aplicação
// Sites.Read.All (ou Files.Read.All) concedida ao app-only, além de POLITICAS_SHARE_URL.

/** Codifica uma URL de compartilhamento para o formato de shareId do Graph (`u!...`). */
function encodeShareUrl(url: string): string {
  const b64 = Buffer.from(url, "utf8").toString("base64");
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

/** Rótulo amigável do tipo de arquivo a partir da extensão. */
function tipoDoArquivo(nome: string): string {
  const ext = (nome.split(".").pop() || "").toLowerCase();
  const map: Record<string, string> = {
    pdf: "PDF", doc: "Word", docx: "Word", xls: "Excel", xlsx: "Excel",
    ppt: "PowerPoint", pptx: "PowerPoint", txt: "Texto", rtf: "Texto",
    png: "Imagem", jpg: "Imagem", jpeg: "Imagem", gif: "Imagem",
    zip: "Arquivo", one: "OneNote",
  };
  return map[ext] ?? (ext ? ext.toUpperCase() : "Arquivo");
}

/** Lista os filhos de um driveItem (paginando), já filtrando o essencial. */
async function driveChildren(driveId: string, itemId: string): Promise<any[]> {
  const out: any[] = [];
  let next: string | null =
    `${GRAPH}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/children` +
    `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=200`;
  let guard = 0;
  while (next && guard < 20) {
    const res: { value: any[]; "@odata.nextLink"?: string } = await graphGetUrl(next);
    out.push(...res.value);
    next = res["@odata.nextLink"] ?? null;
    guard++;
  }
  return out;
}

function mapDoc(f: any, categoria?: string): PoliticaDoc {
  return {
    id: f.id,
    nome: f.name ?? "documento",
    categoria: categoria || "Geral",
    tipo: tipoDoArquivo(f.name ?? ""),
    tamanho: typeof f.size === "number" ? f.size : undefined,
    atualizadoEm: f.lastModifiedDateTime || undefined,
    webUrl: f.webUrl ?? "",
  };
}

// Cache curto por pasta: navegar entre bibliotecas não pode virar enxurrada de chamadas ao
// Graph. TTL baixo de propósito (documento novo aparece rápido) e invalidável por `forcar`.
const DOCS_TTL_MS = 5 * 60_000;
const docsCache = new Map<string, { em: number; docs: PoliticaDoc[] }>();
/** driveId resolvido por pasta compartilhada — necessário para pedir o PREVIEW de um item
 *  (Fase 4) sem refazer a resolução do /shares a cada abertura de documento. */
const driveDoShare = new Map<string, string>();

/** Documentos (1 nível de subpastas) de QUALQUER pasta compartilhada do SharePoint/OneDrive.
 *  É o motor por trás das Políticas internas e das Bibliotecas de documentos (Fase 2):
 *  cada SUBPASTA vira uma categoria e os arquivos da raiz caem em "Geral".
 *  Requer `Sites.Read.All` (ou `Files.Read.All`) Application no registro do app. */
export async function listarDocsDoShare(shareUrl: string, forcar = false): Promise<PoliticaDoc[]> {
  const url = (shareUrl || "").trim();
  if (!graphEnabled || !url) return [];
  const cacheado = docsCache.get(url);
  if (!forcar && cacheado && Date.now() - cacheado.em < DOCS_TTL_MS) return cacheado.docs;
  try {
    const shareId = encodeShareUrl(url);
    const root = await graphGet<any>(`/shares/${shareId}/driveItem?$select=id,parentReference`);
    const driveId: string | undefined = root?.parentReference?.driveId;
    const rootId: string | undefined = root?.id;
    if (!driveId || !rootId) return [];
    driveDoShare.set(url, driveId);

    const top = await driveChildren(driveId, rootId);
    const docs: PoliticaDoc[] = [];
    const subpastas: any[] = [];
    for (const item of top) {
      if (item.folder) subpastas.push(item);
      else if (item.file) docs.push(mapDoc(item));
    }
    // Um nível de subpastas em paralelo (cada uma vira categoria).
    const porPasta = await Promise.all(
      subpastas.map(async (p) => {
        try {
          const filhos = await driveChildren(driveId, p.id);
          return filhos.filter((f) => f.file).map((f) => mapDoc(f, p.name));
        } catch {
          return [] as PoliticaDoc[];
        }
      }),
    );
    for (const arr of porPasta) docs.push(...arr);

    docs.sort(
      (a, b) =>
        (a.categoria ?? "").localeCompare(b.categoria ?? "", "pt-BR") ||
        a.nome.localeCompare(b.nome, "pt-BR"),
    );
    docsCache.set(url, { em: Date.now(), docs });
    return docs;
  } catch (e) {
    console.warn("[graph] listarDocsDoShare falhou:", (e as Error).message);
    // Falhou agora mas tem cache anterior: melhor servir o antigo do que uma lista vazia.
    return cacheado?.docs ?? [];
  }
}

/** Documentos de política (a pasta configurada em Administração › Integração).
 *  Sem Graph => docs DEMO (preview navegável). Com Graph mas sem a pasta configurada
 *  => lista vazia (a página mostra o aviso de configuração). */
export async function getPoliticas(): Promise<PoliticaDoc[]> {
  if (!graphEnabled) return mockPoliticas();
  return listarDocsDoShare(config.politicas.shareUrl);
}

/** Fase 4 — URL EMBUTÍVEL (iframe) de um documento de uma pasta compartilhada. O Graph
 *  devolve um link temporário de visualização (`/preview`), que é o que permite ler a
 *  política DENTRO do portal antes de confirmar. Falhou (ou sem Graph)? Devolve null e a UI
 *  cai no link do SharePoint. */
export async function previewDoDoc(shareUrl: string, itemId: string): Promise<string | null> {
  const url = (shareUrl || "").trim();
  if (!graphEnabled || !url || !itemId) return null;
  try {
    let driveId = driveDoShare.get(url);
    if (!driveId) {
      // Cache frio: resolve a pasta (a listagem já preenche o mapa em uso normal).
      const root = await graphGet<any>(`/shares/${encodeShareUrl(url)}/driveItem?$select=id,parentReference`);
      driveId = root?.parentReference?.driveId;
      if (!driveId) return null;
      driveDoShare.set(url, driveId);
    }
    const r = await graphPost<{ getUrl?: string }>(
      `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/preview`,
      {},
    );
    return r?.getUrl ?? null;
  } catch (e) {
    console.warn("[graph] previewDoDoc falhou:", (e as Error).message);
    return null;
  }
}

// ---------- OneDrive pessoal (acesso integrado às pastas do próprio colaborador) ----------
// Diferente das BIBLIOTECAS (pastas institucionais compartilhadas, cadastradas pelo admin):
// aqui o colaborador navega no PRÓPRIO OneDrive, read-only, e abre o arquivo no Office/Web.
// A identidade sempre vem do backend (token/UPN resolvido) — o cliente nunca escolhe o drive.
// Requer `Files.Read.All` (Application) com consentimento do admin no registro do app.

function mapArquivoPessoal(f: any): ArquivoPessoal {
  const pasta = Boolean(f?.folder);
  return {
    id: String(f?.id ?? ""),
    nome: f?.name ?? (pasta ? "pasta" : "arquivo"),
    pasta,
    tipo: pasta ? undefined : tipoDoArquivo(f?.name ?? ""),
    tamanho: typeof f?.size === "number" ? f.size : undefined,
    atualizadoEm: f?.lastModifiedDateTime || undefined,
    webUrl: f?.webUrl ?? "",
    itens: pasta ? (f.folder?.childCount ?? undefined) : undefined,
  };
}

/** Pasta primeiro, depois por nome — a ordem que se espera de um explorador de arquivos. */
function ordenarArquivos(a: ArquivoPessoal, b: ArquivoPessoal): number {
  if (a.pasta !== b.pasta) return a.pasta ? -1 : 1;
  return a.nome.localeCompare(b.nome, "pt-BR");
}

/** Traduz a falha do Graph numa instrução ACIONÁVEL para a UI (em vez de "Graph 403 …"). */
function erroDeDrive(e: Error): string {
  const msg = e.message || "";
  if (/\b403\b|accessDenied|Authorization_RequestDenied/i.test(msg)) {
    return "O portal não tem permissão para ler o OneDrive. Conceda o consentimento de "
      + "administrador para `Files.Read.All` (Application) no registro do app no Entra ID.";
  }
  if (/\b404\b|itemNotFound|ResourceNotFound/i.test(msg)) {
    return "Este usuário não tem um OneDrive provisionado (ou a pasta não existe mais).";
  }
  return `Não foi possível listar o OneDrive: ${msg.slice(0, 200)}`;
}

/** Lista uma pasta do OneDrive do usuário (raiz quando `pastaId` vem vazio). */
export async function listarMeuDrive(upn: string, pastaId?: string): Promise<MeuDrive> {
  if (!graphEnabled) return { pasta: null, itens: [], demo: true };
  const usuario = (upn || "").trim();
  if (!usuario) return { pasta: null, itens: [], erro: "Usuário não identificado." };
  const dono = encodeURIComponent(usuario);
  try {
    // `pastaId` vazio = raiz. O nome da pasta atual vem na mesma resposta do item.
    const alvo = pastaId
      ? `/users/${dono}/drive/items/${encodeURIComponent(pastaId)}`
      : `/users/${dono}/drive/root`;
    const item = await graphGet<any>(`${alvo}?$select=id,name,webUrl,folder`);
    if (!item?.folder) return { pasta: null, itens: [], erro: "O item selecionado não é uma pasta." };

    const filhos = await graphGetUrl<{ value: any[] }>(
      `${GRAPH}${alvo}/children` +
        `?$select=id,name,webUrl,size,lastModifiedDateTime,file,folder&$top=200`,
    );
    const itens = (filhos.value ?? []).map(mapArquivoPessoal).sort(ordenarArquivos);

    // Na raiz, "Recentes" é o atalho mais útil (é o que o usuário abriu por último em
    // qualquer pasta). Best-effort: se falhar, a listagem principal continua valendo.
    let recentes: ArquivoPessoal[] | undefined;
    if (!pastaId) {
      try {
        const r = await graphGet<{ value: any[] }>(`/users/${dono}/drive/recent?$top=8`);
        recentes = (r.value ?? [])
          .filter((f) => f?.file)
          .map(mapArquivoPessoal)
          .slice(0, 8);
      } catch {
        recentes = undefined;
      }
    }
    return { pasta: { id: item.id, nome: pastaId ? (item.name ?? "pasta") : "Meus arquivos" }, itens, recentes };
  } catch (e) {
    console.warn("[graph] listarMeuDrive falhou:", (e as Error).message);
    return { pasta: null, itens: [], erro: erroDeDrive(e as Error) };
  }
}

/** Quem está de férias/ausente: lê automaticRepliesSetting (out-of-office) via Graph.
 *  Quando o Graph está ligado, retorna dados REAIS — inclusive lista vazia (ninguém
 *  ausente). Só cai para dados demo quando o Graph está desligado ou falha por completo. */
export async function getVacations(): Promise<Ausencia[]> {
  if (!graphEnabled) return mockVacations();
  try {
    const users = (await listAllUsers()).slice(0, 200);
    const out: Ausencia[] = [];
    await Promise.all(
      users.map(async (u) => {
        try {
          const s = await graphGet<any>(
            `/users/${encodeURIComponent(u.id)}/mailboxSettings/automaticRepliesSetting`,
          );
          if (s?.status && s.status !== "disabled") {
            const pessoa = mapPessoa(u);
            pessoa.fotoUrl = await fetchPhotoDataUrl(u.id);
            out.push({
              pessoa,
              mensagem: (s.internalReplyMessage || "").replace(/<[^>]+>/g, "").trim().slice(0, 160) || undefined,
              ate: s.scheduledEndDateTime?.dateTime ? `${s.scheduledEndDateTime.dateTime}Z` : undefined,
            });
          }
        } catch { /* mailbox sem permissão/erro: ignora */ }
      }),
    );
    out.sort((a, b) => a.pessoa.nome.localeCompare(b.pessoa.nome, "pt-BR"));
    return out; // REAL, mesmo que vazio
  } catch (e) {
    console.warn("[graph] getVacations falhou, usando demo:", (e as Error).message);
    return mockVacations();
  }
}
