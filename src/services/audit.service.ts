import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export async function recordAuditEvent(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  companyId?: string | null;
  actorType?: string;
  actorId?: string | null;
  metadata?: Prisma.InputJsonValue;
  request?: Request;
}) {
  const headers = input.request?.headers;
  return prisma.auditLog.create({
    data: {
      actorType: input.actorType ?? "ADMIN_TOKEN",
      actorId: input.actorId ?? headers?.get("x-admin-user") ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      companyId: input.companyId ?? null,
      metadata: input.metadata,
      ipAddress: headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: headers?.get("user-agent") ?? null,
    },
  }).catch(() => undefined);
}
