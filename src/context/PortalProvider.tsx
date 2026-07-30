import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { DEFAULT_BACKGROUND } from "@/lib/backgrounds";
import { DEFAULT_COLOR_THEME, applyColorTheme } from "@/lib/themes";

type Theme = "light" | "dark";

interface PortalState {
  me: Me | null;
  loading: boolean;
  mode: string; // "graph" | "demo"
  isAdmin: boolean; // papel efetivo (respeita "ver como usuário")
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

  return (
    <Ctx.Provider
      value={{ me, loading, mode, isAdmin, verComoUsuario, setVerComoUsuario, theme, toggleTheme, background, setBackground, colorTheme, setColorTheme }}
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
