import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, Moon, Sun, Search, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { usePortal } from "@/context/PortalProvider";
import { iniciais, saudacao } from "@/lib/format";
import { NAV } from "./nav";
import { Brand } from "./shared";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )
          }
        >
          <item.icon className="size-[18px] shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Brand />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <NavList />
      </div>
      <div className="border-t border-border p-4 text-[11px] text-muted-foreground">
        © {new Date().getFullYear()} TrustSis Consultoria
      </div>
    </aside>
  );
}

export default function AppLayout() {
  const { me, theme, toggleTheme, verComoUsuario, setVerComoUsuario, mode } = usePortal();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4 lg:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navegação</SheetTitle>
              <div className="flex h-16 items-center border-b border-border px-5">
                <Brand />
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

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {me?.isAdmin && (
              <label className="hidden items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground sm:flex">
                <ShieldCheck className="size-3.5 text-primary" />
                Ver como usuário
                <Switch checked={verComoUsuario} onCheckedChange={setVerComoUsuario} />
              </label>
            )}
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <div className="flex items-center gap-2.5 rounded-full border border-border py-1 pl-1 pr-3">
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
            </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {mode === "demo" && (
              <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-xs text-warning">
                <Badge variant="outline" className="border-warning/40 bg-warning/15 text-warning">Modo demo</Badge>
                Exibindo dados de exemplo. Configure as credenciais do Entra ID para carregar dados reais.
              </div>
            )}
            <PageGreeting />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function PageGreeting() {
  const { me } = usePortal();
  const primeiro = me?.nome?.split(" ")[0] ?? "colaborador";
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground lg:text-[28px]">
        {saudacao()}, {primeiro} 👋
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Tudo o que você precisa da TrustSis, em um só lugar.
      </p>
    </div>
  );
}
