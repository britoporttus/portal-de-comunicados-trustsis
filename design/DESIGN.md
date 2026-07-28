DESIGN SYSTEM — "Hive Starter" (modo default: dark). Siga À RISCA p/ consistência visual.

FONTE DA VERDADE: `design/tokens.json`. O app DERIVA o CSS dele em `design/tokens.css` (CSS variables em
:root e .light/.dark). NUNCA hardcode cor/raio/espaçamento fora dos tokens — use sempre var(--token).
Os componentes referenciam os PAPÉIS semânticos abaixo (não cores cruas):

TOKENS SEMÂNTICOS (tema dark; o outro tema é o complementar):
  --background: #1a1a1c
  --foreground: #f4f4f2
  --card: #232326
  --card-foreground: #f4f4f2
  --muted: #2b2b2f
  --muted-foreground: #a6a6a2
  --primary: #f97316
  --primary-foreground: #ffffff
  --secondary: #2b2b2f
  --secondary-foreground: #f4f4f2
  --accent: #33291f
  --accent-foreground: #fb923c
  --border: rgba(255,255,255,0.08)
  --input: #2b2b2f
  --ring: #f97316
  --destructive: #ff8a82
  --success: #5ec98a
  --warning: #e0bd5f

GLOBAIS: fonte sans = Inter, system-ui, -apple-system, sans-serif; mono = ui-monospace, SFMono-Regular, Menlo, monospace; corpo = 13px; escala tipográfica = 1.2;
raio base = 10px; espaçamento base = 4px; sombra = soft.

REGRAS:
- Use o `primary` SÓ pra ação primária e estado ativo (não como fundo de área grande). Texto sobre primary = primary-foreground.
- Superfícies em camadas: background → card → muted. Bordas `border` 1px sutis.
- SEMPRE trate loading (skeleton/spinner), erro (faixa destructive-soft com a mensagem) e vazio (texto muted + ação). Foco visível = ring. Contraste AA.
- Suporte os DOIS temas (light/dark) trocando a classe no <html>; ambos vêm dos tokens.