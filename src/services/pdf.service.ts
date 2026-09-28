import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const uploadDir = path.join(process.cwd(), "storage", "uploads");
const maxPdfBytes = 10 * 1024 * 1024;

export class PdfExtractionError extends Error {}

function resolveUploadPath(fileName: string) {
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(resolvedUploadDir, fileName);
  if (path.dirname(resolvedFilePath) !== resolvedUploadDir) {
    throw new PdfExtractionError("Caminho de upload invalido.");
  }
  return resolvedFilePath;
}

export async function removeUploadedPdf(relativePath?: string | null) {
  if (!relativePath) return;
  const resolvedUploadDir = path.resolve(uploadDir);
  const resolvedFilePath = path.resolve(process.cwd(), relativePath);
  if (path.dirname(resolvedFilePath) !== resolvedUploadDir) return;
  await fs.rm(resolvedFilePath, { force: true }).catch(() => undefined);
}

export async function saveUploadedPdf(file: File) {
  if (file.size <= 0 || file.size > maxPdfBytes) {
    throw new PdfExtractionError("O PDF deve ter ate 10 MB.");
  }
  await fs.mkdir(uploadDir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("utf8") !== "%PDF-") {
    throw new PdfExtractionError("O arquivo enviado nao parece ser um PDF valido.");
  }
  const fileName = `${randomUUID()}.pdf`;
  const filePath = resolveUploadPath(fileName);
  await fs.writeFile(filePath, bytes);
  return { filePath, relativePath: path.join("storage", "uploads", fileName), buffer: bytes };
}

export async function extractPdfText(buffer: Buffer) {
  try {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText().finally(() => parser.destroy());
    const text = parsed.text.trim();
    if (!text) throw new PdfExtractionError("O PDF foi recebido, mas nao possui texto extraivel. Envie um PDF com texto selecionavel ou cole o conteudo manualmente.");
    return text;
  } catch (error) {
    if (error instanceof PdfExtractionError) throw error;
    throw new PdfExtractionError("Nao foi possivel extrair o texto deste PDF. Verifique se o arquivo nao esta protegido, corrompido ou composto apenas por imagem.");
  }
}
