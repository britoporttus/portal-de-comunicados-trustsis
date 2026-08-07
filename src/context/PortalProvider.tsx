import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { authAtivo, login } from "@/lib/auth";
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
  login: () => void; // dispara o SSO por gesto do usuário (botão do gate)
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
  // Com SSO ligado e sem usuário após carregar → precisa logar (força o SSO, sem demo).
  // authAtivo() é resolvido em RUNTIME (o main.tsx aguarda initAuth antes de renderizar),
  // porque a configuração de SSO agora vem do backend e não do build.
  const needsLogin = authAtivo() && !loading && !me;

  return (
    <Ctx.Provider
      value={{ me, loading, mode, needsLogin, login, isAdmin, perfis, paginas, pode, podeVerPagina, verComoUsuario, setVerComoUsuario, theme, toggleTheme, background, setBackground, colorTheme, setColorTheme }}
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
