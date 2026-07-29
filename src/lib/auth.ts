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

// Guarda anti-loop: garante que o redirect interativo de login dispare NO MÁXIMO uma vez
// por sessão de aba. Se o usuário voltar do Entra sem conta utilizável (raro), a app
// renderiza em demo em vez de entrar em loop de redirect.
const REDIRECT_FLAG = "ts-auth-redirect";

/** Inicializa a MSAL, resolve o retorno de um eventual redirect e GARANTE a sessão:
 *  1) usa a conta em cache/retorno de redirect, se houver;
 *  2) senão tenta SSO silencioso reaproveitando a sessão do Entra do navegador;
 *  3) senão dispara um redirect ÚNICO para o login (SSO) — é o que faltava para "logar
 *     automático / cair no SSO". Idempotente. No-op quando auth está desligado (preview). */
export async function initAuth(): Promise<void> {
  if (!authEnabled) return;
  if (!initPromise) {
    initPromise = (async () => {
      const app = instance();
      await app.initialize();

      let acct: AccountInfo | null = null;
      try {
        const res = await app.handleRedirectPromise();
        acct = res?.account ?? app.getAllAccounts()[0] ?? null;
      } catch {
        // Falha ao completar o retorno do redirect — segue com o que houver em cache.
        acct = app.getAllAccounts()[0] ?? null;
      }

      if (!acct) {
        // Sem conta: tenta troca SILENCIOSA (zero UI) usando a sessão do Entra já ativa
        // no navegador corporativo.
        try {
          const r = await app.ssoSilent({ scopes: LOGIN_SCOPES });
          acct = r.account ?? null;
        } catch {
          // Silent não foi possível (ex.: iframe bloqueado por cookie de terceiro, ou
          // nenhuma sessão) → login INTERATIVO via redirect. Qualquer erro aqui cai no
          // redirect, não só InteractionRequiredAuthError — era essa a causa do "não redireciona".
          if (sessionStorage.getItem(REDIRECT_FLAG) !== "1") {
            sessionStorage.setItem(REDIRECT_FLAG, "1");
            await app.loginRedirect({ scopes: LOGIN_SCOPES }); // navega para fora
            return;
          }
        }
      }

      if (acct) {
        app.setActiveAccount(acct);
        sessionStorage.removeItem(REDIRECT_FLAG);
      }
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
  // Sem conta aqui = initAuth já disparou o redirect (ou o guardou). Não bloqueia a UI.
  if (!account) return null;
  try {
    const result: AuthenticationResult = await app.acquireTokenSilent({
      scopes: LOGIN_SCOPES,
      account,
    });
    return result.idToken ?? null;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      // Token expirado e sem renovação silenciosa → redirect único para reautenticar.
      await app.acquireTokenRedirect({ scopes: LOGIN_SCOPES, account });
      return null; // navega para fora; retorno não chega a ser usado
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
