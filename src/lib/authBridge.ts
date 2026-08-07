/**
 * PONTE DE RESPOSTA DE AUTENTICAÇÃO (redirect bridge do msal-browser v5)
 * ----------------------------------------------------------------------
 * A partir do msal-browser v5 a janela de POPUP do login não devolve mais o token
 * diretamente para quem a abriu: a página carregada no `redirectUri` precisa PUBLICAR a
 * resposta de volta pelo BroadcastChannel (`broadcastResponseToMainFrame`) e se encerrar.
 *
 * Como o nosso `redirectUri` é a própria origem do portal (o mesmo endereço registrado como
 * SPA no App Registration), quem carrega dentro do popup é ESTE app. Sem a ponte o popup
 * ficava aberto mostrando o portal de novo e o login nunca concluía.
 *
 * Só agimos quando a janela é de fato um POPUP (`window.opener`): o fluxo de REDIRECT
 * (produção, aba própria) continua sendo resolvido por `handleRedirectPromise()` no
 * `initAuth`, exatamente como antes — nada muda lá.
 */

/** true quando a URL atual carrega uma resposta de autenticação do Entra ID. */
function temRespostaDeAuthNaUrl(): boolean {
  const partes = [
    window.location.hash.replace(/^#/, ""),
    window.location.search.replace(/^\?/, ""),
  ];
  return partes.some((raw) => {
    if (!raw || !raw.includes("state=")) return false;
    const params = new URLSearchParams(raw);
    if (!params.get("state")) return false;
    // Só tratamos como resposta quando há de fato um payload de autenticação.
    return ["code", "error", "id_token", "access_token", "ear_jwe"].some((k) => params.has(k));
  });
}

/**
 * Publica a resposta para a janela principal quando ESTA página é o retorno do Entra ID
 * dentro do popup. Retorna `true` quando a página NÃO deve montar o portal (o popup se
 * fecha sozinho depois de publicar).
 */
export async function processarRetornoDePopup(): Promise<boolean> {
  if (!window.opener) return false; // não é popup → fluxo de redirect, segue o baile
  if (!temRespostaDeAuthNaUrl()) return false;
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
