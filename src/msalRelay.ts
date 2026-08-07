/**
 * PÁGINA DE RELAY DO POPUP DE LOGIN (msal-browser v5 › `auth.popupRelayUri`)
 * --------------------------------------------------------------------------
 * Só entra em cena quando o portal roda EMBUTIDO num iframe de outro site (o preview do
 * Hive). Nesse contexto o navegador PARTICIONA o armazenamento do iframe: o
 * `BroadcastChannel` que o popup de login usa para devolver a resposta vive no balde
 * "top-level" da nossa origem e NUNCA chega ao iframe particionado — resultado: o login
 * concluía na janela da Microsoft e o portal ficava eternamente em "Aguardando o login…".
 *
 * A MSAL resolve isso com uma página de relay: o iframe abre ESTA página como popup
 * top-level (mesma origem, mesmo balde de armazenamento), ela abre a janela da Microsoft,
 * escuta o `BroadcastChannel` da resposta e repassa o payload cru ao iframe por
 * `postMessage`. Nenhum token/segredo cruza janela: o iframe é quem troca o código.
 *
 * Esta página NÃO é um `redirectUri` — não precisa de cadastro no Azure.
 */
import { runPopupRelay } from "@azure/msal-browser/popup-relay";

const aviso = document.getElementById("estado");

try {
  runPopupRelay({ popupWindowAttributes: { popupSize: { width: 520, height: 680 } } });
} catch (e) {
  console.error("Falha ao abrir o login da Microsoft.", e);
  if (aviso) {
    aviso.textContent =
      "Não foi possível abrir a janela de login da Microsoft. Feche esta janela e tente novamente.";
  }
}
