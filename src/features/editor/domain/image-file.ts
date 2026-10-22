/**
 * Converte um File de imagem em dataURL JPEG compactado via canvas.
 *
 * Por que reduzir: cada snapshot de versão (manual/auto) duplica o JSON
 * inteiro do capítulo no IndexedDB — sem downscale, uma foto de 5MB viraria
 * ~7MB por snapshot e encheria a cota do navegador rapidamente.
 */

export const MAX_IMAGE_DIM = 1280;
/** shortcut: 2MB de dataURL após redução cobre ~10MP/qualidade 0.85; revisar só se fotos profissionais entrarem no fluxo */
const MAX_DATA_URL_LENGTH = 2 * 1024 * 1024;

/** Dimensões reduzidas proporcionalmente ao limite (nunca amplia). */
export function fitDimensions(
  width: number,
  height: number,
  maxDim: number = MAX_IMAGE_DIM,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width, height };
  const scale = Math.min(1, maxDim / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function readImageAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo não é uma imagem");
  }
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitDimensions(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível");
  // JPEG não tem alpha: fundo branco evita transparência virando preto.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error("Imagem muito grande mesmo após a redução");
  }
  return dataUrl;
}
