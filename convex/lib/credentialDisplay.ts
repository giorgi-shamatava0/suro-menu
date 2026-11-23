// Reversible copies are only for the explicitly requested, authenticated admin display.
// Password verification still uses PBKDF2 and signup PIN verification still uses HMAC.
const encoder = new TextEncoder();
async function key() {
  const secret = process.env.LOYALTY_ADMISSION_SECRET;
  if (!secret) return null;
  const material = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(`suro:credential-display:v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
export async function encryptCredential(
  value: string,
  purpose: "staff" | "pin",
) {
  const encryptionKey = await key();
  if (!encryptionKey) return undefined;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(purpose) },
    encryptionKey,
    encoder.encode(value),
  );
  return `v1.${b64(iv)}.${b64(new Uint8Array(ciphertext))}`;
}
export async function decryptCredential(
  value: string | undefined,
  purpose: "staff" | "pin",
) {
  if (!value) return null;
  try {
    const encryptionKey = await key();
    const [version, iv, ciphertext] = value.split(".");
    if (!encryptionKey || version !== "v1" || !iv || !ciphertext) return null;
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: unb64(iv),
        additionalData: encoder.encode(purpose),
      },
      encryptionKey,
      unb64(ciphertext),
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
