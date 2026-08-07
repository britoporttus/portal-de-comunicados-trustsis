// Seletor de papel de parede do portal (estilo "nova guia do Edge").
// Duas formas de fundo: FOTOS (paisagens) ou COR sólida (sugestões + cor personalizada).
import { useState } from "react";
import { ImageIcon, Check, Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BACKGROUNDS, CORES_SUGERIDAS, corDoId, corParaId, normalizarHex } from "@/lib/backgrounds";
import { usePortal } from "@/context/PortalProvider";

export function BackgroundPicker() {
  const { background, setBackground } = usePortal();
  const corAtual = corDoId(background);
  // Cor do input "personalizada": a escolhida (se for cor) ou uma base neutra.
  const [corLivre, setCorLivre] = useState(corAtual ?? "#1f2937");

  const aplicarCor = (hex: string) => {
    const norm = normalizarHex(hex);
    if (!norm) return;
    setCorLivre(norm);
    setBackground(corParaId(norm));
  };

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Personalizar fundo" />}>
        <ImageIcon className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-sm font-semibold text-foreground">Papel de parede</p>
        <div className="grid grid-cols-3 gap-2">
          {BACKGROUNDS.map((b) => {
            const ativo = b.id === background;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => setBackground(b.id)}
                aria-label={b.label}
                aria-pressed={ativo}
                title={b.label}
                className={cn(
                  "relative flex h-14 items-end justify-start overflow-hidden rounded-lg border p-1 text-[10px] font-medium text-white transition-all",
                  ativo ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50",
                )}
                style={b.swatch}
              >
                <span className="rounded bg-black/40 px-1 leading-tight backdrop-blur-sm">{b.label}</span>
                {ativo && (
                  <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-sm font-semibold text-foreground">Cor sólida</p>
          <div className="grid grid-cols-6 gap-2">
            {CORES_SUGERIDAS.map((c) => {
              const ativo = corAtual === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => aplicarCor(c.hex)}
                  aria-label={c.label}
                  aria-pressed={ativo}
                  title={c.label}
                  className={cn(
                    "relative flex size-8 items-center justify-center rounded-md border transition-all",
                    ativo ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50",
                  )}
                  style={{ backgroundColor: c.hex }}
                >
                  {ativo && <Check className="size-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
                </button>
              );
            })}
          </div>

          <label
            className="mt-3 flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50"
            title="Escolher uma cor personalizada"
          >
            <Pipette className="size-4 shrink-0" />
            <span className="flex-1">Cor personalizada</span>
            <span
              className="size-5 shrink-0 rounded border border-border"
              style={{ backgroundColor: corLivre }}
              aria-hidden
            />
            <input
              type="color"
              value={corLivre}
              onChange={(e) => aplicarCor(e.target.value)}
              className="sr-only"
              aria-label="Cor personalizada do fundo"
            />
          </label>
          <p className="mt-2 text-[11px] leading-tight text-muted-foreground">
            A cor recebe um véu leve do tema para manter os textos legíveis.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
