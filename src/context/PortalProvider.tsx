import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { authAtivo, emIframe, login, temSessao, trocarConta } from "@/lib/auth";
import type { Acao, Me } from "@/lib/types";
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { DEFAULT_COLOR_THEME, applyColorTheme } from "@/lib/themes";

type Theme = "light" | "dark";

interface PortalState {
  me: Me | null;
  loading: boolean;
  mode: string; // "graph" | "demo"
  // Em produção (SSO ligado) o acesso é OBRIGATÓRIO: se, terminado o carregamento, não
  // há usuário autenticado, o portal NÃO mostra dados de demo — mostra o gate de login
  // que força o SSO. No preview (auth desligado) isto é sempre false.
  needsLogin: boolean;
  /** Dispara o SSO por gesto do usuário (botão do gate). Resolve `true` quando a sessão foi
   *  estabelecida NESTA página (fluxo de popup, usado quando o portal roda embutido);
   *  no fluxo de redirect a página navega para fora antes de o valor ser lido. Rejeita
   *  quando o popup é bloqueado/cancelado — o gate mostra o erro. */
  login: () => Promise<boolean>;
  /** SSO forçando o seletor de contas do Entra ("entrar com outra conta"). */
  trocarConta: () => Promise<boolean>;
  isAdmin: boolean; // papel efetivo (respeita "ver como usuário")
  // RBAC (perfis de acesso do portal): o backend resolve o acesso EFETIVO do usuário
  // (grupos do Entra → perfis → união das permissões) e o front usa para USABILIDADE —
  // esconder menu/ações. A autoridade é sempre o backend (ver server/src/perfis.ts).
  perfis: { id: string; nome: string }[];
  paginas: string[]; // rotas liberadas para este usuário
  pode: (recurso: string, acao: Acao) => boolean;
  podeVerPagina: (rota: string) => boolean;
  verComoUsuario: boolean;
  setVerComoUsuario: (v: boolean) => void;
  theme: Theme;
  toggleTheme: () => void;
  background: string; // id do papel de parede escolhido (ver lib/backgrounds)
  setBackground: (id: string) => void;
  colorTheme: string; // id do tema de cor escolhido (ver lib/themes)
  setColorTheme: (id: string) => void;
}

const Ctx = createContext<PortalState | null>(null);

function applyTheme(t: Theme) {
  document.documentElement.classList.toggle("dark", t === "dark");
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState("demo");
  const [verComoUsuario, setVerComoUsuario] = useState(false);
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem("ts-theme") as Theme) || "dark",
  );
  const [background, setBackgroundState] = useState<string>(
    () => localStorage.getItem("ts-bg") || DEFAULT_BACKGROUND,
  );
  const [colorTheme, setColorThemeState] = useState<string>(
    () => localStorage.getItem("ts-color") || DEFAULT_COLOR_THEME,
  );

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("ts-theme", theme);
  }, [theme]);

  // Aplica a paleta do tema de cor sempre que o tema OU o modo (light/dark) mudar.
  useEffect(() => {
    applyColorTheme(colorTheme, theme);
    localStorage.setItem("ts-color", colorTheme);
  }, [colorTheme, theme]);

  const setBackground = useCallback((id: string) => {
    setBackgroundState(id);
    localStorage.setItem("ts-bg", id);
  }, []);

  const setColorTheme = useCallback((id: string) => {
    setColorThemeState(id);
    localStorage.setItem("ts-color", id);
  }, []);

  // Relê a identidade no backend. No fluxo de REDIRECT isso acontecia de graça (a página
  // recarrega ao voltar do Entra); no fluxo de POPUP — o do preview embutido — a página nunca
  // recarrega, então quem estabelece a sessão precisa pedir a releitura explicitamente.
  const recarregarMe = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([api.me(), api.health()]);
      setMe(m);
      setMode(h.mode);
    } catch {
      /* backend indisponível — segue com o que já temos */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, h] = await Promise.all([api.me(), api.health()]);
        if (!alive) return;
        setMe(m);
        setMode(h.mode);
      } catch {
        /* backend indisponível — segue sem me */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  // Envelopados de propósito: `login` aceita um argumento opcional (`trocar`) e passar a
  // função direto num onClick faria o evento de clique virar esse argumento (truthy) —
  // forçando o seletor de contas sem ninguém pedir.
  //
  // O `await recarregarMe()` é o "caminho pós-login": no redirect ele nunca roda (a página já
  // navegou para fora), no popup é ELE que faz o portal aparecer com o nome do usuário sem F5.
  const entrar = useCallback(async () => {
    const ok = await login();
    if (ok) await recarregarMe();
    return ok;
  }, [recarregarMe]);
  const trocar = useCallback(async () => {
    const ok = await trocarConta();
    if (ok) await recarregarMe();
    return ok;
  }, [recarregarMe]);

  const isAdmin = Boolean(me?.isAdmin) && !verComoUsuario;
  const acesso = me?.acesso;
  const perfis = useMemo(() => acesso?.perfis ?? [], [acesso]);
  // Sem acesso no payload (backend antigo) cai no comportamento anterior: admin vê tudo.
  const paginas = useMemo(() => acesso?.paginas ?? [], [acesso]);

  const pode = useCallback(
    (recurso: string, acao: Acao) => {
      // "Ver como usuário": simula o colaborador comum — nenhuma ação de gestão.
      if (verComoUsuario) return acao === "ver";
      if (!acesso) return Boolean(me?.isAdmin);
      if (acesso.isAdmin) return true;
      return (acesso.permissoes?.[recurso] ?? []).includes(acao);
    },
    [acesso, me?.isAdmin, verComoUsuario],
  );

  const podeVerPagina = useCallback(
    (rota: string) => {
      if (!acesso) return true; // backend sem RBAC: não esconde nada
      if (acesso.isAdmin) return true;
      return paginas.includes(rota);
    },
    [acesso, paginas],
  );
  // VALIDAÇÃO DE IDENTIDADE ANTES DE EXIBIR CONTEÚDO. A página inicial do portal é a HOME
  // (não existe tela de login como porta de entrada), mas ela só aparece se houver um usuário
  // identificado. São dois critérios, um por contexto:
  //
  //  1) BACKEND (vale sempre): `/api/me` devolve `autenticado: false` quando não conseguiu
  //     resolver ninguém de verdade no diretório — sem token e sem a identidade sancionada em
  //     Administração › Integração. Nesse caso NÃO mostramos dados fictícios: mostramos o gate.
  //     (Com o Entra nem configurado o backend responde `origem: "demo"` e `autenticado: true`
  //     — senão uma instalação nova ficaria trancada fora da própria tela de configuração.)
  //
  //  2) ABA PRÓPRIA + SSO ligado: exigimos também a sessão MSAL (`temSessao()`), porque é ali
  //     que o login é possível — é o caminho do Edge/SSO. Dentro do iframe do preview esse
  //     critério é inaplicável (a Microsoft recusa autenticar embutida), então lá vale só o
  //     veredito do backend.
  //
  // authAtivo() é resolvido em RUNTIME (o main.tsx aguarda initAuth antes de renderizar),
  // porque a configuração de SSO agora vem do backend e não do build.
  const identidadeConfirmada = me?.autenticado !== false; // backend antigo (sem o campo) = ok
  const semSessaoNaAba = authAtivo() && !emIframe() && !temSessao();
  const needsLogin = !loading && (!me || !identidadeConfirmada || semSessaoNaAba);

  return (
    <Ctx.Provider
      value={{ me, loading, mode, needsLogin, login: entrar, trocarConta: trocar, isAdmin, perfis, paginas, pode, podeVerPagina, verComoUsuario, setVerComoUsuario, theme, toggleTheme, background, setBackground, colorTheme, setColorTheme }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePortal(): PortalState {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePortal fora do PortalProvider");
  return c;
}
