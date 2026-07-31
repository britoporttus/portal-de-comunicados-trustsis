// Integração com o Microsoft Graph via fluxo app-only (client credentials).
// Sempre degrada para dados DEMO quando o Graph não está configurado ou falha,
// para que o portal continue funcionando no preview.
import { ConfidentialClientApplication } from "@azure/msal-node";
import { config, graphEnabled } from "./config.js";
import type { Pessoa, AgendaItem, Ausencia, OrgNode, Aniversariante } from "./types.js";
import { mockPeople, mockAgenda, mockOrg, mockVacations } from "./mock.js";

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

/** Mantém o CEO (Claudio) e quem reporta a ele — direta ou indiretamente — MAIS as pessoas
 *  de topo (sem gestor no diretório) que tenham cargo ou área (sócios/execs, ex.: joao.brito,
 *  que não tem manager e antes sumia das buscas) — E MAIS os e-mails da lista SEMPRE_MANTER
 *  (exceção manual p/ quem não tem nem cargo/área, mas precisa aparecer). Remove contas soltas
 *  de serviço/salas (sem cargo nem área). Seguro contra ciclos (usa conjunto de visitados). */
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
  // Além da cadeia do CEO, mantém pessoas de TOPO (sem gestor no diretório) que sejam
  // colaboradores REAIS — têm cargo OU área. Isso inclui sócios/execs que não reportam a
  // ninguém (ex.: joao.brito, que não tem manager e antes sumia das buscas), sem reintroduzir
  // salas/contas de serviço (essas normalmente não têm cargo nem departamento).
  for (const p of pessoas) {
    if (keep.has(p.id)) continue;
    if (SEMPRE_MANTER.has(emailDe(p))) {
      keep.add(p.id);
      continue;
    }
    const temGestorNoDir = p.managerId && byId.has(p.managerId) && p.managerId !== p.id;
    const pessoaReal = Boolean(p.cargo || p.area);
    if (!temGestorNoDir && pessoaReal) keep.add(p.id);
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

export const isGraphOn = graphEnabled;

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

/** Perfil do colaborador atual (DEMO_USER_UPN em modo app-only, ou o UPN passado). */
export async function getProfile(upn?: string): Promise<Pessoa & { isAdmin: boolean }> {
  const target = upn || config.entra.demoUserUpn;
  if (!graphEnabled || !target) {
    const p = mockPeople[0];
    return { ...p, isAdmin: true };
  }
  try {
    const u = await graphGet(`/users/${encodeURIComponent(target)}?$select=${SELECT}`);
    const pessoa = mapPessoa(u);
    pessoa.fotoUrl = await fetchPhotoDataUrl(target);
    const isAdmin = await checkAdmin(u.id);
    return { ...pessoa, isAdmin };
  } catch (e) {
    console.warn("[graph] getProfile falhou, usando demo:", (e as Error).message);
    return { ...mockPeople[0], isAdmin: true };
  }
}

async function checkAdmin(userId: string): Promise<boolean> {
  if (!config.entra.adminGroupId) return true; // sem grupo configurado: libera admin em demo
  try {
    const res = await graphGet<{ value: any[] }>(
      `/users/${encodeURIComponent(userId)}/memberOf/microsoft.graph.group?$select=id`,
    );
    return res.value.some((g) => g.id === config.entra.adminGroupId);
  } catch {
    return false;
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
      return !String(u.birthday).startsWith("0001");
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
