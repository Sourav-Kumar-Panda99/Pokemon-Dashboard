import "server-only";
import { getBackendMode } from "@/lib/backend";
import { decryptSecret, encryptSecret, parseEncryptionKey } from "@/lib/crypto/credentials";
import { getDemoEncryptionKey } from "./demo";

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  if (getBackendMode() === "demo") {
    cachedKey = getDemoEncryptionKey();
    return cachedKey;
  }
  const raw = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!raw) throw new Error("CREDENTIALS_ENCRYPTION_KEY is not configured");
  cachedKey = parseEncryptionKey(raw);
  return cachedKey;
}

export function isEncryptionConfigured(): boolean {
  try {
    getKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptCredential(plaintext: string): string {
  return encryptSecret(plaintext, getKey());
}

export function decryptCredential(ciphertext: string): string {
  return decryptSecret(ciphertext, getKey());
}
