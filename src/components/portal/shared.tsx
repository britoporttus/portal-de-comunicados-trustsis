// Componentes/utilitários visuais compartilhados do portal.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Mail, Users, Cloud, Folder, LayoutGrid, LifeBuoy, Link2, Globe, Calendar,
  Video, MapPin, type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORIA_META, PRIORIDADE_META } from "@/lib/format";
import type { Categoria, Prioridade } from "@/lib/types";
import logo from "@/assets/logo-trustsis.png";

const LINK_ICONS: Record<string, LucideIcon> = {
  mail: Mail, users: Users, cloud: Cloud, folder: Folder,
  "layout-grid": LayoutGrid, "life-buoy": LifeBuoy, calendar: Calendar, video: Video,
};

export function iconForLink(key: string): LucideIcon {
  return LINK_ICONS[key] ?? Link2;
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

export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onNavigate}
      aria-label="Página inicial"
      className="flex items-center rounded-lg transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src={logo}
        alt="TrustSis"
        className="h-11 w-auto rounded-lg bg-white/95 px-2.5 py-1.5 shadow-sm"
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
