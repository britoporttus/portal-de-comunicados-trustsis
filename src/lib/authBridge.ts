/**
 * PONTE DE RESPOSTA DE AUTENTICAÇÃO (redirect bridge do msal-browser v5)
 * ----------------------------------------------------------------------
 * A partir do msal-browser v5 a página carregada no `redirectUri` deixou de ser "só o app":
 * ela é uma PEÇA do protocolo. Sempre que o Entra devolve uma resposta para uma janela
 * AUXILIAR (o popup do login ou o IFRAME oculto de renovação silenciosa), essa página tem de
 * PUBLICAR a resposta crua num `BroadcastChannel` (`broadcastResponseToMainFrame`) — é assim
 * que a janela principal, que guarda o verificador PKCE, conclui o login.
 *
 * Como o nosso `redirectUri` é a própria origem do portal (o endereço já registrado como SPA
 * no App Registration — não queremos exigir um novo cadastro no Azure), quem carrega dentro
 * dessas janelas auxiliares é ESTE app. Sem a ponte:
 *   - o POPUP voltava do Entra, montava o portal de novo e o login nunca concluía;
 *   - o IFRAME de renovação silenciosa nunca respondia → `acquireTokenSilent` falhava →
 *     o app caía no `acquireTokenRedirect` → tela da Microsoft de novo, em LOOP (o "pisca e
 *     volta pro seletor de conta" em produção).
 *
 * O fluxo de REDIRECT em aba própria (produção) continua sendo resolvido por
 * `handleRedirectPromise()` no `initAuth` — nada muda lá.
 */

/** Tipos de interação que a MSAL carimba no `state` da requisição. */
type TipoInteracao = "redirect" | "popup" | "silent" | "none";

/** Parâmetros da resposta de autenticação presentes na URL (hash ou query), se houver. */
function respostaNaUrl(): URLSearchParams | null {
  const partes = [
    window.location.hash.replace(/^#/, ""),
    window.location.search.replace(/^\?/, ""),
  ];
  for (const raw of partes) {
    if (!raw || !raw.includes("state=")) continue;
    const params = new URLSearchParams(raw);
    if (!params.get("state")) continue;
    // Só tratamos como resposta quando há de fato um payload de autenticação.
    if (["code", "error", "id_token", "access_token", "ear_jwe"].some((k) => params.has(k))) {
      return params;
    }
  }
  return null;
}

/** base64url → texto (mesma decodificação que a MSAL usa no `state`). */
function decodificarBase64Url(input: string): string {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  if (s.length % 4 === 2) s += "==";
  else if (s.length % 4 === 3) s += "=";
  const bin = atob(s);
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.codePointAt(0) ?? 0));
}

/**
 * Que tipo de interação originou esta resposta? A MSAL codifica isso no `state`
 * (`base64(JSON).id/meta` + `|` + estado do app), então dá para saber ANTES de tocar na
 * biblioteca se esta janela é um popup/iframe de auth ou o retorno de um redirect normal.
 */
function tipoDeInteracao(state: string): TipoInteracao | null {
  try {
    const bruto = JSON.parse(decodificarBase64Url(state.split("|")[0])) as {
      meta?: { interactionType?: TipoInteracao };
    };
    return bruto?.meta?.interactionType ?? null;
  } catch {
    return null;
  }
}

/**
 * Esta página está dentro do IFRAME OCULTO de renovação silenciosa da MSAL?
 * Ele é criado pela própria biblioteca com `class="msalSilentIframe"` e `allow-same-origin`,
 * então conseguimos ler o elemento pai. Repare que isto NÃO confunde com o iframe do preview
 * do Hive: lá o pai é de outra origem e `window.frameElement` estoura/vem nulo.
 */
function emIframeDaMsal(): boolean {
  try {
    const el = window.frameElement as HTMLElement | null;
    return Boolean(el && el.classList.contains("msalSilentIframe"));
  } catch {
    return false;
  }
}

/**
 * Publica a resposta de autenticação para a janela principal quando ESTA página é o retorno
 * do Entra dentro de uma janela auxiliar (popup do login ou iframe de renovação silenciosa).
 *
 * Retorna `true` quando a página NÃO deve montar o portal — ela é só a ponte (e se fecha
 * sozinha, no caso do popup).
 */
export async function processarRespostaDeAuth(): Promise<boolean> {
  const params = respostaNaUrl();
  if (!params) return false;

  const tipo = tipoDeInteracao(params.get("state") ?? "");

  // Quem decide é o TIPO carimbado no `state` — não o contexto da janela. Isso importa
  // porque o `window.opener` do popup pode ser cortado pela política COOP ao voltar do
  // Entra: mesmo "órfão", o popup precisa publicar a resposta. O contexto só entra como
  // desempate quando o `state` não pôde ser lido.
  const ponte =
    tipo === "popup" ||
    tipo === "silent" ||
    (!tipo && (Boolean(window.opener) || emIframeDaMsal()));

  // Retorno de REDIRECT numa aba de verdade (produção): caminho já validado — quem resolve é
  // o `handleRedirectPromise()` do initAuth. Não mexemos no que funciona.
  if (!ponte) return false;

  try {
    const { broadcastResponseToMainFrame } = await import("@azure/msal-browser/redirect-bridge");
    await broadcastResponseToMainFrame();
    return true;
  } catch (e) {
    // Resposta malformada/expirada: seguimos para o app, que mostra o gate de login.
    console.error("Falha ao processar o retorno da autenticação.", e);
    return false;
  }
}
