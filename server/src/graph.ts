// Integração com o Microsoft Graph via fluxo app-only (client credentials).
// Sempre degrada para dados DEMO quando o Graph não está configurado ou falha,
// para que o portal continue funcionando no preview.
import { ConfidentialClientApplication } from "@azure/msal-node";
import { config, graphEnabled } from "./config.js";
import type { Pessoa, AgendaItem, Ausencia, OrgNode } from "./types.js";
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

async function graphGet<T = any>(path: string): Promise<T> {
  const token = await getToken();
  const r = await fetch(`${GRAPH}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Graph ${r.status} em ${path}: ${body.slice(0, 300)}`);
  }
  return (await r.json()) as T;
}

function mapPessoa(u: any): Pessoa {
  return {
    id: u.id,
    nome: u.displayName ?? "—",
    cargo: u.jobTitle ?? undefined,
    area: u.department ?? undefined,
    email: u.mail ?? u.userPrincipalName ?? undefined,
    telefone: u.mobilePhone ?? (u.businessPhones?.[0] as string) ?? undefined,
  };
}

const SELECT = "id,displayName,jobTitle,department,mail,userPrincipalName,mobilePhone,businessPhones";

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

/** Organograma: pessoa + gestor + liderados (Org Explorer via manager do Entra). */
export async function getOrg(upn?: string): Promise<OrgNode> {
  const target = upn || config.entra.demoUserUpn;
  if (!graphEnabled || !target) return mockOrg();
  try {
    const u = await graphGet(`/users/${encodeURIComponent(target)}?$select=${SELECT}`);
    const self = mapPessoa(u);
    let gestor: Pessoa | undefined;
    try {
      const m = await graphGet(`/users/${encodeURIComponent(target)}/manager?$select=${SELECT}`);
      gestor = mapPessoa(m);
    } catch { /* topo da cadeia */ }
    let liderados: Pessoa[] = [];
    try {
      const dr = await graphGet<{ value: any[] }>(
        `/users/${encodeURIComponent(target)}/directReports?$select=${SELECT}`,
      );
      liderados = dr.value.map(mapPessoa);
    } catch { /* sem liderados */ }
    return { ...self, gestor, liderados };
  } catch (e) {
    console.warn("[graph] getOrg falhou, usando demo:", (e as Error).message);
    return mockOrg();
  }
}

/** Quem está de férias/ausente: lê automaticRepliesSetting (out-of-office) via Graph. */
export async function getVacations(): Promise<Ausencia[]> {
  if (!graphEnabled) return mockVacations();
  try {
    // amostra de usuários (bounded) — idealmente membros do grupo "todos"
    const res = await graphGet<{ value: any[] }>(
      `/users?$select=${SELECT}&$top=20`,
    );
    const out: Ausencia[] = [];
    await Promise.all(
      res.value.map(async (u) => {
        try {
          const s = await graphGet<any>(
            `/users/${encodeURIComponent(u.id)}/mailboxSettings/automaticRepliesSetting`,
          );
          if (s?.status && s.status !== "disabled") {
            out.push({
              pessoa: mapPessoa(u),
              mensagem: (s.internalReplyMessage || "").replace(/<[^>]+>/g, "").trim().slice(0, 160) || undefined,
              ate: s.scheduledEndDateTime?.dateTime ? `${s.scheduledEndDateTime.dateTime}Z` : undefined,
            });
          }
        } catch { /* mailbox sem permissão/erro: ignora */ }
      }),
    );
    return out.length ? out : mockVacations();
  } catch (e) {
    console.warn("[graph] getVacations falhou, usando demo:", (e as Error).message);
    return mockVacations();
  }
}
