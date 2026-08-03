// Visualizador de imagem em tela cheia com ZOOM. Abre a partir de uma miniatura (ex.: fotos
// de um comunicado). Controles de +/-/redefinir, e clique na imagem alterna ampliar/ajustar.
// Quando ampliada, a área rola para "passear" pela foto (pan).
import { useEffect, useState } from "react";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MIN = 1;
const MAX = 4;
const STEP = 0.5;

export function Lightbox({
  src,
  alt = "Imagem",
  onClose,
}: {
  src: string | null;
  alt?: string;
  onClose: () => void;
}) {
  const [zoom, setZoom] = useState(1);

  // Sempre reabre/troca a imagem no tamanho "ajustado".
  useEffect(() => {
    setZoom(1);
  }, [src]);

  const clamp = (z: number) => Math.min(MAX, Math.max(MIN, z));
  const mais = () => setZoom((z) => clamp(z + STEP));
  const menos = () => setZoom((z) => clamp(z - STEP));
  const alternar = () => setZoom((z) => (z > 1 ? 1 : 2)); // clique: ajusta ⇄ 2×

  return (
    <Dialog open={!!src} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,72rem)] max-w-none flex-col gap-0 overflow-hidden border-border bg-card p-0">
        <DialogTitle className="sr-only">{alt}</DialogTitle>

        {/* Barra de controles de zoom */}
        <div className="flex items-center justify-center gap-1 border-b border-border px-3 py-2">
          <button
            type="button"
            onClick={menos}
            disabled={zoom <= MIN}
            aria-label="Diminuir zoom"
            className="grid size-8 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <ZoomOut className="size-4" />
          </button>
          <span className="w-14 text-center text-xs font-semibold tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={mais}
            disabled={zoom >= MAX}
            aria-label="Aumentar zoom"
            className="grid size-8 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <ZoomIn className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            disabled={zoom === 1}
            aria-label="Redefinir zoom"
            className="ml-1 grid size-8 place-items-center rounded-md text-foreground transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
          </button>
        </div>

        {/* Área da imagem — rola (pan) quando ampliada além da área visível */}
        <div className="flex-1 overflow-auto p-3" style={{ maxHeight: "80vh" }}>
          {src && (
            <img
              src={src}
              alt={alt}
              draggable={false}
              onClick={alternar}
              className={cn(
                "mx-auto block h-auto select-none rounded-lg transition-[width] duration-150",
                zoom > 1 ? "cursor-zoom-out" : "cursor-zoom-in",
              )}
              style={{ width: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : "none" }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
