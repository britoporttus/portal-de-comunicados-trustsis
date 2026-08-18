# Anti-slop — guia de "gosto" pra tirar a cara de IA

> Destilado de três referências da comunidade (Emil Kowalski · *skills*, Paul Bakaus · *impeccable*,
> leon · *taste-skill*) e **adaptado aos nossos tokens** (`tokens.json` + `tokens/foundation.css` +
> `language.json`). O DevB lê este arquivo ao construir/repaginar UI, junto com `BRAND.md` e `language.json`.
> Regra de ouro das três referências: **contenção é superpoder** — menos efeito, mais intenção.

## As 3 referências, em 1 linha cada
- **Emil Kowalski (`skills`)** — *movimento com gosto*: timing/easing corretos. UI < 300ms, `ease-out`
  (nunca `ease-in`), animar só `transform`/`opacity`, feedback no `pointer-down`, cortar animação em ações
  frequentes. → nossa camada de **motion**.
- **Impeccable (Bakaus)** — *detector de "slop"*: catálogo de tells de UI gerada por IA (gradiente
  roxo→azul, cards aninhados, borda colorida grossa, Inter sem contexto, #000/#fff puros, bounce). →
  nossa **checklist de proibições**.
- **Taste-skill (leon)** — *processo antes do código*: inferir o brief, calibrar densidade/movimento,
  mapear pra um design system real (o nosso!), hierarquia tipográfica com escala, uma cor de acento. →
  nosso **processo de decisão**.

## O que o nosso design system JÁ faz certo (não regredir)
Nossa `language.json` já é anti-slop por natureza — mantenha: **mono navy + 1 acento ciano** usado só como
sinal; **hairline 1px** em vez de sombra pesada; **sem bounce**; **cantos arredondados consistentes**;
**um único destaque forte por tela**; densidade editorial. As referências abaixo AFINAM isso, não substituem.

## Proibições (tells de IA — nunca faça)
- **Gradiente roxo→azul / ciano-sobre-escuro genérico** como fundo decorativo. Acento é sinal pontual, não flood.
- **`#000`/`#fff` puros.** Use os tokens (`--background`, `--foreground`) — nossos neutros já são navy-tinted.
- **Card dentro de card.** Separe por espaçamento/tipografia/divisória hairline, não por caixa aninhada.
- **Borda colorida grossa** (2px+) num lado do card — assinatura nº 1 de UI gerada. Use `border-border` 1px.
- **Texto cinza sobre fundo colorido.** Use um tom mais escuro DA própria cor.
- **Bounce/elastic easing.** Nunca. `--ease-out` (`cubic-bezier(0.32,0.72,0,1)` p/ drawers).
- **Raio 24px+ em componente pequeno** (vira "blob"). Controles `--radius-md`(10), cards `--radius-lg`(14),
  painéis `--radius-xl`(20). Pill total só em badge/tag.
- **`transition: all`.** Sempre nomear a propriedade. **Nunca** animar `width/height/margin/padding/top/left`.
- **Ícone grande empilhado acima do título**, eyebrow vago, ALL-CAPS minúsculo decorativo sem função.
- **Em-dash (—) e buzzword de marketing** ("supercharge", "enterprise-grade") em título/label/botão.
- **Sombra "à toa".** Elevação plana por padrão; sombra aparece **em resposta a estado** (hover/ativo/flutuante).
- **Imagem fake** (div estilizada no lugar de imagem). Placeholder com proporção certa, não caixa colorida.

## Movimento (camada Emil, mapeada nos nossos tokens)
- **Teto de 300ms** em UI. Feedback de botão 100–160ms · tooltip/popover 125–200ms · dropdown 150–250ms ·
  modal/drawer 200–500ms. Use `--dur-*`/`--ease-out` da foundation.
- **`ease-out` para entrada/saída**; `ease-in-out` só p/ morph na tela; **nunca `ease-in`**.
- **Animar só `transform` e `opacity`.** Entrada = `opacity:0 → 1` + `scale(0.97→1)` (nunca `scale(0)`).
- **Feedback no `pointer-down`** (`:active` scale 0.97–0.98), não na soltura.
- **Gate por frequência:** ação usada 100+x/dia (atalho, nav) → **sem** animação. Ocasional (modal) → padrão.
- **`@media (prefers-reduced-motion: reduce)`** sempre — reduz/remove motion, preserva compreensão.
- **`@media (hover:hover) and (pointer:fine)`** para efeitos de hover (não dispara em touch).
- Conteúdo **visível por padrão** — não esconder pra revelar com animação.

## Tipografia (camadas Impeccable + taste, nos nossos `--text-*`)
- **Hierarquia com razão ≥1.25x**, sem pular nível (h1→h2→h3). Use `--text-display/h1/h2/h3/body/sm/label/eyebrow`.
- **Tracking por tamanho:** títulos `--tracking-tight` (negativo); eyebrow/label MAIÚSCULA + `--tracking-wider`;
  corpo neutro. **Leading inverso ao tamanho:** título apertado (~1.05–1.2), corpo ~1.5–1.6.
- **Largura de leitura 65–75ch** (máx ~80) em blocos de texto.
- **Inter é a nossa fonte** — ok porque é escolha do brand, não default preguiçoso. Métricas em `--font-mono`.

## Cor & superfície
- **Mono + 1 acento.** Estrutura em neutros navy; ciano só p/ nav ativo, link, ícone ativo, 1 CTA. Status
  (success/warning/destructive) **só** em badge/rótulo.
- Camadas: `background → card → muted`, diferenciadas por **tom de preenchimento + hairline**, não por sombra.
- Contraste **WCAG AA** (4.5:1 corpo, 3:1 texto grande). Foco visível via `--ring`.

## Processo antes de repaginar uma tela (camada taste)
1. **Brief da tela:** o que o usuário vem fazer aqui? (Operar/Ler/Decidir.) Densidade e movimento seguem isso.
2. **Um destaque só.** Escolha o elemento âncora da tela; o resto é estrutura calma.
3. **Mapeie no design system** — componha com `components/ui/*` (shadcn) + tokens; não recrie primitivo.
4. **Passe a checklist de proibições** acima antes de fechar.
5. **Estados:** loading (skeleton), vazio (texto muted + ação), erro (faixa destructive-soft). Sempre os três.

## Checklist de fechamento (rode antes de entregar qualquer tela)
- [ ] Zero item da lista de Proibições presente
- [ ] 1 acento, 1 destaque forte, estrutura em neutros
- [ ] Hierarquia tipográfica com escala (sem pulo de nível), tracking/leading por papel
- [ ] Motion < 300ms, `ease-out`, só transform/opacity, `prefers-reduced-motion` ok
- [ ] Contraste AA · foco visível · raio consistente · hairline (não sombra pesada)
- [ ] Loading + vazio + erro tratados
