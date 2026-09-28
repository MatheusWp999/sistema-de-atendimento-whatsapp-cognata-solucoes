import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError, sanitizeCompany } from "@/lib/api";
import { requireCompanyAccess } from "@/services/api-auth.service";

const updateConversationSchema = z.object({
  supportStatus: z.enum(["OPEN", "PENDING", "RESOLVED", "ARCHIVED"]).optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  assignedUserId: z.string().trim().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(20).optional(),
  internalNotes: z.string().trim().max(4000).nullable().optional(),
  aiSummary: z.string().trim().max(4000).nullable().optional(),
}).strict();

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100), 1), 200);
    const cursor = searchParams.get("cursor") ?? undefined;
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        company: { include: { assistant: true } },
        assignedUser: { select: { id: true, name: true, email: true } },
        restaurantOrders: { include: { items: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!conversation) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, conversation.companyId);
    if (guard.response) return guard.response;
    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = messages.length > limit;
    const items = messages.slice(0, limit).reverse();
    return NextResponse.json({
      ...conversation,
      messages: items,
      messagesNextCursor: hasMore ? items[0]?.id ?? null : null,
      messagesHasMore: hasMore,
      company: sanitizeCompany(conversation.company),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = updateConversationSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);
    const conversation = await prisma.conversation.findUnique({ where: { id }, select: { companyId: true } });
    if (!conversation) return apiError(new Error("Conversa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, conversation.companyId);
    if (guard.response) return guard.response;
    const body = parsed.data;

    if (body.assignedUserId) {
      const membership = await prisma.companyMembership.findUnique({ where: { userId_companyId: { userId: body.assignedUserId, companyId: conversation.companyId } } });
      if (!membership) return apiError(new Error("Responsavel sem acesso a empresa."), 400);
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        supportStatus: body.supportStatus,
        priority: body.priority,
        assignedUserId: body.assignedUserId === null ? null : body.assignedUserId,
        assignedAt: body.assignedUserId ? new Date() : body.assignedUserId === null ? null : undefined,
        tags: body.tags,
        internalNotes: body.internalNotes,
        aiSummary: body.aiSummary,
      },
      include: { company: { include: { assistant: true } }, assignedUser: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json({ ...updated, company: sanitizeCompany(updated.company) });
  } catch (error) {
    return apiError(error);
  }
}
