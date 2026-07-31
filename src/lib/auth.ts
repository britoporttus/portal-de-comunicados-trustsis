// Barreira de identidade (SSO silencioso) via MSAL.js — "opção A".
//
// Ativa SOMENTE quando VITE_ENTRA_CLIENT_ID e VITE_ENTRA_TENANT_ID estão definidos
// (build de produção do portal). Sem essas vars — como no preview do Hive — o módulo
// fica INERTE: getAuthToken() devolve null e o portal roda como hoje (demo/graph app-only),
// então nada quebra no preview.
//
// UX: NÃO é login por aba. A 1ª carga tenta uma troca SILENCIOSA (ssoSilent/acquireTokenSilent)
// reaproveitando a sessão do Entra já ativa no Edge corporativo — zero UI se o usuário já está
// logado no tenant. Só cai para redirect (uma única vez) quando não há sessão utilizável.
import {
  PublicClientApplication,
  type AuthenticationResult,
  type AccountInfo,
} from "@azure/msal-browser";

const clientId = (import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined) ?? "";
const tenantId = (import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined) ?? "";

/** Auth só liga quando o registro SPA está configurado (produção). */
export const authEnabled = Boolean(clientId && tenantId);

// Escopos delegados que o registro já consente (login SPA). O idToken resultante
// (aud = clientId, iss = tenant) é o que enviamos ao backend como Bearer.
const LOGIN_SCOPES = ["openid", "profile", "email", "User.Read"];

// tenantId configurado como GUID = tenant ESPECÍFICO (single-tenant). Nesse caso
// filtramos o cache da MSAL para o tenant correto: se o usuário tem 2 contas
// corporativas (ex.: TrustSis + Porttus), o cache pode conter a conta do OUTRO
// tenant e getAllAccounts()[0] acabava escolhendo a errada (@porttus.com).
function isSpecificTenant(t: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t);
}

/** Contas do cache que pertencem ao tenant configurado (fallback: todas). */
function accountsForTenant(app: PublicClientApplication): AccountInfo[] {
  const all = app.getAllAccounts();
  if (!isSpecificTenant(tenantId)) return all;
  const doTenant = all.filter((a) => a.tenantId?.toLowerCase() === tenantId.toLowerCase());
  return doTenant.length ? doTenant : all;
}

/** Uma conta é aceitável se o tenant não é específico OU ela é do tenant certo. */
function isAllowedTenant(a: AccountInfo | null | undefined): boolean {
  if (!a) return false;
  if (!isSpecificTenant(tenantId)) return true;
  return a.tenantId?.toLowerCase() === tenantId.toLowerCase();
}

let pca: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

function instance(): PublicClientApplication {
  if (!pca) {
    pca = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: window.location.origin,
        postLogoutRedirectUri: window.location.origin,
      },
      cache: { cacheLocation: "localStorage" },
    });
  }
  return pca;
}

// Guarda anti-loop COM AUTO-EXPIRAÇÃO: evita disparar dois redirects de login em
// sequência imediata (loop), MAS nunca trava o usuário para sempre. Guardamos o
// INSTANTE do último redirect; passada a janela de cooldown, um novo carregamento
// pode tentar o login de novo.
//
// Bug que isto conserta: antes a flag era um "1" STICKY no sessionStorage. Num Edge
// corporativo que RESTAURA abas ("continuar de onde parei"), o sessionStorage da aba
// restaurada PERSISTE entre reinícios → se um retorno de login não completasse limpo
// UMA vez, a flag ficava "1" eternamente e o initAuth NUNCA mais chamava loginRedirect
// → o portal ficava preso em "Modo demo" só naquele perfil (outro navegador, com
// sessionStorage limpo, logava normal).
const REDIRECT_FLAG = "ts-auth-redirect";
const REDIRECT_COOLDOWN_MS = 15_000;

/** Já disparamos um redirect de login há POUCOS segundos? (janela anti-loop) */
function redirectInFlight(): boolean {
  const ts = Number(sessionStorage.getItem(REDIRECT_FLAG) ?? 0);
  return ts > 0 && Date.now() - ts < REDIRECT_COOLDOWN_MS;
}

/** Marca o instante do redirect que estamos prestes a disparar. */
function markRedirect(): void {
  sessionStorage.setItem(REDIRECT_FLAG, String(Date.now()));
}

/** Inicializa a MSAL, resolve o retorno de um eventual redirect e GARANTE a sessão:
 *  1) resolve o retorno de um redirect (ou usa a conta em cache), se houver;
 *  2) SEM conta → login por REDIRECT ÚNICO (SSO). Com a sessão do Entra já ativa no
 *     Edge corporativo, o bounce por login.microsoftonline.com é TRANSPARENTE (sem tela
 *     de senha) e volta com token. No-op quando auth está desligado (preview).
 *
 *  Por que NÃO usa mais `ssoSilent`: sem `loginHint`, o silent abre um IFRAME que:
 *  (a) leva AADSTS50058 (a sessão do navegador não vai no iframe), e (b) recarrega o
 *  app inteiro no iframe (redirectUri = origin) → `block_iframe_reload`, que suja o
 *  estado `interaction_in_progress` da MSAL e IMPEDE o `loginRedirect` seguinte de
 *  navegar. Resultado: ficava preso em "Modo demo". O redirect direto é o que o usuário
 *  quer (cair no SSO) e é o fluxo robusto. */
export async function initAuth(): Promise<void> {
  if (!authEnabled) return;
  if (!initPromise) {
    initPromise = (async () => {
      const app = instance();
      await app.initialize();

      // 1) Retorno de redirect (ou conta em cache/localStorage de uma visita anterior).
      //    SEMPRE preferindo a conta do tenant configurado (evita a conta do outro
      //    tenant corporativo — ex.: @porttus.com — quando o usuário tem 2 contas).
      let acct: AccountInfo | null = null;
      try {
        const res = await app.handleRedirectPromise();
        const doRedirect = isAllowedTenant(res?.account) ? res!.account : null;
        acct = doRedirect ?? accountsForTenant(app)[0] ?? null;
      } catch {
        acct = accountsForTenant(app)[0] ?? null;
      }

      if (acct) {
        app.setActiveAccount(acct);
        sessionStorage.removeItem(REDIRECT_FLAG);
        return;
      }

      // 2) Sem conta utilizável → login interativo por redirect (uma vez por aba).
      //    `prompt: "select_account"` força o Entra a MOSTRAR o seletor de contas em
      //    vez de reusar silenciosamente a sessão do outro tenant já ativa no navegador
      //    — assim o usuário escolhe a conta TrustSis explicitamente.
      if (!redirectInFlight()) {
        markRedirect();
        await app.loginRedirect({ scopes: LOGIN_SCOPES, prompt: "select_account" }); // navega para fora
      }
    })();
  }
  return initPromise;
}

function activeAccount(): AccountInfo | null {
  const app = instance();
  const active = app.getActiveAccount();
  if (isAllowedTenant(active)) return active;
  return accountsForTenant(app)[0] ?? active ?? null;
}

/** Devolve um idToken válido do usuário logado, de forma SILENCIOSA sempre que possível.
 *  Retorna null quando auth está desligado. Dispara redirect (uma vez) só se a sessão
 *  do Entra não puder ser reaproveitada silenciosamente. */
export async function getAuthToken(): Promise<string | null> {
  if (!authEnabled) return null;
  await initAuth();
  const app = instance();
  const account = activeAccount();
  // Sem conta aqui = initAuth já disparou o redirect (ou o guardou). Não bloqueia a UI.
  if (!account) return null;
  try {
    const result: AuthenticationResult = await app.acquireTokenSilent({
      scopes: LOGIN_SCOPES,
      account,
    });
    return result.idToken ?? null;
  } catch {
    // QUALQUER falha do silent (token expirado, iframe de renovação bloqueado por
    // cookie de terceiro / block_iframe_reload, etc.) → reautenticar por redirect
    // ÚNICO. Nunca condicionar a `instanceof InteractionRequiredAuthError`: no
    // fluxo silent-first o erro real quase nunca é esse tipo exato.
    if (!redirectInFlight()) {
      markRedirect();
      await app.acquireTokenRedirect({ scopes: LOGIN_SCOPES, account });
    }
    return null; // navega para fora; retorno não chega a ser usado
  }
}

/** Conta ativa (para exibir nome/UPN, se necessário). */
export function getAccount(): AccountInfo | null {
  if (!authEnabled) return null;
  return activeAccount();
}

/** Logout explícito (opcional — a barreira normalmente é transparente). */
export async function signOut(): Promise<void> {
  if (!authEnabled) return;
  await initAuth();
  await instance().logoutRedirect();
}
