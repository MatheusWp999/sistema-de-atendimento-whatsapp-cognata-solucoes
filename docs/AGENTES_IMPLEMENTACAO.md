# Agentes de Implementacao

Este arquivo coordena as frentes de correcao para evitar alteracoes conflitantes.

## Regras de coordenacao

- Um agente so deve alterar arquivos explicitamente atribuídos ao seu bloco.
- Mudancas em `schema.prisma`, migrations, autenticacao ou outbox devem passar por validacao global antes de nova onda.
- Toda onda deve terminar com `npm run lint` e `npm run build`.
- Nao reverter mudancas de outro agente; se houver conflito, pausar e consolidar no coordenador.
- Correcoes de arquitetura devem preservar os controles ja aplicados: `src/proxy.ts`, login administrativo, webhook HMAC, upload seguro e guardrails de handoff.

## Blocos e agentes

| Bloco | Agente responsavel | Status | Arquivos principais |
|---|---|---|---|
| Emergencial/seguranca de borda | Agente Segurança de Borda | Aplicado | `src/proxy.ts`, `src/app/login/page.tsx`, `src/app/api/auth/admin/route.ts`, `src/app/api/webhooks/whatsapp/route.ts`, `src/services/pdf.service.ts` |
| Validacao de APIs | Agente Contratos API | Aplicado parcialmente | `src/app/api/companies/**`, `src/app/api/assistants/**`, `src/app/api/knowledge/**` |
| WhatsApp QR/Cloud | Agente Canal WhatsApp | Aplicado parcialmente | `src/modules/providers/whatsapp-qr.service.ts`, `src/app/api/whatsapp-qr/**` |
| Filas, handoff e concorrencia | Agente Outbox/Handoff | Aplicado parcialmente | `src/services/message-orchestrator.service.ts`, `src/services/outbound-message.service.ts`, `src/app/api/conversations/[id]/takeover/route.ts` |
| IA/RAG/LLM safety | Agente IA/RAG Safety | Aplicado parcialmente | `src/services/ai.service.ts`, `src/services/rag.service.ts` |
| Pedidos/restaurante | Agente Restaurante | Aplicado parcialmente | `src/modules/business-modules/restaurant-orders.service.ts` |
| UX/a11y atendimento | Agente UX/Acessibilidade | Aplicado parcialmente | `src/components/chat/**`, `src/components/layout/AppShell.tsx`, `src/components/whatsapp/WhatsAppQrConnect.tsx` |
| DevOps/SRE | Agente DevOps | Aplicado parcialmente | `Dockerfile`, `docker-compose.yml`, `.dockerignore`, `src/app/api/health/route.ts`, `package.json` |
| Banco/migrations/integridade | Agente Banco Multitenant | Pendente | `prisma/schema.prisma`, `prisma/migrations/**` |
| Testes/QA | Agente QA Automacao | Pendente | runner de testes, fixtures e testes E2E/integracao |
| LGPD/retencao | Agente Privacy Engineering | Pendente | retention jobs, delete/export workflows, redaction/DLP |
| Contact center produto | Agente Contact Center | Pendente | usuarios, filas, atribuicao, SLA, auditoria operacional |

## Proximas ondas recomendadas

1. Banco e migrations: baseline completa, enums, constraints, FKs compostas e indices.
2. Inbox duravel e outbox com claim token/fencing real.
3. WhatsApp QR como gateway unico sem sockets em handlers HTTP.
4. Usuarios, RBAC real por empresa e auditoria operacional.
5. Retencao/LGPD, redaction de PII e workflows de delecao/exportacao.
6. Suite de testes cobrindo seguranca, webhook, outbox, pedidos, RAG e UI.
