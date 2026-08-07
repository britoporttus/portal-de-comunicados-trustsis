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

// CONFIGURAÇÃO EM RUNTIME (não mais embutida no build).
//
// Antes o clientId/tenantId vinham de VITE_ENTRA_* — ou seja, ficavam CONGELADOS no bundle
// no momento do `npm run build`, e trocar o registro de app exigia rebuild + redeploy.
// Agora o front PERGUNTA ao backend (`GET /api/config/auth`, rota pública que existe
// justamente para ser lida antes de haver token), e o backend responde a configuração que
// o admin salvou na tela de Administração. As envs VITE_* seguem apenas como FALLBACK,
// para um bundle antigo continuar funcionando se a rota não existir no servidor.
interface ConfigAuth {
  authEnabled: boolean;
  clientId: string;
  tenantId: string;
  /** Barreira ligada no backend: sem login o portal não deve cair em modo demo. */
  authRequired: boolean;
}

const ENV_FALLBACK: ConfigAuth = {
  clientId: (import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined) ?? "",
  tenantId: (import.meta.env.VITE_ENTRA_TENANT_ID as string | undefined) ?? "",
  get authEnabled() {
    return Boolean(this.clientId && this.tenantId);
  },
  authRequired: false,
};

let cfg: ConfigAuth | null = null;
let cfgPromise: Promise<ConfigAuth> | null = null;

/** Carrega (uma vez) a configuração de SSO do backend. Chamado por initAuth antes de
 *  qualquer uso da MSAL — e o main.tsx aguarda initAuth ANTES de renderizar, então a UI
 *  nunca lê uma configuração pela metade. */
export function carregarConfigAuth(): Promise<ConfigAuth> {
  if (!cfgPromise) {
    cfgPromise = (async () => {
      try {
        const r = await fetch("/api/config/auth");
        if (!r.ok) throw new Error(String(r.status));
        const c = (await r.json()) as ConfigAuth;
        cfg = {
          authEnabled: Boolean(c.authEnabled && c.clientId && c.tenantId),
          clientId: c.clientId ?? "",
          tenantId: c.tenantId ?? "",
          authRequired: Boolean(c.authRequired),
        };
      } catch {
        // Backend antigo/indisponível: usa o que veio no build (compatibilidade).
        cfg = { ...ENV_FALLBACK, authEnabled: ENV_FALLBACK.authEnabled };
      }
      return cfg;
    })();
  }
  return cfgPromise;
}

/** Auth está ligado? (válido após carregarConfigAuth — garantido pelo main.tsx). */
export function authAtivo(): boolean {
  return Boolean(cfg?.authEnabled);
}

/** A barreira do backend exige login? (usado para não exibir dados de demo em produção.) */
export function authObrigatorio(): boolean {
  return Boolean(cfg?.authRequired);
}

function clientIdAtual(): string {
  return cfg?.clientId ?? "";
}

function tenantAtual(): string {
  return cfg?.tenantId ?? "";
}

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
  const tenant = tenantAtual();
  if (!isSpecificTenant(tenant)) return all;
  const doTenant = all.filter((a) => a.tenantId?.toLowerCase() === tenant.toLowerCase());
  return doTenant.length ? doTenant : all;
}

/** Uma conta é aceitável se o tenant não é específico OU ela é do tenant certo. */
function isAllowedTenant(a: AccountInfo | null | undefined): boolean {
  if (!a) return false;
  const tenant = tenantAtual();
  if (!isSpecificTenant(tenant)) return true;
  return a.tenantId?.toLowerCase() === tenant.toLowerCase();
}

/** O portal está EMBUTIDO num iframe? (é o caso do preview do Hive, que renderiza o app
 *  dentro do painel.) Isso muda tudo no login: `login.microsoftonline.com` recusa ser
 *  carregado em iframe (X-Frame-Options), então NENHUM fluxo interativo da MSAL funciona
 *  aqui — nem redirect (mataria o frame) nem popup (a resposta não volta pelo armazenamento
 *  particionado do iframe, além de ser uma experiência ruim).
 *
 *  Por isso, EMBUTIDO o MSAL fica totalmente INERTE e o portal usa IDENTIFICAÇÃO por
 *  seleção: o backend lista os usuários reais do Entra (Graph app-only, credenciais da tela
 *  de Administração) e o usuário do preview escolhe quem é. Ver src/lib/identidade.ts. */
export function emIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin ao ler window.top = estamos embutidos
  }
}

let pca: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

function instance(): PublicClientApplication {
  if (!pca) {
    pca = new PublicClientApplication({
      auth: {
        clientId: clientIdAtual(),
        authority: `https://login.microsoftonline.com/${tenantAtual()}`,
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

// TRAVA DE LOOP DE REAUTENTICAÇÃO. Quando a renovação silenciosa falha, o caminho normal é
// reautenticar por redirect — mas se ela falhar SEMPRE (o caso do iframe de renovação que
// não conseguia responder), o portal entra em ping-pong com o Entra: entra, pisca a tela e
// volta pro seletor de conta, indefinidamente. Contamos as falhas na ABA: passado o limite,
// paramos de redirecionar e deixamos o gate/portal na tela — o usuário decide (botão
// "Entrar"), em vez de ficar refém do loop.
const FALHAS_FLAG = "ts-auth-falhas";
const MAX_FALHAS_SILENT = 2;

function registrarFalhaDeToken(): number {
  const n = Number(sessionStorage.getItem(FALHAS_FLAG) ?? 0) + 1;
  sessionStorage.setItem(FALHAS_FLAG, String(n));
  return n;
}

function limparFalhasDeToken(): void {
  sessionStorage.removeItem(FALHAS_FLAG);
}

// Limpa o estado `interaction.status` da MSAL que pode ter ficado PRESO. Esse é o
// segundo bug do Edge corporativo que RESTAURA abas: a MSAL grava um
// `msal.<clientId>.interaction.status = "interaction_in_progress"` no storage enquanto
// um redirect/login está em andamento e só o limpa quando o retorno completa limpo. Se
// a aba do Entra é fechada no meio (ou o retorno não completa) E o navegador restaura o
// storage entre reinícios, essa chave fica presa → o PRÓXIMO loginRedirect lança
// `BrowserAuthError: interaction_in_progress` e NÃO navega → o usuário fica sem login e
// sem SSO (a tela de "Modo demo"/gate nunca avança). Chamamos isto ANTES de um login
// novo (nunca durante o retorno de um redirect), quando qualquer status pendente é
// comprovadamente lixo (não há conta e vamos começar um fluxo do zero).
function clearStaleInteraction(): void {
  try {
    for (const store of [sessionStorage, localStorage]) {
      const doomed: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k && k.includes("interaction.status")) doomed.push(k);
      }
      doomed.forEach((k) => store.removeItem(k));
    }
  } catch {
    /* storage indisponível — ignorar */
  }
}

/** Dispara o loginRedirect de forma robusta: se a MSAL recusar por um
 *  `interaction_in_progress` preso, limpa o estado e tenta UMA vez mais. Em condições
 *  normais o primeiro loginRedirect já NAVEGA para fora e o catch nem roda. */
async function robustLoginRedirect(app: PublicClientApplication): Promise<void> {
  try {
    await app.loginRedirect({ scopes: LOGIN_SCOPES, prompt: "select_account" });
  } catch {
    clearStaleInteraction();
    await app
      .loginRedirect({ scopes: LOGIN_SCOPES, prompt: "select_account" })
      .catch(() => {
        /* segue: o gate mostra o botão de tentar de novo */
      });
  }
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
  // Descobre COMO autenticar antes de qualquer coisa (rota pública do backend).
  await carregarConfigAuth();
  if (!authAtivo()) return;
  // EMBUTIDO (preview do Hive): MSAL inerte — nenhum redirect, nenhum popup, nenhum iframe
  // de renovação. A identidade vem da seleção de usuário (src/lib/identidade.ts) e o portal
  // abre DIRETO na home, como antes.
  if (emIframe()) return;
  if (!initPromise) {
    initPromise = (async () => {
      const app = instance();
      await app.initialize();

      // 1) Retorno de redirect (ou conta em cache/localStorage de uma visita anterior).
      //    SEMPRE preferindo a conta do tenant configurado (evita a conta do outro
      //    tenant corporativo — ex.: @porttus.com — quando o usuário tem 2 contas).
      let acct: AccountInfo | null;
      try {
        const res = await app.handleRedirectPromise();
        const doRedirect = isAllowedTenant(res?.account) ? res!.account : null;
        // Login novo concluído agora: zera a trava de loop (a contagem anterior era de uma
        // sessão que já morreu).
        if (doRedirect) limparFalhasDeToken();
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
        clearStaleInteraction(); // não há conta → qualquer status pendente é lixo
        markRedirect();
        await robustLoginRedirect(app); // navega para fora
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
  await initAuth();
  if (!authAtivo()) return null;
  if (emIframe()) return null; // preview: identidade por seleção, não por token
  const app = instance();
  const account = activeAccount();
  // Sem conta aqui = initAuth já disparou o redirect (ou o guardou). Não bloqueia a UI.
  if (!account) return null;
  try {
    const result: AuthenticationResult = await app.acquireTokenSilent({
      scopes: LOGIN_SCOPES,
      account,
    });
    limparFalhasDeToken();
    return result.idToken ?? null;
  } catch {
    // QUALQUER falha do silent (token expirado, iframe de renovação bloqueado por
    // cookie de terceiro / block_iframe_reload, etc.) → reautenticar por redirect
    // ÚNICO. Nunca condicionar a `instanceof InteractionRequiredAuthError`: no
    // fluxo silent-first o erro real quase nunca é esse tipo exato.
    // Embutido (preview): não há redirect possível — devolve null e o gate reaparece
    // para o usuário reautenticar por popup (com gesto).
    if (emIframe()) return null;
    // Falhou de novo e de novo? Não redireciona mais — senão o portal fica em ping-pong com
    // a tela de seleção de conta da Microsoft (ver TRAVA DE LOOP acima).
    if (registrarFalhaDeToken() > MAX_FALHAS_SILENT) return null;
    if (!redirectInFlight()) {
      clearStaleInteraction();
      markRedirect();
      try {
        await app.acquireTokenRedirect({ scopes: LOGIN_SCOPES, account });
      } catch {
        clearStaleInteraction();
        await app.acquireTokenRedirect({ scopes: LOGIN_SCOPES, account }).catch(() => {});
      }
    }
    return null; // navega para fora; retorno não chega a ser usado
  }
}

/** Login EXPLÍCITO por gesto do usuário (botão do gate de acesso). Diferente do
 *  auto-redirect do initAuth, este IGNORA a janela anti-loop: se o usuário clicou
 *  "Entrar", ele QUER ir pro SSO agora. Limpa qualquer `interaction_in_progress` preso
 *  antes de navegar, então é o caminho à prova de estado-local-corrompido (o cenário do
 *  Edge que restaura abas). No-op quando o SSO não está configurado.
 *
 *  Só existe em ABA PRÓPRIA (produção), via `loginRedirect` — a função navega para fora e o
 *  `true` nunca chega a ser lido. EMBUTIDO (preview) não há login interativo possível: é
 *  no-op, e a identificação acontece pelo seletor de usuário (lib/identidade.ts). */
export async function login(): Promise<boolean> {
  await carregarConfigAuth();
  if (!authAtivo() || emIframe()) return false;
  const app = instance();
  await app.initialize();
  clearStaleInteraction();
  limparFalhasDeToken(); // gesto explícito do usuário: recomeça do zero

  markRedirect();
  await robustLoginRedirect(app);
  return true;
}

/** Conta ativa (para exibir nome/UPN, se necessário). */
export function getAccount(): AccountInfo | null {
  if (!authAtivo()) return null;
  try {
    return activeAccount();
  } catch {
    // MSAL ainda não inicializada (initAuth falhou) — tratamos como "sem sessão".
    return null;
  }
}

/** Há sessão de SSO utilizável AGORA? Usado pelo portal para decidir entre mostrar o
 *  conteúdo (com o usuário autenticado) ou o gate de login. Quando o SSO não está
 *  configurado devolve `true` — nesse cenário não existe login a exigir (modo demo). */
export function temSessao(): boolean {
  if (!authAtivo()) return true;
  // EMBUTIDO (preview): não existe sessão MSAL a exigir — o portal abre direto e a
  // identidade é a escolhida no seletor (ou o usuário padrão). Nunca mostra gate.
  if (emIframe()) return true;
  return Boolean(getAccount());
}

/** Logout explícito (opcional — a barreira normalmente é transparente). */
export async function signOut(): Promise<void> {
  await initAuth();
  if (!authAtivo()) return;
  await initAuth();
  await instance().logoutRedirect();
}
