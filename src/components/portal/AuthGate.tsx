import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import logo from "@/assets/logo-trustsis.png";
import { usePortal } from "@/context/PortalProvider";

// Gate de acesso OBRIGATÓRIO (produção com SSO ligado): quando não há usuário
// autenticado, o portal NÃO exibe dados de demo — mostra esta tela que força o login
// pela conta corporativa (Entra/Microsoft). O initAuth já tenta um redirect automático
// na 1ª carga; esta tela é o que aparece se esse redirect foi bloqueado/preso (o cenário
// do Edge corporativo que restaura abas). O botão "Entrar" limpa qualquer estado preso e
// leva ao SSO — é o caminho à prova de estado-local-corrompido.
export default function AuthGate() {
  const { login } = usePortal();
  const [redirecting, setRedirecting] = useState(true);
  const kicked = useRef(false);

  function entrar() {
    setRedirecting(true);
    login(); // navega para o SSO (ou reabre o fluxo)
  }

  // Empurra o SSO automaticamente UMA vez ao montar — se o auto-redirect do initAuth não
  // tiver navegado, este toca de novo. Se mesmo assim não navegar (bloqueio de política,
  // popup/redirect barrado), depois de um instante mostramos o botão manual.
  useEffect(() => {
    if (kicked.current) return;
    kicked.current = true;
    login();
    const t = setTimeout(() => setRedirecting(false), 2500);
    return () => clearTimeout(t);
  }, [login]);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <img
          src={logo}
          alt="TrustSis"
          className="mx-auto mb-6 h-12 w-auto rounded-lg bg-white/95 px-3 py-2 shadow-sm"
        />
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          Acesso restrito
        </h1>
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
            Não foi redirecionado automaticamente? Clique abaixo.
          </p>
        )}

        <Button onClick={entrar} className="mt-4 w-full" size="lg">
          Entrar com a conta Microsoft
        </Button>
      </div>
    </div>
  );
}
