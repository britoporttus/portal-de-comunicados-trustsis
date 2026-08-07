import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import logo from "@/assets/logo-trustsis.png";
import { usePortal } from "@/context/PortalProvider";
import { emIframe } from "@/lib/auth";

// Gate de acesso do portal: enquanto não há sessão do Entra, o portal NÃO exibe dados de
// demonstração — mostra esta tela, que leva ao SSO corporativo.
//
//  - ABA PRÓPRIA (produção): o initAuth já tentou o redirect automático; esta tela dispara
//    de novo ao montar e, se ainda assim nada navegar (política do navegador, estado preso
//    do Edge que restaura abas), oferece o botão manual.
//
//  - EMBUTIDO em iframe (preview do Hive): normalmente esta tela NEM APARECE — lá o portal
//    abre direto na home e a identificação é por seleção de usuário do Entra (ver
//    lib/identidade.ts + IdentidadePicker). Só chega aqui se a BARREIRA do backend estiver
//    ligada, e nesse caso o único caminho é abrir o portal em aba própria: dentro de um
//    iframe o Entra recusa autenticar (nem redirect, nem popup).
export default function AuthGate() {
  const { login } = usePortal();
  const embutido = emIframe();
  const [redirecting, setRedirecting] = useState(!embutido);
  const [erro, setErro] = useState<string | null>(null);
  const kicked = useRef(false);

  async function entrar() {
    // Embutido: nada de popup — abre o portal numa aba de verdade, onde o SSO funciona.
    if (embutido) {
      window.open(window.location.href, "_blank", "noopener");
      return;
    }
    setErro(null);
    setRedirecting(true);
    try {
      const ok = await login();
      if (!ok) setRedirecting(false);
    } catch (e) {
      setRedirecting(false);
      setErro(mensagemDeErro(e));
    }
  }

  // Em aba própria, empurra o SSO automaticamente UMA vez ao montar (o auto-redirect do
  // initAuth pode não ter navegado). Embutido, nunca: popup sem gesto é bloqueado.
  useEffect(() => {
    if (embutido || kicked.current) return;
    kicked.current = true;
    login().catch(() => setErro(null));
    const t = setTimeout(() => setRedirecting(false), 2500);
    return () => clearTimeout(t);
  }, [login, embutido]);

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
          Entre com sua conta corporativa TrustSis para acessar o portal.
        </p>

        {redirecting ? (
          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            Redirecionando para o login…
          </div>
        ) : (
          <p className="mt-6 text-xs text-muted-foreground">
            {embutido
              ? "A autenticação da Microsoft não funciona dentro de um quadro embutido. Abra o portal em uma aba própria para entrar."
              : "Não foi redirecionado automaticamente? Clique abaixo."}
          </p>
        )}

        <Button onClick={entrar} disabled={redirecting && !embutido} className="mt-4 w-full" size="lg">
          {embutido ? "Abrir o portal em nova aba" : "Entrar com a conta Microsoft"}
        </Button>

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
