// Fundos personalizáveis do portal (estilo "nova guia do Edge"). São gradientes/meshes
// definidos em CSS — funcionam offline, adaptam-se ao tema e não dependem de rede.
// O usuário escolhe pelo seletor no topo; a preferência fica no localStorage (ver PortalProvider).
import type { CSSProperties } from "react";
import hero from "@/assets/hero.png";

export interface BackgroundOption {
  id: string;
  label: string;
  /** Estilo aplicado à camada de fundo (fica atrás do conteúdo, com overlay p/ legibilidade). */
  style: CSSProperties;
  /** Miniatura do seletor (mesma "cara" do fundo, em pequeno). */
  swatch: CSSProperties;
}

// Cada mesh usa vários radial-gradients sobrepostos — dá a sensação de papel de parede.
const aurora: CSSProperties = {
  backgroundColor: "#0b1220",
  backgroundImage:
    "radial-gradient(60% 60% at 15% 15%, hsl(199 89% 48% / 0.55), transparent 60%)," +
    "radial-gradient(55% 55% at 85% 20%, hsl(160 84% 39% / 0.45), transparent 60%)," +
    "radial-gradient(65% 65% at 70% 90%, hsl(262 83% 58% / 0.45), transparent 60%)",
};
const oceano: CSSProperties = {
  backgroundColor: "#06263a",
  backgroundImage:
    "radial-gradient(70% 60% at 20% 10%, hsl(199 89% 55% / 0.6), transparent 65%)," +
    "radial-gradient(60% 60% at 90% 80%, hsl(210 90% 40% / 0.55), transparent 65%)",
};
const entardecer: CSSProperties = {
  backgroundColor: "#2a0f24",
  backgroundImage:
    "radial-gradient(60% 60% at 10% 20%, hsl(20 90% 55% / 0.55), transparent 62%)," +
    "radial-gradient(60% 60% at 85% 15%, hsl(340 82% 58% / 0.5), transparent 62%)," +
    "radial-gradient(70% 70% at 60% 95%, hsl(275 70% 45% / 0.5), transparent 62%)",
};
const floresta: CSSProperties = {
  backgroundColor: "#08221a",
  backgroundImage:
    "radial-gradient(65% 60% at 15% 15%, hsl(150 70% 45% / 0.55), transparent 62%)," +
    "radial-gradient(60% 60% at 90% 85%, hsl(180 65% 40% / 0.5), transparent 62%)",
};
const grafite: CSSProperties = {
  backgroundColor: "#0e1116",
  backgroundImage:
    "radial-gradient(80% 80% at 50% 0%, hsl(220 15% 30% / 0.7), transparent 70%)," +
    "linear-gradient(180deg, hsl(220 14% 14%), hsl(220 16% 8%))",
};

export const BACKGROUNDS: BackgroundOption[] = [
  { id: "aurora", label: "Aurora", style: aurora, swatch: aurora },
  { id: "oceano", label: "Oceano", style: oceano, swatch: oceano },
  { id: "entardecer", label: "Entardecer", style: entardecer, swatch: entardecer },
  { id: "floresta", label: "Floresta", style: floresta, swatch: floresta },
  { id: "grafite", label: "Grafite", style: grafite, swatch: grafite },
  {
    id: "trustsis",
    label: "TrustSis",
    style: { backgroundImage: `url(${hero})`, backgroundSize: "cover", backgroundPosition: "center" },
    swatch: { backgroundImage: `url(${hero})`, backgroundSize: "cover", backgroundPosition: "center" },
  },
  { id: "none", label: "Nenhum", style: {}, swatch: { backgroundColor: "hsl(var(--background))" } },
];

export const DEFAULT_BACKGROUND = "aurora";

export function getBackground(id: string): BackgroundOption {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
