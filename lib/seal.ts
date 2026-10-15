// Encrypts small JSON payloads for storage in cookies (AES-256-GCM).
// GCM also authenticates the data, so a tampered cookie fails to decrypt.
import crypto from "node:crypto";
import { requireEnv } from "./config";

function key(): Buffer {
  // Derive a fixed 32-byte key from the SESSION_SECRET env var.
  return crypto.createHash("sha256").update(requireEnv("SESSION_SECRET")).digest();
}

export function seal(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const [iv, tag, ciphertext] = value.split(".").map((s) => Buffer.from(s, "base64url"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    // Wrong key, tampered or malformed cookie: treat as signed out.
    return null;
  }
}
