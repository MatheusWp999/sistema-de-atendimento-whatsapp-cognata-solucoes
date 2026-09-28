import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { hashPassword } from "@/services/password.service";
import { hashPasswordResetToken } from "@/services/password-reset.service";

const confirmSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(200),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = confirmSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error(parsed.error.issues[0]?.message ?? "Dados invalidos"), 400);

    const tokenHash = hashPasswordResetToken(parsed.data.token);
    const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash }, select: { id: true, userId: true, expiresAt: true, usedAt: true } });
    if (!reset || reset.usedAt || reset.expiresAt < new Date()) return apiError(new Error("Token invalido ou expirado."), 400);

    await prisma.$transaction([
      prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(parsed.data.password) } }),
      prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
