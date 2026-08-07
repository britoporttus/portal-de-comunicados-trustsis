/**
 * PÁGINA DE RELAY DO POPUP DE LOGIN (msal-browser v5 › `auth.popupRelayUri`)
 * --------------------------------------------------------------------------
 * Só entra em cena quando o portal roda EMBUTIDO num iframe de outro site (o preview do
 * Hive). Nesse contexto o navegador PARTICIONA o armazenamento do frame: o
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
 *
 * PEGADINHA que derrubou a primeira versão disto (e por isso existe o botão):
 * `runPopupRelay()` abre a janela da Microsoft NA HORA em que é chamado. Chamá-lo direto no
 * carregamento é "popup abrindo popup" SEM gesto do usuário — o bloqueador do navegador
 * costuma barrar, e como a função consome (e limpa) o pedido do hash logo na entrada, não há
 * segunda chance. Então: sondamos se pop-ups estão liberados; se estiverem, seguimos direto;
 * se não, mostramos um botão e chamamos o relay no CLIQUE, que é um gesto legítimo.
 */
import { runPopupRelay } from "@azure/msal-browser/popup-relay";

const aviso = document.getElementById("estado");
const botao = document.getElementById("continuar") as HTMLButtonElement | null;

const OPCOES = { popupWindowAttributes: { popupSize: { width: 520, height: 680 } } };

/** Pop-ups estão liberados nesta janela? Abre e fecha uma janela vazia para descobrir —
 *  assim evitamos gastar a única chamada possível de `runPopupRelay` num popup bloqueado. */
function popupsLiberados(): boolean {
  try {
    const teste = window.open("", "_blank", "width=100,height=100,left=-9999,top=-9999");
    if (!teste || teste.closed) return false;
    teste.close();
    return true;
  } catch {
    return false;
  }
}

function disparar(): void {
  try {
    runPopupRelay(OPCOES);
    if (aviso) aviso.textContent = "Conclua o login na janela da Microsoft.";
    if (botao) botao.style.display = "none";
  } catch (e) {
    console.error("Falha ao abrir o login da Microsoft.", e);
    if (aviso) {
      aviso.textContent =
        "Não foi possível abrir a janela de login da Microsoft. Feche esta janela e tente novamente.";
    }
  }
}

if (popupsLiberados()) {
  disparar();
} else if (botao) {
  if (aviso) aviso.textContent = "Clique para continuar o login com a Microsoft.";
  botao.style.display = "inline-block";
  botao.addEventListener("click", disparar, { once: true });
} else {
  disparar();
}
