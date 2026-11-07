// Encrypts small JSON payloads for storage in cookies (AES-256-GCM).
// GCM also authenticates the data, so a tampered cookie fails to decrypt.
import crypto from "node:crypto";
import { requireEnv } from "../config/config";

// AES-256 needs a 32-byte key. Hashing SESSION_SECRET with SHA-256 always gives exactly 32.
function encryptionKey(): Buffer {
  return crypto.createHash("sha256").update(requireEnv("SESSION_SECRET")).digest();
}

// Returns "iv.tag.ciphertext", each part base64url so it's safe in a cookie.
export function seal(data: unknown): string {
  // The iv is 12 random bytes, new every time, so the same data never encrypts the same way twice.
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  // update() encrypts the text, final() finishes it; together they're the whole ciphertext.
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  // The tag is GCM's checksum: decrypting fails if a single byte was changed.
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    // Wrong key, tampered or malformed cookie: treat as signed out.
    return null;
  }
}
