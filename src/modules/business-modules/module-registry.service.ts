import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { buildDefaultModuleConfig, businessModuleCatalog } from "./catalog";

function normalizeConfig(value: unknown): Record<string, string | number | boolean | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string | number | boolean | null] =>
      ["string", "number", "boolean"].includes(typeof entry[1]) || entry[1] === null,
    ),
  );
}

function toPrismaJson(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function listCompanyModules(companyId: string) {
  const existingModules = await prisma.companyModule.findMany({ where: { companyId } });
  const existingByKey = new Map(existingModules.map((module) => [module.moduleKey, module]));

  return businessModuleCatalog.map((definition) => {
    const companyModule = existingByKey.get(definition.key);
    return {
      ...definition,
      enabled: companyModule?.enabled ?? definition.defaultEnabled,
      config: { ...buildDefaultModuleConfig(definition), ...normalizeConfig(companyModule?.config) },
      companyModuleId: companyModule?.id ?? null,
    };
  });
}

export async function isCompanyModuleEnabled(companyId: string, moduleKey: string) {
  const definition = businessModuleCatalog.find((module) => module.key === moduleKey);
  if (!definition) return false;

  const companyModule = await prisma.companyModule.findUnique({
    where: { companyId_moduleKey: { companyId, moduleKey } },
  });
  return companyModule?.enabled ?? definition.defaultEnabled;
}

export async function getCompanyModuleConfig<T extends Record<string, unknown>>(companyId: string, moduleKey: string): Promise<T> {
  const definition = businessModuleCatalog.find((module) => module.key === moduleKey);
  const defaultConfig = definition ? buildDefaultModuleConfig(definition) : {};
  const companyModule = await prisma.companyModule.findUnique({
    where: { companyId_moduleKey: { companyId, moduleKey } },
  });
  return { ...defaultConfig, ...normalizeConfig(companyModule?.config) } as T;
}

export async function upsertCompanyModule(input: {
  companyId: string;
  moduleKey: string;
  enabled: boolean;
  config?: Record<string, unknown>;
}) {
  const definition = businessModuleCatalog.find((module) => module.key === input.moduleKey);
  if (!definition) throw new Error("Modulo desconhecido");

  return prisma.companyModule.upsert({
    where: { companyId_moduleKey: { companyId: input.companyId, moduleKey: input.moduleKey } },
    create: {
      companyId: input.companyId,
      moduleKey: input.moduleKey,
      enabled: input.enabled,
      config: toPrismaJson(input.config ?? buildDefaultModuleConfig(definition)),
    },
    update: {
      enabled: input.enabled,
      config: toPrismaJson(input.config ?? buildDefaultModuleConfig(definition)),
    },
  });
}
