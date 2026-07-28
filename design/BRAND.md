# Design system — brand kit (profundidade)

> Guia que o **DevB lê ao construir UI**. Não é só "18 cores": é um sistema com **escalas**, tipografia por
> papel, spacing, radii, shadows e motion. Inspirado nos brand kits do Claude design.

## Fontes da verdade
- `design/tokens.json` — as **18 cores semânticas** (light/dark) + raio/fonte. **Editável** na aba Design do
  Hive; o "Aplicar" regenera `design/tokens.css`. É o que você troca pra re-tematizar.
- `design/tokens/foundation.css` — a **PROFUNDIDADE** (escalas + tipografia + spacing + radii + shadows +
  motion). **Autorado/estável** (o Aplicar não toca). É daqui que sai o "nível brand kit".
- `src/index.css` importa os dois e mapeia tudo pra utilitários Tailwind.

## Fundamentos visuais
- **Mono + um acento.** Neutros (escala **ink** 0–950) + **uma primária** (laranja `--primary-500: #f97316`,
  com escala 50–900). O acento é **sinal**, usado com parcimônia — nunca um flood.
- **Primária selecionável** (`--pick-orange|amber|lime|emerald|sky|violet`): trocar `--primary-500` re-tematiza.
- **Dois grounds:** claro (porcelana `--ink-50`) e console escuro (`.dark`).
- **Radii:** controles `--radius-md` (10) · cards `--radius-lg` (14) · painéis `--radius-xl` (20).
- **Bordas** 1px hairline (`--border`). **Shadows** frias, low-spread (`--shadow-sm/md/lg/xl`).
- **Motion:** fades + small rises, sem bounce (`--dur-base` + `--ease-out`).

## Tipografia (por papel)
Família: `--font-sans` / `--font-display` (Inter) · `--font-mono` (Geist Mono, p/ dados/métricas).
Escala (size + use o `--leading-*`/`--fw-*`/`--tracking-*` certo):
`--text-display` 40 · `--text-h1` 32 · `--text-h2` 24 · `--text-h3` 20 · `--text-body` 14 · `--text-sm` 13 ·
`--text-label` 12 · `--text-eyebrow` 11 (uppercase, `--tracking-wider`) · `--text-mono` 13.

## Como USAR (regras pro DevB)
- **Cores:** prefira os tokens semânticos (`bg-background`, `text-foreground`, `bg-primary`, `border-border`)
  pros componentes shadcn. Pra acabamento/realce use as **escalas** (`text-ink-500`, `bg-primary-600`,
  `bg-success/10`, `shadow-lg`). NUNCA chumbe hex — sempre token.
- **Spacing:** use a escala (`--space-*` / utilitários Tailwind `p-4`, `gap-6`). Ritmo de 4px.
- **Tipo:** títulos com `--text-h*` + `--fw-semibold` + `--tracking-tight`; eyebrow/label uppercase +
  `--tracking-wider`; métricas em `--font-mono`.
- **Elevação:** cards `--shadow-md`, popovers/menus `--shadow-lg`, modais `--shadow-xl`.
- **Foco:** anel com `--ring` / `--glow-primary`.
- **Densidade:** editorial, minimalista, big-tech — respiro generoso, hairlines, acento pontual.

## Componentes
shadcn/ui já vem no template (Button, Card, Input, Badge, …) tematizado pelos tokens. Ao criar telas,
componha com eles + as escalas acima. Mantenha consistência: 1 primária, neutros pra estrutura, semânticas
só pra status (success/warning/danger/info).
