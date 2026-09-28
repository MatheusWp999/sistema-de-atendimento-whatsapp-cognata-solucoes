import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

function parseRecipients(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [phone, name] = line.split(/[;,]/).map((part) => part.trim());
      return { phone: normalizePhone(phone), name: name || undefined };
    })
    .filter((item) => isValidE164Phone(item.phone));
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function isValidE164Phone(value: string) {
  return /^\+[1-9]\d{9,14}$/.test(value);
}

function zodMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : issue?.message ?? "Dados invalidos";
}

const campaignSchema = z.object({
  companyId: z.string().trim().min(1),
  templateId: z.string().trim().nullable().optional(),
  name: z.string().trim().min(2).max(120),
  status: z.enum(["DRAFT", "SCHEDULED"]).default("DRAFT"),
  scheduledAt: z.string().datetime().nullable().optional(),
  contactsText: z.string().trim().min(3).max(20000),
}).strict();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const companyId = scopedCompanyId(auth, searchParams.get("companyId"));
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const allowedIds = allowedCompanyIds(auth);
    const campaigns = await prisma.campaign.findMany({
      where: companyId ? { companyId } : allowedIds ? { companyId: { in: allowedIds } } : undefined,
      include: { template: true, _count: { select: { recipients: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(campaigns);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const parsed = campaignSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const recipients = parseRecipients(body.contactsText);
    if (!recipients.length) return apiError(new Error("Informe ao menos um telefone valido em formato internacional, exemplo: 5511999999999."), 400);
    if (body.templateId) {
      const template = await prisma.whatsAppTemplate.findFirst({ where: { id: body.templateId, companyId: body.companyId } });
      if (!template) return apiError(new Error("Template nao encontrado para esta empresa."), 400);
    }
    const campaign = await prisma.campaign.create({
      data: {
        companyId: body.companyId,
        templateId: body.templateId || undefined,
        name: body.name,
        status: body.status,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        totalRecipients: recipients.length,
        createdByUserId: auth.type === "company_user" ? auth.session.userId : undefined,
        audience: { source: "manual_text" } as Prisma.InputJsonValue,
        recipients: { create: recipients.map((recipient) => ({ companyId: body.companyId, phone: recipient.phone, name: recipient.name })) },
      },
      include: { recipients: true, template: true },
    });
    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
