import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, Moon, Sun, Search, ShieldCheck, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { usePortal } from "@/context/PortalProvider";
import { iniciais } from "@/lib/format";
import { getBackground } from "@/lib/backgrounds";
import { NAV } from "./nav";
import { Brand } from "./shared";
import { BackgroundPicker } from "./BackgroundPicker";
import { ThemePicker } from "./ThemePicker";
import { PontosBadge } from "./PontosBadge";
import { WelcomeHero } from "./WelcomeHero";

const MYACCOUNT_URL = "https://myaccount.microsoft.com/";

function NavList({ onNavigate, collapsed }: { onNavigate?: () => void; collapsed?: boolean }) {
  // O menu respeita o RBAC: só entram as páginas liberadas pelos perfis do usuário
  // (itens de admin exigem perfil admin). O backend valida de novo em cada rota.
  const { isAdmin, podeVerPagina } = usePortal();
  const itens = NAV.filter((i) => (i.admin ? isAdmin : podeVerPagina(i.to)));
  return (
    <TooltipProvider delay={0}>
      <nav className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-3")}>
        {itens.map((item) => {
          const link = (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg py-2 text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2" : "px-3",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
            >
              <item.icon className="size-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={item.to}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className={cn("flex h-16 items-center border-b border-border", collapsed ? "justify-center px-2" : "px-5")}>
        <Brand collapsed={collapsed} />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <NavList collapsed={collapsed} />
      </div>
      <div className={cn("border-t border-border p-2", collapsed ? "" : "px-3")}>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          onClick={onToggle}
          className={cn("text-muted-foreground", collapsed ? "mx-auto" : "w-full justify-start gap-2")}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed ? <PanelLeft className="size-4" /> : <><PanelLeftClose className="size-4" /> Recolher</>}
        </Button>
      </div>
    </aside>
  );
}

export default function AppLayout() {
  const { me, theme, toggleTheme, verComoUsuario, setVerComoUsuario, mode, background } = usePortal();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem("ts-sidebar") === "1");
  const pathname = useLocation().pathname;
  const isHome = pathname === "/";
  const bg = getBackground(background);

  useEffect(() => {
    localStorage.setItem("ts-sidebar", collapsed ? "1" : "0");
  }, [collapsed]);

  return (
    <div className={cn("relative isolate flex h-screen overflow-hidden", bg.id === "none" && "bg-background")}>
      {/* Papel de parede global. A raiz cria um stacking context (isolate) e fica transparente
          quando há fundo, para a camada -z-10 ficar ATRÁS do conteúdo mas À FRENTE da raiz
          (senão o bg-background opaco da raiz/body a cobriria e ela não apareceria). */}
      {bg.id !== "none" && (
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0" style={bg.style} />
          {/* Overlay leve: escurece só o suficiente pra legibilidade, deixando a paisagem aparecer.
              Cor sólida usa um véu uniforme e mais fraco — a cor escolhida precisa aparecer. */}
          {bg.overlay === "suave" ? (
            <div className="absolute inset-0 bg-background/45" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-background/45 via-background/55 to-background/80" />
          )}
        </div>
      )}

      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-card px-3 sm:gap-3 sm:px-4 lg:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <div className="flex h-16 items-center border-b border-border px-5">
                <Brand onNavigate={() => setOpen(false)} />
              </div>
              <div className="py-4">
                <NavList onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <form
            className="relative hidden max-w-md flex-1 md:block"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q")?.toString().trim();
              if (q) window.open(`https://www.bing.com/search?q=${encodeURIComponent(q)}`, "_blank", "noopener");
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              type="search"
              placeholder="Buscar na web…"
              className="pl-9"
              aria-label="Buscar na web"
            />
          </form>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            {me?.isAdmin && (
              <label className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground lg:flex">
                <ShieldCheck className="size-3.5 text-primary" />
                Ver como usuário
                <Switch checked={verComoUsuario} onCheckedChange={setVerComoUsuario} />
              </label>
            )}
            <PontosBadge />
            <ThemePicker />
            <BackgroundPicker />
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            {/* Bloco do usuário AUTENTICADO. Não existe mais seletor de "entrar como": a
                identidade vem do SSO (aba própria) ou, no preview embutido, é a única que o
                admin sancionou em Administração › Integração. */}
            <a
              href={MYACCOUNT_URL}
              target="_blank"
              rel="noreferrer"
              title="Minha conta Microsoft"
              className="flex items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <Avatar className="size-8">
                {me?.fotoUrl && <AvatarImage src={me.fotoUrl} alt={me.nome} />}
                <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                  {me ? iniciais(me.nome) : "··"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left leading-tight sm:block">
                <div className="text-xs font-semibold text-foreground">{me?.nome ?? "Colaborador"}</div>
                <div className="max-w-[160px] truncate text-[10px] text-muted-foreground">
                  {me?.cargo ?? "Colaborador"}
                </div>
              </div>
            </a>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          {/* Largura TOTAL: o conteúdo ocupa todo o espaço horizontal disponível ao lado da
              sidebar (sem o antigo teto de max-w-7xl centralizado). */}
          <div className="w-full px-4 py-4 sm:py-4 lg:px-8 lg:py-5">
            {mode === "demo" && (
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
                <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">Modo demo</Badge>
                Exibindo dados de exemplo. Configure as credenciais do Entra ID para carregar dados reais.
              </div>
            )}
            {/* TRANSPARÊNCIA: dentro do preview embutido não há SSO possível, então o portal
                roda com a identidade única definida em Administração › Integração. Deixar isso
                explícito evita confundir esta sessão com um login de verdade. */}
            {me?.origem === "preview" && (
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-2.5 text-xs text-muted-foreground">
                <Badge variant="outline">Identidade do preview</Badge>
                Sem login interativo neste contexto: o portal assume {me.email ?? me.nome},
                a identidade definida em Administração › Integração.
              </div>
            )}
            {isHome && <WelcomeHero />}
            {/* Entrada de conteúdo por rota — camada de movimento (anti-slop): fade + pequeno rise,
                ease-out, <300ms, só transform/opacity. Keyada no pathname para reanimar a cada
                navegação. `motion-safe:` respeita prefers-reduced-motion (sem animação = conteúdo
                já visível). Navegação é frequente, mas o teto de 300ms e o deslocamento mínimo
                mantêm a sensação utilitária, não espetáculo. */}
            <div
              key={pathname}
              className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 ease-out"
            >
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
