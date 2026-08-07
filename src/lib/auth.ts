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
 *  Por isso, EMBUTIDO o MSAL fica totalmente INERTE e a identidade é decidida pelo BACKEND:
 *  vale a ÚNICA identidade que o administrador sancionou em Administração › Integração
 *  ("identidade do preview"). Ninguém escolhe quem é pela interface — ver server/src/auth.ts
 *  › requireAuth e o campo `autenticado` do /api/me. */
export function emIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // cross-origin ao ler window.top = estamos embutidos
  }
}

let pca: PublicClientApplication | null = null;
let initPromise: Promise<void> | null = null;

// Último idToken CONHECIDO do usuário — capturado do retorno do redirect (handleRedirectPromise)
// ou de um acquireTokenSilent bem-sucedido. Existe por UM motivo central: o getAuthToken NUNCA
// mais dispara um redirect por conta própria. Logo depois do SSO, o primeiro acquireTokenSilent
// às vezes falha (o iframe oculto de renovação não consegue reaproveitar a sessão) — e o código
// antigo, nesse caso, chamava acquireTokenRedirect JÁ DENTRO da 1ª chamada /api/me, navegando
// para o Entra antes mesmo de o portal renderizar. Voltava com token, o silent falhava de novo,
// redirecionava de novo → LOOP (o "vai pra home e volta pro SSO" relatado). Agora, quando o
// silent falha, devolvemos ESTE idToken (recém-obtido no login) e o portal abre normal.
let ultimoIdToken: string | null = null;

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

// ERRO DE CONFIGURAÇÃO DO APP REGISTRATION (redemption cross-origin recusada).
//
// Quando VOLTAMOS do Entra com uma resposta de autenticação (há `code=` na URL) e mesmo
// assim o handleRedirectPromise falha, a causa quase sempre é uma só: a URI deste endereço
// NÃO está registrada como "Single-page application (SPA)" no App Registration — está sob
// "Web" (ou nem está). O Azure só permite a troca code→token cross-origin (a que a MSAL faz
// pelo navegador) para URIs do tipo SPA; sob "Web" ela é recusada (AADSTS9002326 / CORS).
//
// Reautenticar NÃO resolve — só recria o loop "vai pra home e volta pro SSO". Então quando
// detectamos isso, GRAVAMOS um flag: o initAuth para de redirecionar sozinho e o gate
// explica exatamente o que ajustar no Entra (o endereço exato que precisa virar SPA).
const SPA_ERRO_FLAG = "ts-auth-spa-erro";

function marcarErroConfigSpa(): void {
  try {
    sessionStorage.setItem(SPA_ERRO_FLAG, "1");
  } catch {
    /* storage indisponível — ignorar */
  }
}

function limparErroConfigSpa(): void {
  try {
    sessionStorage.removeItem(SPA_ERRO_FLAG);
  } catch {
    /* ignorar */
  }
}

/** Voltamos do Entra com resposta, mas a troca code→token foi recusada? (URI não é SPA no
 *  App Registration.) O gate usa isto para parar de empurrar login e explicar o ajuste. */
export function erroConfigSpa(): boolean {
  try {
    return sessionStorage.getItem(SPA_ERRO_FLAG) === "1";
  } catch {
    return false;
  }
}

/** Havia uma resposta de autenticação na URL atual (retorno do Entra: `code`/`error`/token)?
 *  Capturado ANTES de a MSAL consumir o hash, para sabermos se uma falha do
 *  handleRedirectPromise foi na TROCA code→token (config de SPA) e não um mero cold-start. */
function respostaDeAuthNaUrl(): boolean {
  const alvo = `${window.location.hash} ${window.location.search}`;
  return /[#?&](code|error|id_token|access_token)=/.test(alvo);
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
 *  normais o primeiro loginRedirect já NAVEGA para fora e o catch nem roda.
 *
 *  `prompt` fica UNDEFINED no fluxo normal — e isso é o comportamento pedido: assim o Entra
 *  reaproveita a sessão que o navegador já tem (o Edge corporativo entra com a conta do
 *  Windows/perfil) e o login é TRANSPARENTE, sem tela de seleção. `select_account` só entra
 *  quando o usuário pede explicitamente para trocar de conta (ver `trocarConta`). */
async function robustLoginRedirect(
  app: PublicClientApplication,
  prompt?: "select_account",
): Promise<void> {
  const pedido = { scopes: LOGIN_SCOPES, ...(prompt ? { prompt } : {}) };
  try {
    await app.loginRedirect(pedido);
  } catch {
    clearStaleInteraction();
    await app.loginRedirect(pedido).catch(() => {
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
      // Capturado ANTES de a MSAL consumir a URL: se falhar COM uma resposta presente, a troca
      // code→token foi recusada (URI não registrada como SPA no Entra) — não é cold-start.
      const voltandoDoEntra = respostaDeAuthNaUrl();
      try {
        // navigateToLoginRequestUrl: false → processa o retorno NA PRÓPRIA URL, sem um reload
        // extra. Assim uma falha na troca code→token aparece nesta MESMA carga (senão a MSAL
        // navegava de volta e o erro se perdia entre reloads, virando loop silencioso).
        const res = await app.handleRedirectPromise({ navigateToLoginRequestUrl: false });
        // Guarda o idToken recém-emitido: é ele que o getAuthToken usa se o silent falhar,
        // para a 1ª chamada /api/me logo após o SSO funcionar sem redirecionar de novo.
        if (res?.idToken) ultimoIdToken = res.idToken;
        const doRedirect = isAllowedTenant(res?.account) ? res!.account : null;
        // Login novo concluído agora: zera a trava de loop (a contagem anterior era de uma
        // sessão que já morreu) e qualquer erro de config anterior.
        if (doRedirect) {
          limparFalhasDeToken();
          limparErroConfigSpa();
        }
        acct = doRedirect ?? accountsForTenant(app)[0] ?? null;
      } catch {
        // Falhou logo após voltar do Entra (com resposta na URL) → redemption cross-origin
        // recusada = a URI não está como SPA no App Registration. Marca o erro para o gate
        // explicar, em vez de redirecionar de novo e entrar em loop.
        if (voltandoDoEntra) marcarErroConfigSpa();
        acct = accountsForTenant(app)[0] ?? null;
      }

      if (acct) {
        app.setActiveAccount(acct);
        sessionStorage.removeItem(REDIRECT_FLAG);
        limparErroConfigSpa();
        return;
      }

      // Config de SPA quebrada: não adianta redirecionar (voltaria com o mesmo erro). Deixa o
      // gate na tela com o diagnóstico e o endereço exato a registrar como SPA no Entra.
      if (erroConfigSpa()) return;

      // 2) Sem conta utilizável → redirect ÚNICO para o Entra, SEM `prompt`. É o SSO que o
      //    portal precisa: no Edge corporativo (o navegador oficial da plataforma) a sessão
      //    do usuário já está ativa, então o bounce é transparente — entra com QUEM ESTÁ
      //    AUTENTICADO no navegador, sem tela de escolha. Fora do Edge, o Entra pede a conta
      //    normalmente. Trocar de conta é uma ação EXPLÍCITA (ver `trocarConta`).
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
  if (emIframe()) return null; // preview: identidade vem do backend, não de token
  const app = instance();
  const account = activeAccount();
  // Sem conta aqui = initAuth já disparou (ou guardou) o redirect ÚNICO de entrada. Não
  // bloqueia a UI; devolve o último idToken conhecido se houver.
  if (!account) return ultimoIdToken;
  try {
    const result: AuthenticationResult = await app.acquireTokenSilent({
      scopes: LOGIN_SCOPES,
      account,
    });
    limparFalhasDeToken();
    if (result.idToken) ultimoIdToken = result.idToken;
    return result.idToken ?? ultimoIdToken;
  } catch {
    // O getAuthToken NUNCA redireciona. Antes, uma falha do silent (comum logo após o SSO,
    // quando o iframe oculto de renovação não reaproveita a sessão) disparava
    // acquireTokenRedirect DENTRO da 1ª chamada /api/me → navegava pro Entra, voltava, o
    // silent falhava de novo, redirecionava de novo → LOOP infinito ("vai pra home e volta
    // pro SSO"). Agora devolvemos o idToken recém-obtido no login (ultimoIdToken): a chamada
    // logo após o SSO funciona e o portal abre. Se esse token já expirou (sessão longa), o
    // backend recusa e o portal mostra o gate com botão manual — sem ping-pong com a
    // Microsoft. Um novo redirect só parte do initAuth (entrada a frio) ou de gesto do
    // usuário (login()).
    return ultimoIdToken;
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
 *  no-op, e a identidade é a única sancionada pelo admin (ver server/src/auth.ts).
 *
 *  `trocar` = true força o seletor de contas do Entra (`prompt: select_account`); sem isso o
 *  login segue a conta já autenticada no navegador (SSO do Edge). */
export async function login(trocar = false): Promise<boolean> {
  await carregarConfigAuth();
  if (!authAtivo() || emIframe()) return false;
  const app = instance();
  await app.initialize();
  clearStaleInteraction();
  limparFalhasDeToken(); // gesto explícito do usuário: recomeça do zero
  limparErroConfigSpa(); // pode ter ajustado o registro no Entra: dá outra chance ao SSO

  markRedirect();
  await robustLoginRedirect(app, trocar ? "select_account" : undefined);
  return true;
}

/** "Entrar com outra conta": descarta a conta em cache e manda o usuário ao seletor de contas
 *  do Entra. É a válvula de escape para quem tem mais de uma conta corporativa no mesmo Edge
 *  (ex.: @trustsis.com e um guest @porttus.com) — o fluxo normal entra direto com a conta do
 *  navegador, então trocar tem que ser um gesto deliberado. */
export async function trocarConta(): Promise<boolean> {
  return login(true);
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
  // EMBUTIDO (preview): não existe sessão MSAL possível aqui. Quem valida a identidade é o
  // backend (`/api/me › autenticado`), então este critério não se aplica.
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
