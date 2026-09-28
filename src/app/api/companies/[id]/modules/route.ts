import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import { businessModuleCatalog } from "@/modules/business-modules/catalog";
import { listCompanyModules, upsertCompanyModule } from "@/modules/business-modules/module-registry.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

const moduleSchema = z.object({
  moduleKey: z.string().trim().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);
    return NextResponse.json(await listCompanyModules(id));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const guard = await requireCompanyAccess(request, id);
    if (guard.response) return guard.response;
    const parsed = moduleSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const { moduleKey, enabled, config } = parsed.data;
    if (!businessModuleCatalog.some((moduleItem) => moduleItem.key === moduleKey)) return apiError(new Error("Modulo desconhecido"), 400);

    const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);

    await upsertCompanyModule({
      companyId: id,
      moduleKey,
      enabled,
      config,
    });

    return NextResponse.json(await listCompanyModules(id));
  } catch (error) {
    return apiError(error);
  }
}
