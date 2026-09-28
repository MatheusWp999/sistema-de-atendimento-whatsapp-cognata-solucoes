import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api";
import { extractPdfText, PdfExtractionError, removeUploadedPdf, saveUploadedPdf } from "@/services/pdf.service";
import { processKnowledgeItem } from "@/services/rag.service";
import { requireCompanyAccess } from "@/services/api-auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let saved: Awaited<ReturnType<typeof saveUploadedPdf>> | undefined;
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 12 * 1024 * 1024) return apiError(new Error("Upload deve ter ate 12 MB"), 413);
    const formData = await request.formData();
    const companyId = String(formData.get("companyId") ?? "");
    const title = String(formData.get("title") ?? "PDF sem titulo");
    const type = String(formData.get("type") ?? "PDF");
    const file = formData.get("file");
    if (!companyId || !(file instanceof File)) return apiError(new Error("Empresa e PDF sao obrigatorios"), 400);
    if (!/^[a-z0-9_-]{8,64}$/i.test(companyId)) return apiError(new Error("companyId invalido"), 400);
    if (title.length > 180) return apiError(new Error("Titulo deve ter ate 180 caracteres"), 400);
    if (!/^[a-zA-Z0-9 _-]{1,80}$/.test(type)) return apiError(new Error("Tipo de conhecimento invalido"), 400);

    const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
    if (!company) return apiError(new Error("Empresa nao encontrada"), 404);
    const guard = await requireCompanyAccess(request, companyId);
    if (guard.response) return guard.response;

    saved = await saveUploadedPdf(file);
    const content = await extractPdfText(saved.buffer);
    const item = await prisma.knowledgeItem.create({
      data: {
        companyId,
        title,
        type,
        sourceType: "pdf",
        filePath: saved.relativePath,
        content,
      },
    });
    await processKnowledgeItem(item.id);
    const processed = await prisma.knowledgeItem.findUnique({ where: { id: item.id }, include: { chunks: true } });
    return NextResponse.json(processed, { status: 201 });
  } catch (error) {
    await removeUploadedPdf(saved?.relativePath);
    if (error instanceof PdfExtractionError) return apiError(error, 400);
    return apiError(error);
  }
}
