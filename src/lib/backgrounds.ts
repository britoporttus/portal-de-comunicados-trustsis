// Fundos personalizáveis do portal (estilo "nova guia do Edge" / Windows Spotlight).
// São FOTOS de paisagem (Unsplash) — coloridas e marcantes — com uma cor sólida de
// fallback (aparece na hora, antes da foto carregar ou se a rede falhar).
// O usuário escolhe pelo seletor no topo; a preferência fica no localStorage (ver PortalProvider).
import type { CSSProperties } from "react";
import hero from "@/assets/hero.png";

export interface BackgroundOption {
  id: string;
  label: string;
  /** Estilo aplicado à camada de fundo (fica atrás do conteúdo, com overlay p/ legibilidade). */
  style: CSSProperties;
  /** Miniatura do seletor (mesma "cara" do fundo, em pequeno e mais leve). */
  swatch: CSSProperties;
  /** Véu aplicado por cima: "gradiente" (foto) ou "suave" (cor sólida, deixa a cor aparecer mais). */
  overlay?: "gradiente" | "suave";
}

// Monta uma opção de foto: cor sólida de fallback + imagem em "cover".
// A miniatura pede uma versão pequena (w=240) pra o seletor abrir instantâneo.
function photo(id: string, label: string, url: string, fallback: string): BackgroundOption {
  const full = `${url}?auto=format&fit=crop&w=1920&q=80`;
  const thumb = `${url}?auto=format&fit=crop&w=240&h=160&q=60`;
  return {
    id,
    label,
    style: {
      backgroundColor: fallback,
      backgroundImage: `url("${full}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
    swatch: {
      backgroundColor: fallback,
      backgroundImage: `url("${thumb}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    },
  };
}

export const BACKGROUNDS: BackgroundOption[] = [
  photo("montanha", "Montanha", "https://images.unsplash.com/photo-1754875177745-b09fcb123125", "#8a9096"),
  photo("praia", "Praia", "https://images.unsplash.com/photo-1771002382315-9be24abde4e4", "#17a697"),
  photo("lago", "Lago", "https://images.unsplash.com/photo-1493246507139-91e8fad9978e", "#4b5a63"),
  photo("floresta", "Floresta", "https://images.unsplash.com/photo-1747555843535-76ee0af74b62", "#5f7075"),
  photo("aurora", "Aurora Boreal", "https://images.unsplash.com/photo-1749033133028-7fb64bd38e07", "#1f3b3a"),
  photo("deserto", "Deserto", "https://images.unsplash.com/photo-1760721459088-1a70d26b8ad1", "#8a5a34"),
  photo("flores", "Flores", "https://images.unsplash.com/photo-1758940886501-2eec948ca2c4", "#7c8a63"),
  photo("cidade", "Cidade", "https://images.unsplash.com/photo-1694057441996-5325f274c1c0", "#21373b"),
  {
    id: "trustsis",
    label: "TrustSis",
    style: { backgroundColor: "#0b1220", backgroundImage: `url(${hero})`, backgroundSize: "cover", backgroundPosition: "center" },
    swatch: { backgroundColor: "#0b1220", backgroundImage: `url(${hero})`, backgroundSize: "cover", backgroundPosition: "center" },
  },
  { id: "none", label: "Nenhum", style: {}, swatch: { backgroundColor: "hsl(var(--background))" } },
];

export const DEFAULT_BACKGROUND = "montanha";

// ── Fundos de COR SÓLIDA ────────────────────────────────────────────────────
// Além das fotos, o usuário pode escolher uma cor chapada. O id guardado no
// localStorage é "cor:#rrggbb" — assim a cor personalizada não precisa de uma
// entrada fixa em BACKGROUNDS (é gerada na hora por getBackground).
export const COR_PREFIX = "cor:";

/** Sugestões prontas (a cor personalizada continua livre no seletor). */
export const CORES_SUGERIDAS: { hex: string; label: string }[] = [
  { hex: "#0b1220", label: "Azul-noite" },
  { hex: "#1f2937", label: "Grafite" },
  { hex: "#0f766e", label: "Petróleo" },
  { hex: "#1d4ed8", label: "Azul" },
  { hex: "#4338ca", label: "Índigo" },
  { hex: "#7c3aed", label: "Violeta" },
  { hex: "#be123c", label: "Rubi" },
  { hex: "#c2410c", label: "Laranja" },
  { hex: "#15803d", label: "Verde" },
  { hex: "#a16207", label: "Âmbar" },
  { hex: "#d6d3d1", label: "Areia" },
  { hex: "#f1f5f9", label: "Névoa" },
];

/** Aceita "#rrggbb", "rrggbb" ou "#rgb" e devolve "#rrggbb" minúsculo (null se inválido). */
export function normalizarHex(valor: string): string | null {
  const v = valor.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(v)) return `#${v[0]}${v[0]}${v[1]}${v[1]}${v[2]}${v[2]}`;
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`;
  return null;
}

/** Id de fundo para uma cor ("#2563eb" → "cor:#2563eb"). */
export function corParaId(hex: string): string {
  return COR_PREFIX + (normalizarHex(hex) ?? "#1f2937");
}

/** Extrai a cor de um id de fundo ("cor:#2563eb" → "#2563eb"); null se não for cor. */
export function corDoId(id: string): string | null {
  if (!id.startsWith(COR_PREFIX)) return null;
  return normalizarHex(id.slice(COR_PREFIX.length));
}

function corBackground(hex: string): BackgroundOption {
  const label = CORES_SUGERIDAS.find((c) => c.hex === hex)?.label ?? `Cor ${hex}`;
  return {
    id: COR_PREFIX + hex,
    label,
    style: { backgroundColor: hex },
    swatch: { backgroundColor: hex },
    overlay: "suave",
  };
}

export function getBackground(id: string): BackgroundOption {
  const cor = corDoId(id);
  if (cor) return corBackground(cor);
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
