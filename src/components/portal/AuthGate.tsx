import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import logo from "@/assets/logo-trustsis.png";
import { usePortal } from "@/context/PortalProvider";
import { authAtivo, emIframe } from "@/lib/auth";

// GATE DE ACESSO. A porta de entrada do portal é a HOME — este componente só aparece quando
// não há usuário identificado, e existe justamente para o portal NUNCA exibir conteúdo
// (nem dados de demonstração) para alguém que não foi autenticado.
//
//  - ABA PRÓPRIA (uso normal, Edge): o initAuth já tentou o SSO automático — sem `prompt`,
//    ou seja, entrando com a conta que já está autenticada no navegador. Esta tela dispara de
//    novo ao montar e, se ainda assim nada navegar (política do navegador, estado preso do
//    Edge que restaura abas), oferece o botão manual + "entrar com outra conta".
//
//  - EMBUTIDO em iframe (preview do Hive): a Microsoft recusa autenticar dentro de um quadro
//    embutido — nem redirect, nem popup. Lá a identidade é a ÚNICA sancionada pelo admin em
//    Administração › Integração ("identidade do preview"); se ela não estiver configurada,
//    cai aqui: o caminho é configurá-la ou abrir o portal numa aba de verdade.
export default function AuthGate() {
  const { login, trocarConta, me } = usePortal();
  const embutido = emIframe();
  const ssoLigado = authAtivo();
  // CASO ESPECÍFICO: o token do Entra é VÁLIDO (origem "token"), mas o backend não conseguiu
  // resolver a pessoa no diretório (Graph fora do ar, usuário sem objeto neste tenant). Aqui
  // reautenticar não resolve NADA — mandar o usuário ao SSO de novo só produziria ida e volta.
  // Então a tela para de empurrar login e diz o que realmente está acontecendo.
  const tokenSemDiretorio = me?.origem === "token";
  const podeTentarLogin = !embutido && ssoLigado && !tokenSemDiretorio;
  // Sem SSO configurado não há login a disparar: a tela é informativa (ex.: backend fora do ar).
  const [redirecting, setRedirecting] = useState(podeTentarLogin);
  const [erro, setErro] = useState<string | null>(null);
  const kicked = useRef(false);

  async function entrar(trocar = false) {
    // Embutido: nada de popup — abre o portal numa aba de verdade, onde o SSO funciona.
    if (embutido) {
      window.open(window.location.href, "_blank", "noopener");
      return;
    }
    setErro(null);
    setRedirecting(true);
    try {
      const ok = await (trocar ? trocarConta() : login());
      if (!ok) setRedirecting(false);
    } catch (e) {
      setRedirecting(false);
      setErro(mensagemDeErro(e));
    }
  }

  // Em aba própria, empurra o SSO automaticamente UMA vez ao montar (o auto-redirect do
  // initAuth pode não ter navegado). Embutido, nunca: não há fluxo interativo possível.
  useEffect(() => {
    if (!podeTentarLogin || kicked.current) return;
    kicked.current = true;
    login().catch(() => setErro(null));
    const t = setTimeout(() => setRedirecting(false), 2500);
    return () => clearTimeout(t);
  }, [login, podeTentarLogin]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <img
          src={logo}
          alt="TrustSis"
          className="mx-auto mb-6 h-12 w-auto rounded-lg bg-white/95 px-3 py-2 shadow-sm"
        />
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {tokenSemDiretorio
            ? "Sua conta foi autenticada, mas não localizamos seu usuário no diretório do Entra ID."
            : embutido
              ? "O portal só exibe conteúdo para um usuário identificado."
              : "Entre com sua conta corporativa TrustSis para acessar o portal."}
        </p>

        {redirecting ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Entrando com a conta do navegador…
          </div>
        ) : (
          <p className="mt-6 text-xs text-muted-foreground">
            {tokenSemDiretorio
              ? "Entrar de novo não resolve: quem precisa de ajuste é o cadastro no diretório (ou a leitura do Microsoft Graph pelo portal). Avise o administrador — e tente com outra conta se você tiver mais de uma."
              : embutido
                ? "A autenticação da Microsoft não funciona dentro de um quadro embutido. Abra o portal em uma aba própria para entrar com sua conta — ou defina a identidade do preview em Administração › Integração."
                : ssoLigado
                  ? "Não foi redirecionado automaticamente? Clique abaixo."
                  : "Não foi possível confirmar sua identidade agora. Recarregue a página e, se persistir, avise o administrador do portal."}
          </p>
        )}

        <Button
          onClick={() => (tokenSemDiretorio ? window.location.reload() : entrar())}
          disabled={redirecting && !embutido}
          className="mt-4 w-full"
          size="lg"
        >
          {tokenSemDiretorio
            ? "Tentar de novo"
            : embutido
              ? "Abrir o portal em nova aba"
              : "Entrar com a conta Microsoft"}
        </Button>

        {/* O fluxo normal entra com a conta JÁ autenticada no navegador (Edge). Quem tem mais
            de uma conta corporativa precisa de um caminho explícito para escolher a outra. */}
        {!embutido && ssoLigado && (
          <button
            type="button"
            onClick={() => entrar(true)}
            className="mx-auto mt-3 block text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            Entrar com outra conta
          </button>
        )}

        {/* Diagnóstico do preview: o backend diz POR QUE não identificou ninguém. */}
        {embutido && me?.origem === "nenhuma" && (
          <p className="mt-4 rounded-lg border border-border bg-secondary/40 p-3 text-left text-[11px] leading-snug text-muted-foreground">
            Nenhuma identidade do preview está configurada. Em Administração › Integração,
            informe o UPN (e-mail corporativo) que o portal deve assumir quando roda embutido.
          </p>
        )}

        {erro && (
          <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-left">
            <p className="text-xs text-foreground">{erro}</p>
            {/* Diagnóstico que economiza meia hora: o endereço EXATO que precisa constar
                como URI de redirecionamento (SPA) no registro do app no Entra ID. */}
            <p className="mt-2 break-all text-[11px] text-muted-foreground">
              URI de redirecionamento (SPA) exigida por este endereço:{" "}
              <code className="text-foreground">{window.location.origin}</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Traduz os erros de login que o usuário realmente encontra. */
function mensagemDeErro(e: unknown): string {
  const codigo = String((e as { errorCode?: string })?.errorCode ?? "");
  const texto = String((e as Error)?.message ?? e);
  if (codigo.includes("popup_window_error") || codigo.includes("empty_window_error"))
    return "O navegador bloqueou a janela de login. Permita pop-ups para este endereço e tente de novo.";
  if (codigo.includes("user_cancelled"))
    return "Login cancelado. Se a janela mostrou um erro da Microsoft, o endereço deste portal ainda não está autorizado no registro do aplicativo.";
  return `Não foi possível concluir o login. ${texto}`;
}
