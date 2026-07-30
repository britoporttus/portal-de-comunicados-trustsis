// Temas de cor do portal (escolhidos pelo usuário final).
// Cada tema sobrescreve, em tempo de execução, as variáveis CSS de cor para
// light e dark. As variáveis NÃO sobrescritas aqui (destructive/success/warning,
// radius, fontes) continuam vindo de design/tokens.css.
//
// Filosofia (pedido do usuário): cores VIVAS, nada de tons opacos/lavados;
// fundo neutro levemente cinza (não "muito azul") e branco menos estridente,
// deixando o acento de cada tema respirar.

export interface ThemePalette {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  border: string;
  input: string;
  ring: string;
}

export interface ColorTheme {
  id: string;
  label: string;
  /** Cor exibida no seletor (o acento do tema). */
  swatch: string;
  light: ThemePalette;
  dark: ThemePalette;
}

// Neutros base — cinza levemente quente/neutro (sem viés azul) para o branco
// não ficar "esquisito". Cada tema só troca o acento (primary/accent/ring).
const NEUTRAL_LIGHT = {
  background: "#f7f8fa",
  foreground: "#141a22",
  card: "#ffffff",
  cardForeground: "#141a22",
  muted: "#eef0f3",
  mutedForeground: "#5c6572",
  secondary: "#eceef2",
  secondaryForeground: "#141a22",
  border: "rgba(20,26,34,0.10)",
  input: "#ffffff",
};

const NEUTRAL_DARK = {
  background: "#0c1017",
  foreground: "#e9edf3",
  card: "#151a23",
  cardForeground: "#e9edf3",
  muted: "#1c222d",
  mutedForeground: "#98a2b2",
  secondary: "#1c222d",
  secondaryForeground: "#e9edf3",
  border: "rgba(152,162,178,0.14)",
  input: "#1c222d",
};

interface Accent {
  pLight: string;
  pfLight: string;
  aLight: string;
  afLight: string;
  pDark: string;
  pfDark: string;
  aDark: string;
  afDark: string;
}

function mk(id: string, label: string, swatch: string, a: Accent): ColorTheme {
  return {
    id,
    label,
    swatch,
    light: {
      ...NEUTRAL_LIGHT,
      primary: a.pLight,
      primaryForeground: a.pfLight,
      accent: a.aLight,
      accentForeground: a.afLight,
      ring: a.pLight,
    },
    dark: {
      ...NEUTRAL_DARK,
      primary: a.pDark,
      primaryForeground: a.pfDark,
      accent: a.aDark,
      accentForeground: a.afDark,
      ring: a.pDark,
    },
  };
}

export const COLOR_THEMES: ColorTheme[] = [
  mk("ciano", "Ciano TrustSis", "#0891b2", {
    pLight: "#0891b2", pfLight: "#ffffff", aLight: "#dcf3f9", afLight: "#0d6c86",
    pDark: "#22b8d6", pfDark: "#04121a", aDark: "#0f3441", afDark: "#67d3ee",
  }),
  mk("indigo", "Índigo", "#4f46e5", {
    pLight: "#4f46e5", pfLight: "#ffffff", aLight: "#e7e6fd", afLight: "#3d36b6",
    pDark: "#8b87f5", pfDark: "#0b0a1f", aDark: "#282357", afDark: "#bcb8fb",
  }),
  mk("esmeralda", "Esmeralda", "#059669", {
    pLight: "#059669", pfLight: "#ffffff", aLight: "#d6f3e7", afLight: "#046f4d",
    pDark: "#34d399", pfDark: "#04140d", aDark: "#123c2c", afDark: "#6ee7b7",
  }),
  mk("violeta", "Violeta", "#9333ea", {
    pLight: "#9333ea", pfLight: "#ffffff", aLight: "#f0e3fd", afLight: "#7322bd",
    pDark: "#b989f4", pfDark: "#150a20", aDark: "#37235c", afDark: "#d7bafa",
  }),
  mk("laranja", "Laranja", "#ea580c", {
    pLight: "#ea580c", pfLight: "#ffffff", aLight: "#fde6d3", afLight: "#b8450d",
    pDark: "#fb923c", pfDark: "#1c0f04", aDark: "#452710", afDark: "#fbbf6b",
  }),
  mk("rose", "Rosé", "#e11d48", {
    pLight: "#e11d48", pfLight: "#ffffff", aLight: "#fddfe6", afLight: "#b31539",
    pDark: "#fb7185", pfDark: "#1f0810", aDark: "#4b1626", afDark: "#fda4b0",
  }),
  mk("grafite", "Grafite", "#475569", {
    pLight: "#475569", pfLight: "#ffffff", aLight: "#e4e7ee", afLight: "#323f57",
    pDark: "#94a3b8", pfDark: "#0b0f16", aDark: "#262f3d", afDark: "#cbd5e1",
  }),
];

export const DEFAULT_COLOR_THEME = "ciano";

export function getColorTheme(id: string): ColorTheme {
  return COLOR_THEMES.find((t) => t.id === id) ?? COLOR_THEMES[0];
}

const VAR_MAP: Record<keyof ThemePalette, string> = {
  background: "--background",
  foreground: "--foreground",
  card: "--card",
  cardForeground: "--card-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  border: "--border",
  input: "--input",
  ring: "--ring",
};

/** Aplica a paleta do tema como variáveis CSS inline na raiz do documento. */
export function applyColorTheme(id: string, mode: "light" | "dark") {
  const theme = getColorTheme(id);
  const palette = mode === "dark" ? theme.dark : theme.light;
  const root = document.documentElement;
  (Object.keys(VAR_MAP) as (keyof ThemePalette)[]).forEach((k) => {
    root.style.setProperty(VAR_MAP[k], palette[k]);
  });
}
