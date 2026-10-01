// AES-256-GCM encryption for account credentials.
//
// Kept free of Next.js / path-alias imports so the seed and test scripts can
// reuse it directly with Node's built-in TypeScript support.

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const AAD = Buffer.from("go-account-manager:credential:v1");

export const CIPHERTEXT_PATTERN = /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/;

/** Accepts a 32-byte key encoded as 64 hex chars or base64/base64url. */
export function parseEncryptionKey(raw: string): Buffer {
  const value = raw.trim();
  const key = /^[0-9a-fA-F]{64}$/.test(value)
    ? Buffer.from(value, "hex")
    : Buffer.from(value, value.includes("-") || value.includes("_") ? "base64url" : "base64");
  if (key.length !== 32) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return key;
}

export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}

export function encryptSecret(plaintext: string, key: Buffer): string {
  if (plaintext.length === 0) throw new Error("Cannot encrypt an empty secret");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(payload: string, key: Buffer): string {
  if (!CIPHERTEXT_PATTERN.test(payload)) throw new Error("Unrecognised ciphertext format");
  const [, iv, tag, data] = payload.split(":");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, "base64url"));
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}
