// Seletor de tema de cor do portal — o usuário final escolhe a paleta de acento.
import { Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { COLOR_THEMES } from "@/lib/themes";
import { usePortal } from "@/context/PortalProvider";

export function ThemePicker() {
  const { colorTheme, setColorTheme } = usePortal();
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Cor do tema" />}>
        <Palette className="size-5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <p className="mb-2 text-sm font-semibold text-foreground">Cor do tema</p>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_THEMES.map((t) => {
            const ativo = t.id === colorTheme;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setColorTheme(t.id)}
                aria-pressed={ativo}
                title={t.label}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                  ativo
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                )}
              >
                <span
                  className="size-5 shrink-0 rounded-full border border-black/10 shadow-sm"
                  style={{ backgroundColor: t.swatch }}
                  aria-hidden
                />
                <span className="flex-1 truncate">{t.label}</span>
                {ativo && <Check className="size-3.5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
        <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
          Combine com o modo claro/escuro no botão ao lado.
        </p>
      </PopoverContent>
    </Popover>
  );
}
