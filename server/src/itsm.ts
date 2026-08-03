// Cliente HTTP para a plataforma de chamados trustsis-itsm (server-to-server, app-only).
//
// ARQUITETURA (decidida com o usuário — "opção A"): os DOIS apps (portal + ITSM) são app
// registrations no MESMO tenant Entra, com os MESMOS usuários. O portal autentica no ITSM por
// client-credentials (token app-only, scope = api://<itsm>/.default) e envia QUEM abriu o chamado
// no CORPO ({ requester: { upn, nome } }). O ITSM apenas LÊ esse solicitante (não deriva do token,
// pois o token app-only não tem UPN). Idempotência via `externalRef` (o id do ticket no portal).
//
// Este módulo NUNCA lança para o chamador em caminho crítico: quando o ITSM está desligado ou
// falha, o portal continua operando 100% no store local (o ticket já foi gravado localmente).
//
// CONTRATO (server-to-server / app-only): documentado em trustsis-itsm/.hive/notes/sso-entra-id.md.
// O endpoint app-only do ITSM está sendo implementado pelo outro time. Os nomes de campo do corpo
// (requester/externalRef) e o cabeçalho de tenant estão centralizados aqui — se o contrato final
// divergir, ajuste SÓ em `montarCorpo()` / os headers abaixo.
import { ConfidentialClientApplication } from "@azure/msal-node";
import { config, itsmEnabled } from "./config.js";
import type { Ticket, TicketTipo, TicketPrioridade, TicketStatus } from "./types.js";

// ---- mapeamento de enums (portal <-> ITSM .NET) ----
// ITSM TicketType: Incident=0, ServiceRequest=1  |  Priority: Low=0, Medium=1, High=2, Critical=3
const TIPO_TO_ITSM: Record<TicketTipo, number> = { incidente: 0, requisicao: 1 };
const PRIO_TO_ITSM: Record<TicketPrioridade, number> = { baixa: 0, media: 1, alta: 2, critica: 3 };

// ITSM TicketStatus: New0 InProgress1 OnHold2 PendingApproval3 Approved4 Rejected5 Scheduled6
// Implementing7 Resolved8 Reopened9 Closed10 Cancelled11 Failed12 -> subconjunto exposto no portal.
const ITSM_TO_STATUS: Record<number, TicketStatus> = {
  0: "aberto",
  1: "em_andamento",
  2: "aguardando",
  3: "aguardando",
  4: "em_andamento",
  5: "cancelado",
  6: "aguardando",
  7: "em_andamento",
  8: "resolvido",
  9: "em_andamento",
  10: "fechado",
  11: "cancelado",
  12: "cancelado",
};
export function statusDoItsm(n: number | undefined | null): TicketStatus {
  return (n != null && ITSM_TO_STATUS[n]) || "aberto";
}

// ---- token app-only (client-credentials) para a API do ITSM ----
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
  const res = await client().acquireTokenByClientCredential({ scopes: [config.itsm.apiScope] });
  if (!res?.accessToken) throw new Error("sem access token para a API do ITSM");
  tokenCache = { value: res.accessToken, exp: res.expiresOn?.getTime() ?? Date.now() + 3_000_000 };
  return res.accessToken;
}

async function itsmFetch(pathAndQuery: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  return fetch(`${config.itsm.baseUrl}${pathAndQuery}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      // Multi-tenant do ITSM: resolve o tenant por este header (default "trustsis").
      "X-Tenant-Subdomain": config.itsm.tenantSubdomain,
      ...(init?.headers ?? {}),
    },
  });
}

// Corpo de criação no ITSM. Centralizado para alinhar com o contrato final do outro time.
function montarCorpo(t: Ticket) {
  return {
    type: TIPO_TO_ITSM[t.tipo],
    title: t.titulo,
    description: t.descricao,
    priority: PRIO_TO_ITSM[t.prioridade],
    // Idempotência: o ITSM deve deduplicar por externalRef (reenvio não cria duplicado).
    externalRef: t.id,
    // O solicitante vem do PORTAL — o ITSM só lê (token app-only não carrega UPN).
    requester: { upn: t.solicitante, nome: t.solicitanteNome },
  };
}

export interface ResultadoItsm {
  externoRef: string; // "INC-0042" / "REQ-0007" — referência legível do ITSM
  numero?: number;
  status?: TicketStatus;
  responsavel?: string;
}

/** Empurra um ticket recém-criado no portal para o ITSM. Retorna a referência do ITSM ou
 *  `null` se a integração estiver off ou a chamada falhar (o caller mantém o ticket local). */
export async function criarTicketNoItsm(t: Ticket): Promise<ResultadoItsm | null> {
  if (!itsmEnabled) return null;
  try {
    const r = await itsmFetch("/api/tickets", { method: "POST", body: JSON.stringify(montarCorpo(t)) });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[itsm] POST /api/tickets ${r.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const j: any = await r.json().catch(() => ({}));
    const ref = j?.reference ?? (j?.number != null ? `#${j.number}` : undefined);
    if (!ref) return null;
    return {
      externoRef: String(ref),
      numero: typeof j?.number === "number" ? j.number : undefined,
      status: statusDoItsm(j?.status),
      responsavel: j?.assigneeEmail || undefined,
    };
  } catch (e) {
    console.warn(`[itsm] falha ao criar ticket no ITSM: ${(e as Error).message}`);
    return null;
  }
}

/** Atualiza (best-effort) o status/responsável de um ticket já sincronizado, buscando pela
 *  referência do ITSM. Retorna os campos atualizados ou `null` se off/falhar. */
export async function sincronizarTicket(externoRef: string): Promise<Partial<ResultadoItsm> | null> {
  if (!itsmEnabled || !externoRef) return null;
  try {
    const q = `?search=${encodeURIComponent(externoRef)}&page=1&pageSize=1`;
    const r = await itsmFetch(`/api/tickets${q}`, { method: "GET" });
    if (!r.ok) return null;
    const j: any = await r.json().catch(() => ({}));
    const item = Array.isArray(j?.items) ? j.items[0] : undefined;
    if (!item) return null;
    return {
      status: statusDoItsm(item?.status),
      numero: typeof item?.number === "number" ? item.number : undefined,
      responsavel: item?.assigneeEmail || undefined,
    };
  } catch {
    return null;
  }
}

export { itsmEnabled };
