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

export function getBackground(id: string): BackgroundOption {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
