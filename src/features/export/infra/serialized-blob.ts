export interface SerializedBlob {
  __autorBlob: "blob";
  mimeType: string;
  dataUrl: string;
}

export function isSerializedBlob(value: unknown): value is SerializedBlob {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).__autorBlob === "blob" &&
    typeof (value as Record<string, unknown>).mimeType === "string" &&
    typeof (value as Record<string, unknown>).dataUrl === "string"
  );
}

export async function serializeBlob(
  blob: Blob | undefined,
): Promise<SerializedBlob | undefined> {
  if (!blob) return undefined;

  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return {
    __autorBlob: "blob",
    mimeType: blob.type,
    dataUrl: `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`,
  };
}

export function deserializeBlob(value: unknown): Blob {
  if (!isSerializedBlob(value)) throw new Error("Arquivo de imagem inválido.");

  const separator = value.dataUrl.indexOf(",");
  const metadata = value.dataUrl.slice(0, separator);
  if (
    separator < 0 ||
    !metadata.startsWith("data:") ||
    !metadata.endsWith(";base64")
  ) {
    throw new Error("Arquivo de imagem inválido.");
  }

  let binary: string;
  try {
    binary = atob(value.dataUrl.slice(separator + 1));
  } catch {
    throw new Error("Arquivo de imagem inválido.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: value.mimeType });
}
