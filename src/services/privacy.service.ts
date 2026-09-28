const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[CPF_REMOVIDO]"],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[CNPJ_REMOVIDO]"],
  [/\b(?:\d[ -]*?){13,19}\b/g, "[CARTAO_REMOVIDO]"],
  [/\b(?:cvv|cvc|senha|codigo sms|codigo de verificacao|token)\s*[:=]?\s*\S+/gi, "[SEGREDO_REMOVIDO]"],
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[EMAIL_REMOVIDO]"],
];

export function redactSensitiveContent(content: string) {
  return SENSITIVE_PATTERNS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), content);
}
