/**
 * Password hashing for demo mode: PBKDF2-HMAC-SHA-256 with a random 16-byte salt (WebCrypto).
 * The plain password never leaves this function and is never stored. Real accounts use Supabase Auth
 * (bcrypt on the server); this only keeps the demo honest about how passwords are handled.
 */

export interface PasswordHash {
  algorithm: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  hash: string;
}

const ITERATIONS = 310_000;
const KEY_BITS = 256;

const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, KEY_BITS);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt, ITERATIONS);
  return { algorithm: "PBKDF2-SHA-256", iterations: ITERATIONS, salt: toBase64(salt), hash: toBase64(hash) };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  const hash = await derive(password, fromBase64(stored.salt), stored.iterations);
  const expected = fromBase64(stored.hash);
  if (hash.length !== expected.length) return false;
  // Compare every byte (no early exit).
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= (hash[i] ?? 0) ^ (expected[i] ?? 0);
  return diff === 0;
}

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/** Checks shown live under the password field (brand §2: say what is needed, not what is wrong). */
export function passwordChecks(password: string, context: { email?: string; username?: string } = {}) {
  const lower = password.toLowerCase();
  const personal = [context.email?.split("@")[0], context.username].filter((value): value is string => !!value && value.length >= 3);
  return {
    length: password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX,
    mixed: /[a-zA-Z]/.test(password) && /[^a-zA-Z]/.test(password),
    personal: !personal.some((value) => lower.includes(value.toLowerCase())),
  };
}

export const isStrongEnough = (password: string, context: { email?: string; username?: string } = {}): boolean => {
  const checks = passwordChecks(password, context);
  return checks.length && checks.mixed && checks.personal;
};
