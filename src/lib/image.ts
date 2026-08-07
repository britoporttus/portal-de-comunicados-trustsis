// Redimensiona/comprime uma imagem escolhida pelo usuário para um data URL leve (JPEG),
// evitando estourar o store JSON e o limite do body do backend. Mantém a proporção e
// limita a maior dimensão a `maxDim`. Degrada limpo: se algo falhar, devolve o original.
/**
 * Prepara um LOGO para o data URL guardado no store. Diferente de `comprimirImagem`, aqui a
 * TRANSPARÊNCIA é obrigatória (um logo achatado em JPEG ganharia uma caixa branca na navbar):
 *  - SVG passa direto (é vetor e leve — rasterizar só perderia qualidade);
 *  - o resto é redesenhado em canvas e exportado como PNG, sem preencher o fundo.
 * `maxDim` pequeno de propósito: a navbar mostra o logo com ~36px de altura.
 */
export async function prepararLogo(file: File, maxDim = 512): Promise<string> {
  const original = await lerComoDataURL(file);
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) return original;
  try {
    const img = await carregarImagem(original);
    const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return original;
  }
}

export async function comprimirImagem(file: File, maxDim = 1400, quality = 0.82): Promise<string> {
  const original = await lerComoDataURL(file);
  try {
    const img = await carregarImagem(original);
    const escala = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * escala));
    const h = Math.max(1, Math.round(img.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    // Fundo branco para PNGs com transparência não virarem preto ao exportar em JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return original;
  }
}

function lerComoDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error("Falha ao ler o arquivo"));
    fr.readAsDataURL(file);
  });
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Imagem inválida"));
    i.src = src;
  });
}
