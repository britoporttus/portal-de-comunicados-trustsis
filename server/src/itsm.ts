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
import { aoMudarIntegracao } from "./settings.js";
import type { Ticket, TicketTipo, TicketPrioridade, TicketStatus } from "./types.js";

// ---- mapeamento de enums (portal <-> ITSM .NET) ----
// O ITSM serializa E aceita os enums por NOME (JsonStringEnumConverter registrado no Program.cs do
// ITSM). TicketType: Incident|ServiceRequest|Problem|Change  |  Priority: Low|Medium|High|Critical.
const TIPO_TO_ITSM: Record<TicketTipo, string> = { incidente: "Incident", requisicao: "ServiceRequest" };
const PRIO_TO_ITSM: Record<TicketPrioridade, string> = {
  baixa: "Low",
  media: "Medium",
  alta: "High",
  critica: "Critical",
};

// ITSM TicketStatus (por nome): New InProgress OnHold PendingApproval Approved Rejected Scheduled
// Implementing Resolved Reopened Closed Cancelled Failed -> subconjunto exposto no portal.
const ITSM_TO_STATUS: Record<string, TicketStatus> = {
  New: "aberto",
  InProgress: "em_andamento",
  OnHold: "aguardando",
  PendingApproval: "aguardando",
  Approved: "em_andamento",
  Rejected: "cancelado",
  Scheduled: "aguardando",
  Implementing: "em_andamento",
  Resolved: "resolvido",
  Reopened: "em_andamento",
  Closed: "fechado",
  Cancelled: "cancelado",
  Failed: "cancelado",
};
// Mesma ordem dos enums do ITSM — tolera a serialização vir como índice numérico, se um dia mudar.
const ITSM_STATUS_BY_INDEX: TicketStatus[] = [
  "aberto", "em_andamento", "aguardando", "aguardando", "em_andamento", "cancelado",
  "aguardando", "em_andamento", "resolvido", "em_andamento", "fechado", "cancelado", "cancelado",
];
export function statusDoItsm(s: string | number | undefined | null): TicketStatus {
  if (typeof s === "string" && ITSM_TO_STATUS[s]) return ITSM_TO_STATUS[s];
  if (typeof s === "number" && ITSM_STATUS_BY_INDEX[s]) return ITSM_STATUS_BY_INDEX[s];
  return "aberto";
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

// Credenciais editadas na tela de Administração → descarta cliente e token antigos.
aoMudarIntegracao(() => {
  cca = null;
  tokenCache = null;
});

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

// Corpo de criação no ITSM — casa 1:1 com o DTO PortalCreateTicketRequest do ITSM
// (Endpoints/PortalEndpoints.cs): campos PLANOS requesterUpn/requesterName (não aninhados).
function montarCorpo(t: Ticket) {
  return {
    type: TIPO_TO_ITSM[t.tipo],
    title: t.titulo,
    description: t.descricao,
    priority: PRIO_TO_ITSM[t.prioridade],
    // Idempotência: o ITSM deduplica por externalRef (reenvio não cria duplicado). Usamos o id do
    // ticket no PORTAL como chave externa — é por ele que a sincronização (GET) busca depois.
    externalRef: t.id,
    // O solicitante vem do PORTAL — o ITSM só lê (token app-only não carrega UPN). Campos planos.
    requesterUpn: t.solicitante,
    requesterName: t.solicitanteNome,
    // Origem: o ITSM persiste e roteia por Source (fila de chamados internos + regras da plataforma).
    source: "portal",
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
    const r = await itsmFetch("/api/portal/tickets", {
      method: "POST",
      body: JSON.stringify(montarCorpo(t)),
    });
    // 201 = criado; 200 = idempotente (mesmo externalRef já existia). Ambos trazem o corpo.
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.warn(`[itsm] POST /api/portal/tickets ${r.status}: ${body.slice(0, 300)}`);
      return null;
    }
    const j: any = await r.json().catch(() => ({}));
    const ref = j?.reference ?? (j?.number != null ? `#${j.number}` : undefined);
    if (!ref) return null;
    return {
      externoRef: String(ref),
      numero: typeof j?.number === "number" ? j.number : undefined,
      status: statusDoItsm(j?.status),
      responsavel: j?.assigneeEmail || j?.assigneeName || undefined,
    };
  } catch (e) {
    console.warn(`[itsm] falha ao criar ticket no ITSM: ${(e as Error).message}`);
    return null;
  }
}

/** Atualiza (best-effort) o status/responsável de um ticket já espelhado no ITSM. Busca pelo
 *  `externalRef` — que é o ID do ticket no PORTAL (o mesmo enviado na criação), NÃO a referência
 *  "INC-0042". O ITSM devolve UM ticket (ou 404). Retorna os campos ou `null` se off/falhar. */
export async function sincronizarTicket(portalTicketId: string): Promise<Partial<ResultadoItsm> | null> {
  if (!itsmEnabled || !portalTicketId) return null;
  try {
    const q = `?externalRef=${encodeURIComponent(portalTicketId)}`;
    const r = await itsmFetch(`/api/portal/tickets${q}`, { method: "GET" });
    if (!r.ok) return null; // 404 = ainda não espelhado / não encontrado
    const item: any = await r.json().catch(() => ({}));
    if (!item?.id) return null;
    return {
      status: statusDoItsm(item?.status),
      numero: typeof item?.number === "number" ? item.number : undefined,
      responsavel: item?.assigneeEmail || item?.assigneeName || undefined,
    };
  } catch {
    return null;
  }
}

export { itsmEnabled };
