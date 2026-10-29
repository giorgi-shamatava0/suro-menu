// PBKDF2-SHA256 via Web Crypto; runs in the Convex runtime and in Node (scripts/hash-password.mjs).
// Stored format: pbkdf2$<iterations>$<salt b64>$<hash b64>
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

export async function hashPassword(password: string, iterations = 300_000) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(await derive(password, salt, iterations))}`;
}

export async function verifyPassword(password: string, stored: string | undefined) {
  const [scheme, it, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "pbkdf2" || !hash) return false;
  const want = unb64(hash);
  const got = await derive(password, unb64(salt), Number(it));
  let diff = want.length ^ got.length;
  for (let i = 0; i < want.length; i++) diff |= want[i] ^ got[i];
  return diff === 0;
}
