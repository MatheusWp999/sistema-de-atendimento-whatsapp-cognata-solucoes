import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { resolveConversationForCustomer } from "@/services/conversation-identity.service";
import { allowedCompanyIds, getRequestAuth, requireCompanyAccess, scopedCompanyId, unauthorized } from "@/services/api-auth.service";

const createConversationSchema = z.object({
  companyId: z.string().trim().min(1),
  customerPhone: z.string().trim().min(3).max(40),
  contactAliases: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  customerName: z.string().trim().max(120).optional(),
  aiStatus: z.enum(["AI_ACTIVE", "WAITING_HUMAN_REVIEW", "AI_PAUSED_COMPANY"]).optional(),
  currentOwner: z.enum(["AI", "HUMAN"]).optional(),
  lastMessage: z.string().trim().max(2000).optional(),
  lastMessageAt: z.string().datetime().optional(),
}).strict();

const listConversationSchema = z.object({
  companyId: z.string().trim().min(1).optional(),
  status: z.enum(["AI_ACTIVE", "HUMAN_TAKEOVER", "WAITING_HUMAN_REVIEW", "AI_PAUSED_COMPANY", "AI_DISABLED"]).optional(),
  supportStatus: z.enum(["OPEN", "PENDING", "RESOLVED", "ARCHIVED"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  search: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().trim().min(1).optional(),
}).strict();

function zodMessage(error: z.ZodError) {
  const issue = error.issues[0];
  const field = issue?.path.join(".");
  return field ? `${field}: ${issue.message}` : issue?.message ?? "Dados invalidos";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = listConversationSchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parsed.success) return apiError(new Error(zodMessage(parsed.error)), 400);
    const query = parsed.data;
    const auth = await getRequestAuth(request);
    if (!auth) return unauthorized();
    const requestedCompanyId = query.companyId;
    const companyId = scopedCompanyId(auth, requestedCompanyId);
    if (companyId === null) return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    const allowedIds = allowedCompanyIds(auth);
    const { status, supportStatus, priority, search, limit, cursor } = query;
    const conversations = await prisma.conversation.findMany({
      where: {
        ...(companyId ? { companyId } : allowedIds ? { companyId: { in: allowedIds } } : {}),
        ...(status ? { aiStatus: status } : {}),
        ...(supportStatus ? { supportStatus } : {}),
        ...(priority ? { priority } : {}),
        ...(search
          ? {
              OR: [
                { customerName: { contains: search, mode: "insensitive" } },
                { customerPhone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        company: { include: { assistant: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
      },
    });
    const hasMore = conversations.length > limit;
    const items = conversations.slice(0, limit).map((conversation) => ({
      ...conversation,
      company: sanitizeCompany(conversation.company),
    }));

    return NextResponse.json({
      items,
      nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
      hasMore,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const parsed = createConversationSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const body = parsed.data;
    const guard = await requireCompanyAccess(request, body.companyId);
    if (guard.response) return guard.response;
    const conversation = await resolveConversationForCustomer({
      companyId: body.companyId,
      customerPhone: body.customerPhone,
      aliases: body.contactAliases,
      customerName: body.customerName,
      defaults: {
        aiStatus: body.aiStatus,
        currentOwner: body.currentOwner,
        lastMessage: body.lastMessage,
        lastMessageAt: body.lastMessageAt ? new Date(body.lastMessageAt) : undefined,
      },
    });
    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
