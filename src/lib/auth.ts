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
  InteractionRequiredAuthError,
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

/** Inicializa a MSAL e resolve o retorno de um eventual redirect de login.
 *  Idempotente e seguro para chamar antes de renderizar o app. No-op se auth desligado. */
export async function initAuth(): Promise<void> {
  if (!authEnabled) return;
  if (!initPromise) {
    initPromise = (async () => {
      const app = instance();
      await app.initialize();
      const res = await app.handleRedirectPromise();
      const acct = res?.account ?? app.getAllAccounts()[0];
      if (acct) app.setActiveAccount(acct);
    })();
  }
  return initPromise;
}

function activeAccount(): AccountInfo | null {
  const app = instance();
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

/** Devolve um idToken válido do usuário logado, de forma SILENCIOSA sempre que possível.
 *  Retorna null quando auth está desligado. Dispara redirect (uma vez) só se a sessão
 *  do Entra não puder ser reaproveitada silenciosamente. */
export async function getAuthToken(): Promise<string | null> {
  if (!authEnabled) return null;
  await initAuth();
  const app = instance();
  const account = activeAccount();
  try {
    let result: AuthenticationResult;
    if (account) {
      result = await app.acquireTokenSilent({ scopes: LOGIN_SCOPES, account });
    } else {
      // Sem conta em cache: tenta SSO silencioso usando a sessão do navegador (sem UI).
      result = await app.ssoSilent({ scopes: LOGIN_SCOPES });
      if (result.account) app.setActiveAccount(result.account);
    }
    return result.idToken ?? null;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      // Sessão não reaproveitável (ex.: nunca logou neste browser) → redirect único.
      await app.acquireTokenRedirect({ scopes: LOGIN_SCOPES, account: account ?? undefined });
      // acquireTokenRedirect navega para fora; o retorno abaixo não chega a ser usado.
      return null;
    }
    throw e;
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
