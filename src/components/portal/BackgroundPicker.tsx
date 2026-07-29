// Seletor de papel de parede do portal (estilo "nova guia do Edge").
import { ImageIcon, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { BACKGROUNDS } from "@/lib/backgrounds";
import { usePortal } from "@/context/PortalProvider";

export function BackgroundPicker() {
  const { background, setBackground } = usePortal();
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Personalizar fundo" />}>
        <ImageIcon className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
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
      </PopoverContent>
    </Popover>
  );
}
