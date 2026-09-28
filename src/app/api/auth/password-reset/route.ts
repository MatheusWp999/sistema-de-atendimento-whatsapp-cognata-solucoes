import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { checkRateLimit } from "@/services/rate-limit.service";
import { createPasswordResetToken, hashPasswordResetToken } from "@/services/password-reset.service";

const requestSchema = z.object({ email: z.string().trim().email().max(180) }).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return apiError(new Error("Email invalido."), 400);
    const email = parsed.data.email.toLowerCase();
    const rateLimit = checkRateLimit(request, "auth:password-reset", { limit: 5, windowMs: 60_000, key: email });
    if (!rateLimit.allowed) return NextResponse.json({ error: "Muitas tentativas. Aguarde antes de tentar novamente." }, { status: 429 });

    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    let devResetToken: string | undefined;
    if (user) {
      const token = createPasswordResetToken();
      devResetToken = process.env.NODE_ENV === "production" ? undefined : token;
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashPasswordResetToken(token),
          expiresAt: new Date(Date.now() + 1000 * 60 * 30),
        },
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Se o email existir, enviaremos as instrucoes de recuperacao.",
      devResetToken,
    });
  } catch (error) {
    return apiError(error);
  }
}
