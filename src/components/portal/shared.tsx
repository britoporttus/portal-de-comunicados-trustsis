// Componentes/utilitários visuais compartilhados do portal.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail, Users, Cloud, Folder, LayoutGrid, LifeBuoy, Link2, Globe, Calendar,
  Video, MapPin, FolderOpen, BookOpen, Megaphone, Presentation, Image, FileArchive,
  Building2, type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePortal } from "@/context/PortalProvider";
import { cn } from "@/lib/utils";
import { CATEGORIA_META, PRIORIDADE_META } from "@/lib/format";
import type { Categoria, Prioridade } from "@/lib/types";
import logoMark from "@/assets/logo-trustsis-mark.png";
import logoWordmark from "@/assets/logo-trustsis-wordmark.png";

const LINK_ICONS: Record<string, LucideIcon> = {
  mail: Mail, users: Users, cloud: Cloud, folder: Folder,
  "layout-grid": LayoutGrid, "life-buoy": LifeBuoy, calendar: Calendar, video: Video,
};

export function iconForLink(key: string): LucideIcon {
  return LINK_ICONS[key] ?? Link2;
}

// Ícones das BIBLIOTECAS de documentos (o admin escolhe um na hora de cadastrar a pasta).
const BIBLIOTECA_ICONS: Record<string, LucideIcon> = {
  folder: FolderOpen, book: BookOpen, marketing: Megaphone, apresentacao: Presentation,
  imagens: Image, arquivo: FileArchive, institucional: Building2,
};

/** Lista de ícones oferecidos no cadastro de uma biblioteca (chave + rótulo em pt-BR). */
export const BIBLIOTECA_ICON_OPCOES: Array<[string, string]> = [
  ["folder", "Pasta"],
  ["book", "Manuais / guias"],
  ["marketing", "Marketing"],
  ["apresentacao", "Apresentações"],
  ["imagens", "Imagens / mídia"],
  ["arquivo", "Arquivos / templates"],
  ["institucional", "Institucional"],
];

export function BibliotecaIcone({ nome, className }: { nome?: string; className?: string }) {
  const Icon = BIBLIOTECA_ICONS[nome ?? ""] ?? FolderOpen;
  return <Icon className={cn("size-5", className)} />;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

// Ícones oficiais de produtos Microsoft. O favicon genérico (google/office.com) devolve
// o logo do Copilot para OneDrive/SharePoint/Office, então mapeamos por palavra-chave.
const ICON8 = (slug: string) => `https://img.icons8.com/color/96/${slug}.png`;
const PRODUTOS: Array<{ re: RegExp; src: string }> = [
  { re: /onedrive/, src: ICON8("microsoft-onedrive-2019") },
  { re: /sharepoint/, src: ICON8("microsoft-sharepoint-2019") },
  { re: /outlook/, src: ICON8("microsoft-outlook-2019") },
  { re: /teams/, src: ICON8("microsoft-teams-2019") },
  { re: /powerbi|power-bi|power bi/, src: ICON8("power-bi") },
  { re: /planner/, src: ICON8("microsoft-planner") },
  { re: /\bword\b/, src: ICON8("microsoft-word-2019") },
  { re: /\bexcel\b/, src: ICON8("microsoft-excel-2019") },
  { re: /powerpoint/, src: ICON8("microsoft-powerpoint-2019") },
  { re: /office|microsoft ?365|\bm365\b/, src: ICON8("microsoft-office-2019") },
];

function produtoIcon(url: string, label?: string): string | undefined {
  const alvo = `${label ?? ""} ${url}`.toLowerCase();
  return PRODUTOS.find((p) => p.re.test(alvo))?.src;
}

/**
 * Ícone de um atalho: para produtos Microsoft conhecidos usa o logo oficial do produto;
 * senão usa o FAVICON real do site; se nada carregar, cai no ícone lucide configurado.
 */
export function LinkIcon({
  url, icon, label, className,
}: { url: string; icon?: string; label?: string; className?: string }) {
  const host = useMemo(() => hostFromUrl(url), [url]);
  const produto = useMemo(() => produtoIcon(url, label), [url, label]);
  const [erro, setErro] = useState(false);
  const Fallback = iconForLink(icon ?? "");

  const src = produto ?? (host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : "");
  if (!src || erro) {
    return <Fallback className={cn("size-5", className)} />;
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setErro(true)}
      className={cn("size-6 rounded", className)}
    />
  );
}

/**
 * Marca do portal. Dois modos:
 *  - PERSONALIZADA: o admin carregou um logo em Administração › Marca (data URL servido pelo
 *    backend). Mostra o logo do menu ABERTO ou o do RECOLHIDO — o recolhido cai no expandido
 *    quando não foi enviado, e vice-versa. Cada um tem ainda uma variante por TEMA: no escuro
 *    usamos o logo "escuro" e, se ele não existir, o do tema claro (e vice-versa).
 *  - PADRÃO (nada carregado): o logo TrustSis embutido no build, dividido em duas partes — os
 *    4 quadrados (mark), sempre visíveis, e o wordmark, que expande/recolhe com animação.
 * Em ambos os casos o PNG é transparente (sem caixa branca).
 */
export function Brand({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
  const { marca, theme } = usePortal();
  // Preferência por tema, com queda para a outra variante: quem só carregou UM logo continua
  // vendo o mesmo nos dois temas (nada quebra para quem já tinha marca configurada).
  const escuro = theme === "dark";
  const primeiro = (...c: (string | undefined)[]) => c.find(Boolean) || "";
  const expandido = escuro
    ? primeiro(marca?.logoExpandidoEscuro, marca?.logoExpandido)
    : primeiro(marca?.logoExpandido, marca?.logoExpandidoEscuro);
  const colapsado = escuro
    ? primeiro(marca?.logoColapsadoEscuro, marca?.logoColapsado)
    : primeiro(marca?.logoColapsado, marca?.logoColapsadoEscuro);

  // Marca configurada: preferimos animar entre as variantes quadrada (recolhido) e horizontal
  // (aberto). Se só existir UMA variante, ela vale para os dois estados (sem cross-fade, mas
  // ainda com a animação de largura/opacidade).
  const aberto = expandido || colapsado;
  const fechado = colapsado || expandido;
  const temMarca = aberto || fechado;

  if (temMarca) {
    return (
      <Link
        to="/"
        onClick={onNavigate}
        aria-label="Página inicial"
        className="flex items-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          // Container de altura fixa; a LARGURA anima entre o quadrado (recolhido) e o horizontal
          // (aberto). As duas variantes ficam empilhadas e fazem cross-fade conforme o estado.
          className={cn(
            "relative block h-9 overflow-hidden transition-[width] duration-300 ease-out",
            collapsed ? "w-9" : "w-[190px]",
          )}
        >
          <img
            src={fechado}
            alt="Logo da empresa"
            className={cn(
              "absolute inset-y-0 left-0 h-9 w-9 object-contain transition-opacity duration-300 ease-out",
              collapsed ? "opacity-100" : "opacity-0",
            )}
          />
          <img
            src={aberto}
            alt="Logo da empresa"
            aria-hidden={collapsed}
            className={cn(
              "absolute inset-y-0 left-0 h-9 w-auto max-w-[190px] object-contain object-left transition-opacity duration-300 ease-out",
              collapsed ? "opacity-0" : "opacity-100",
            )}
          />
        </span>
      </Link>
    );
  }

  return (
    <Link
      to="/"
      onClick={onNavigate}
      aria-label="Página inicial"
      title="TrustSis"
      className="flex items-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img src={logoMark} alt="TrustSis" className="h-9 w-auto shrink-0" />
      <img
        src={logoWordmark}
        alt=""
        aria-hidden
        className={cn(
          "h-9 w-auto origin-left transition-all duration-200 ease-out",
          collapsed ? "ml-0 max-w-0 -translate-x-1 opacity-0" : "ml-2 max-w-[150px] opacity-100",
        )}
      />
    </Link>
  );
}

export function CategoriaBadge({ categoria }: { categoria: Categoria }) {
  const m = CATEGORIA_META[categoria];
  return <Badge variant="outline" className={cn("font-medium", m.className)}>{m.label}</Badge>;
}

export function PrioridadeBadge({ prioridade }: { prioridade: Prioridade }) {
  const m = PRIORIDADE_META[prioridade];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium", m.className)}>
      <span className={cn("size-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

const REDE_META: Record<string, { label: string; className: string }> = {
  linkedin: { label: "in", className: "bg-[#0a66c2] text-white" },
  instagram: { label: "IG", className: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white" },
  facebook: { label: "f", className: "bg-[#1877f2] text-white" },
  youtube: { label: "YT", className: "bg-[#ff0000] text-white" },
};

export function RedeIcon({ rede }: { rede: string }) {
  const m = REDE_META[rede] ?? { label: "?", className: "bg-muted text-muted-foreground" };
  return (
    <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold", m.className)}>
      {m.label}
    </span>
  );
}

export { Globe, MapPin };
