/**
 * Generates a unique entity id.
 *
 * `crypto.randomUUID` only exists in a secure context (https:// or localhost).
 * Opening the app over plain http on a LAN IP — for example from a phone at
 * http://192.168.0.10:3000 — leaves it undefined, which used to break every
 * "create" action. Fall back to a UUID v4 built from `crypto.getRandomValues`,
 * which is available in insecure contexts too.
 */
export function createId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return randomUuidV4();
}

function randomUuidV4(): string {
  const bytes = new Uint8Array(16);
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // RFC 4122 version 4 + variant bits.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex: string[] = [];
  for (const byte of bytes) hex.push(byte.toString(16).padStart(2, "0"));

  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10, 16).join(""),
  ].join("-");
}
