import crypto from "crypto";
import { env } from "@/lib/env";

const algorithm = "aes-256-gcm";

function getKey() {
  return crypto.createHash("sha256").update(env.APP_ENCRYPTION_KEY).digest();
}

export function encryptSecret(value: string): string {
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

export function decryptSecret(value: string): string {
  if (!value) return "";
  const [iv, tag, encrypted] = value.split(":");
  if (!iv || !tag || !encrypted) return "";
  try {
    const decipher = crypto.createDecipheriv(algorithm, getKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(value: string): string {
  if (!value) return "";
  const visiblePrefix = value.startsWith("sk-") ? "sk-" : value.slice(0, 3);
  const suffix = value.slice(-4);
  return `${visiblePrefix}${"•".repeat(12)}${suffix}`;
}
