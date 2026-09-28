import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret, maskSecret } from "@/services/encryption.service";

export async function setEncryptedSetting(key: string, value: string) {
  return prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: encryptSecret(value), encrypted: true },
    update: { value: encryptSecret(value), encrypted: true },
  });
}

export async function getSettingValue(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  if (!setting?.value) return "";
  return setting.encrypted ? decryptSecret(setting.value) : setting.value;
}

export async function getMaskedSettingValue(key: string) {
  const value = await getSettingValue(key);
  return value ? maskSecret(value) : "";
}
