// CONFIGURAÇÃO DE INTEGRAÇÃO editável na tela de Administração (SSO / Entra ID, Graph,
// políticas e ITSM) — em vez de ficar presa em `.env` ou hardcoded.
//
// Precedência: STORE (o que o admin salvou na tela) → ENV (bootstrap) → vazio.
//
// Por que o ENV continua existindo: é o BOOTSTRAP. Numa instalação nova (ou na VM de
// produção que já roda com .env), o portal precisa subir e autenticar ANTES de existir
// qualquer coisa salva no store — senão o admin não consegue entrar para configurar.
// Uma vez salvo na tela, o store passa a MANDAR (o .env vira só o valor de partida).
//
// O clientSecret NUNCA sai deste módulo para o cliente: as respostas da API expõem apenas
// `temSecret: boolean` (ver integracaoMascarada).
import { getStore, mutate } from "./store.js";
import type { Integracao } from "./types.js";

/** Valores vindos do ambiente (bootstrap da primeira subida / da VM atual). */
function doEnv(): Integracao {
  return {
    tenantId: process.env.ENTRA_TENANT_ID ?? "",
    clientId: process.env.ENTRA_CLIENT_ID ?? "",
    clientSecret: process.env.ENTRA_CLIENT_SECRET ?? "",
    adminGroupId: process.env.ENTRA_ADMIN_GROUP_ID ?? "",
    demoUserUpn: process.env.DEMO_USER_UPN ?? "",
    politicasShareUrl: process.env.POLITICAS_SHARE_URL ?? "",
    itsmBaseUrl: (process.env.ITSM_BASE_URL ?? "").replace(/\/+$/, ""),
    itsmApiScope: process.env.ITSM_API_SCOPE ?? "",
    itsmTenantSubdomain: process.env.ITSM_TENANT_SUBDOMAIN ?? "trustsis",
    // Barreira de SSO no backend: por padrão segue o env; a tela pode ligar/desligar.
    authRequired: process.env.AUTH_REQUIRED === "true",
  };
}

const CAMPOS_TEXTO = [
  "tenantId", "clientId", "clientSecret", "adminGroupId", "demoUserUpn",
  "politicasShareUrl", "itsmBaseUrl", "itsmApiScope", "itsmTenantSubdomain",
] as const;

/** Configuração EFETIVA: cada campo salvo no store vence o respectivo valor do env. */
export function integracao(): Integracao {
  const env = doEnv();
  const salva = getStore().integracao;
  if (!salva) return env;
  const out: Integracao = { ...env };
  for (const k of CAMPOS_TEXTO) {
    const v = salva[k];
    // String vazia salva = "não configurado" DE PROPÓSITO (o admin apagou o campo).
    if (typeof v === "string") out[k] = k === "itsmBaseUrl" ? v.replace(/\/+$/, "") : v;
  }
  if (typeof salva.authRequired === "boolean") out.authRequired = salva.authRequired;
  return out;
}

/** Graph app-only só liga com as 3 credenciais (tenant + client + secret). */
export function graphAtivo(): boolean {
  const c = integracao();
  return Boolean(c.tenantId && c.clientId && c.clientSecret);
}

/** SSO (login do usuário no front) exige o registro SPA: tenant + client. */
export function ssoConfigurado(): boolean {
  const c = integracao();
  return Boolean(c.tenantId && c.clientId);
}

/** Barreira no backend: só faz sentido com SSO configurado E a barreira ligada.
 *
 *  VÁLVULA DE ESCAPE (aprendido na prática): ligar a barreira pela tela com um SSO que ainda
 *  não funciona TRANCA TODO MUNDO FORA — inclusive o próprio endpoint que salva a configuração
 *  (ele fica atrás da barreira), e a recuperação exigiria editar store.json na mão no servidor.
 *  Por isso `AUTH_REQUIRED=false` EXPLÍCITO no ambiente FORÇA a barreira desligada, vencendo o
 *  store. É a única inversão de precedência do módulo, e existe só para esta flag: dá ao
 *  operador uma saída documentada (ajusta o .env, reinicia) sem mexer nos dados. */
export function barreiraAtiva(): boolean {
  if (process.env.AUTH_REQUIRED === "false") return false;
  return ssoConfigurado() && integracao().authRequired;
}

/** Integração ITSM: URL + escopo + credenciais do app. */
export function itsmAtivo(): boolean {
  const c = integracao();
  return Boolean(c.itsmBaseUrl && c.itsmApiScope && c.tenantId && c.clientId && c.clientSecret);
}

// Ouvintes avisados quando a configuração muda (usados para descartar os clientes MSAL e
// o JWKS já instanciados com as credenciais ANTIGAS — senão o portal seguiria usando o
// tenant anterior até o próximo restart).
const ouvintes: (() => void)[] = [];
export function aoMudarIntegracao(fn: () => void): void {
  ouvintes.push(fn);
}

/** De onde cada campo está vindo (o admin precisa saber se ainda é o .env que manda). */
export function origemDosCampos(): Record<string, "store" | "env" | "vazio"> {
  const env = doEnv();
  const salva = getStore().integracao;
  const out: Record<string, "store" | "env" | "vazio"> = {};
  for (const k of CAMPOS_TEXTO) {
    const noStore = typeof salva?.[k] === "string";
    out[k] = noStore ? "store" : env[k] ? "env" : "vazio";
  }
  out.authRequired = typeof salva?.authRequired === "boolean" ? "store" : "env";
  return out;
}

/** Forma segura para a API: sem o secret, só a informação de que ele existe. */
export function integracaoMascarada() {
  const c = integracao();
  const salva = getStore().integracao;
  return {
    tenantId: c.tenantId,
    clientId: c.clientId,
    temSecret: Boolean(c.clientSecret),
    adminGroupId: c.adminGroupId,
    demoUserUpn: c.demoUserUpn,
    politicasShareUrl: c.politicasShareUrl,
    itsmBaseUrl: c.itsmBaseUrl,
    itsmApiScope: c.itsmApiScope,
    itsmTenantSubdomain: c.itsmTenantSubdomain,
    authRequired: c.authRequired,
    // Estado derivado — o que está de fato ligado agora.
    graphAtivo: graphAtivo(),
    ssoConfigurado: ssoConfigurado(),
    barreiraAtiva: barreiraAtiva(),
    itsmAtivo: itsmAtivo(),
    origem: origemDosCampos(),
    atualizadoEm: salva?.atualizadoEm,
    atualizadoPor: salva?.atualizadoPor,
  };
}

/** Salva o patch enviado pela tela. Campo AUSENTE = não mexe; string vazia = limpa.
 *  `clientSecret` ausente/vazio PRESERVA o segredo atual (a tela nunca o recebe de volta,
 *  então um save sem redigitar não pode apagá-lo). */
export function salvarIntegracao(patch: Record<string, unknown>, porQuem?: string) {
  mutate((s) => {
    const atual: Integracao = { ...(s.integracao ?? ({} as Integracao)) };
    for (const k of CAMPOS_TEXTO) {
      if (!(k in patch)) continue;
      const v = patch[k];
      if (v === undefined || v === null) continue;
      const texto = String(v).trim();
      if (k === "clientSecret") {
        if (texto) atual.clientSecret = texto; // vazio = mantém o que já existe
        continue;
      }
      atual[k] = k === "itsmBaseUrl" ? texto.replace(/\/+$/, "") : texto;
    }
    if (typeof patch.authRequired === "boolean") atual.authRequired = patch.authRequired;
    atual.atualizadoEm = new Date().toISOString();
    if (porQuem) atual.atualizadoPor = porQuem;
    s.integracao = atual;
    return atual;
  });
  // Credenciais podem ter mudado → descarta clientes/JWKS montados com as antigas.
  for (const fn of ouvintes) {
    try {
      fn();
    } catch {
      /* ouvinte não pode derrubar o save */
    }
  }
  return integracaoMascarada();
}
