# Hive Starter — Vite + React + TS + Tailwind + shadcn/ui

Starter padrão dos projetos **frontend** do Hive. Já vem com:

- **Vite + React + TypeScript** (dev server em `0.0.0.0`, pro preview do Hive alcançar).
- **Tailwind v4** (`@tailwindcss/vite`).
- **shadcn/ui — set completo** em `src/components/ui/` (button, card, dialog, input, form, table, tabs, select, sidebar, chart…). **Componha com eles; não recrie primitivos.**
- **Design system do Hive** em `design/`: `tokens.json` (fonte da verdade) -> `tokens.css` (CSS variables) + `DESIGN.md` (guia). O `src/index.css` importa o `tokens.css`, então **trocar o design template no Hive re-tematiza tudo** (cores, raio, fonte). `:root` = claro, `.dark` = escuro.

## Comandos
    npm install
    npm run dev      # http://localhost:5173 (0.0.0.0)
    npm run build

## Como o tema funciona
Os componentes shadcn usam as CSS variables `--background`, `--primary`, `--radius`, etc. — geradas a partir de `design/tokens.json` pelo Hive. Para mudar o visual, **ajuste os tokens** (aba Design no Hive ou aplique um design template); nunca hardcode cor/raio fora deles.

> Curado pelo Hive. O `src/App.tsx` e' so' uma pagina de exemplo — substitua pelo app real.
