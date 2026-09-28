# Central IA WhatsApp Local

Central local de atendimento estilo WhatsApp Web com controle humano/IA, multiempresa, conhecimento por empresa, RAG, OpenAI no backend e MockProvider para testes sem WhatsApp real.

## Stack

- Next.js + TypeScript
- Prisma + PostgreSQL + pgvector
- Tailwind CSS
- Zustand preparado como dependencia de estado local
- TanStack Query na tela de atendimento
- `@chatscope/chat-ui-kit-react` como base de UI de chat
- OpenAI API somente no backend
- Upload local em `storage/uploads`

## Instalar

```bash
npm install
```

## Configurar ambiente

Crie `.env` com base em `.env.example`.

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/central_ia_whatsapp"
APP_ENCRYPTION_KEY="gere-uma-chave-unica-com-pelo-menos-32-caracteres"
OPENAI_API_KEY=""
DEFAULT_AI_MODEL="gpt-4o-mini"
DEFAULT_EMBEDDING_MODEL="text-embedding-3-small"
MESSAGE_PROVIDER="mock"
```

## Banco local

No Windows, com Docker Desktop aberto, voce pode preparar tudo com:

```bash
npm run setup:local
```

Esse comando sobe o PostgreSQL, aplica o schema Prisma, gera o client e executa backfills seguros.

Manual:

```bash
docker compose up -d
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

Se preferir sem migrations durante teste local:

```bash
npm run prisma:push
npm run prisma:seed
```

## Rodar

```bash
npm run dev
```

Workers recomendados em terminais separados:

```bash
npm run worker:outbound
npm run worker:summary
npm run worker:whatsapp
```

O `worker:outbound` envia mensagens enfileiradas. O `worker:summary` atualiza resumos fora do caminho critico. O `worker:whatsapp` restaura e monitora sessoes QR salvas fora do ciclo de requests.

Acesse `http://localhost:3000/atendimento`.

## Chave geral da OpenAI

Opcoes:

1. Defina `OPENAI_API_KEY` no `.env`.
2. Use `PUT /api/settings/openai-global-key` com `{ "apiKey": "sk-..." }`.

A chave salva via endpoint fica criptografada no banco e nunca e retornada completa.

## Chave individual por empresa

Use:

```http
PATCH /api/companies/:id/openai-key
```

Body:

```json
{
  "useOwnOpenAiKey": true,
  "apiKey": "sk-..."
}
```

Regra aplicada no backend:

```ts
company.useOwnOpenAiKey && company.openAiApiKeyEncrypted
  ? decryptSecret(company.openAiApiKeyEncrypted)
  : globalOpenAiApiKey
```

## OpenRouter e motores por empresa

O sistema tambem suporta OpenRouter sem remover OpenAI.

Variaveis:

```env
OPENROUTER_API_KEY=""
DEFAULT_OPENROUTER_MODEL="meta-llama/llama-3.1-8b-instruct:free"
```

Acesse `/chaves-ia` para configurar:

- Provedor ativo por empresa: OpenAI ou OpenRouter.
- Chave geral OpenAI.
- Chave geral OpenRouter.
- Chave individual OpenAI por empresa.
- Chave individual OpenRouter por empresa.
- Modelo OpenAI por empresa.
- Modelo OpenRouter por empresa.

As chaves completas nunca sao retornadas para o frontend. A tela mostra apenas valores mascarados.

## Testar chave

```http
POST /api/ai/test-key
```

Body:

```json
{ "apiKey": "sk-..." }
```

O endpoint testa a chave sem retornar o valor completo.

## Simular atendimento

Na tela `/atendimento`:

- Selecione uma conversa.
- Use o campo “Simular mensagem do cliente no modo local”.
- Se a IA estiver ativa, o sistema salva a mensagem do cliente, busca conhecimento da empresa correta, gera resposta e salva no historico.
- Sem chave OpenAI, a IA responde com fallback seguro para permitir teste operacional.

## Pausar e assumir conversa

- `Assumir conversa`: muda `currentOwner` para `HUMAN`, `aiStatus` para `HUMAN_TAKEOVER` e libera envio manual.
- `Devolver para IA`: muda `currentOwner` para `AI`, `aiStatus` para `AI_ACTIVE` e bloqueia envio manual.
- `Pausar IA geral`: desativa `company.aiEnabled` e impede respostas automaticas para a empresa.

## Modulos por empresa

O sistema possui um catalogo de modulos ativaveis individualmente por empresa. Acesse:

```txt
/empresas/:id/modulos
```

Cada empresa pode ativar apenas os recursos que fazem sentido para o seu negocio. Exemplos:

- Restaurante: `Cardapio estruturado`, `Pedidos / Delivery`, `Reservas de mesa`.
- Clinica: `Agendamentos`, `Captacao de leads`.
- Servicos: `Orcamentos`, `Suporte / chamados`.

Endpoints:

```http
GET /api/companies/:id/modules
PATCH /api/companies/:id/modules
```

Body para atualizar:

```json
{
  "moduleKey": "restaurant_orders",
  "enabled": true,
  "config": {
    "acceptDelivery": true,
    "acceptPickup": true,
    "requireHumanConfirmation": false,
    "deliveryFee": 0,
    "paymentMethods": "Pix, dinheiro, cartao",
    "confirmationMessage": "Pedido confirmado. Vou encaminhar para preparo."
  }
}
```

### Modulo Pedidos / Delivery

Quando `restaurant_orders` esta ativo, o orquestrador tenta resolver pedidos antes da resposta livre da IA. O fluxo coleta:

- Itens e quantidades.
- Delivery ou retirada.
- Endereco, quando for delivery.
- Forma de pagamento.
- Nome do cliente.
- Confirmacao final.

Ao confirmar, o sistema cria registros em:

- `RestaurantOrder`
- `RestaurantOrderItem`
- `ConversationModuleState`

O pedido aparece no painel lateral da conversa em `/atendimento`. Se `requireHumanConfirmation` estiver ativo, o pedido fica como `pending_human_confirmation` e a conversa passa para revisao humana.

Importante: conhecimento/RAG continua sendo usado para duvidas livres. Modulos sao usados para acoes estruturadas, como montar pedido, gerar orcamento ou criar agendamento.

## Conhecimento e PDFs

Texto manual:

```http
POST /api/knowledge
```

PDF:

```http
POST /api/knowledge/upload-pdf
```

Campos de form-data:

- `companyId`
- `title`
- `type`
- `file`

O processamento salva o arquivo em `storage/uploads`, extrai texto, divide em chunks e tenta gerar embeddings quando ha chave OpenAI. A busca RAG sempre filtra por `companyId` e item ativo.

## Como a IA usa treinamentos e conhecimentos

Os conteudos sao separados em duas camadas:

- Camada permanente do agente: persona, regras, politicas, treinamentos, scripts e objecoes. Esses conteudos entram sempre no prompt da empresa.
- Base factual por pergunta: produtos, servicos, FAQ e informacoes especificas. Esses conteudos sao recuperados por RAG quando forem relevantes para a mensagem do cliente.

Tipos que entram sempre como orientacao permanente:

- `Identidade e persona da IA`
- `Regras de atendimento`
- `Politica interna`
- `Informacao juridica`
- `Treinamento`
- `Script comercial`
- `Objecoes e respostas`
- `Informacoes da empresa`
- `Atividades da empresa`

Mesmo nessas camadas, o isolamento por empresa continua obrigatorio: todo item e todo chunk carregam `companyId`, e a IA so recebe conteudos da empresa da conversa.

## Consumo

Acesse `/consumo` ou use:

```http
GET /api/usage
GET /api/usage/company/:id
```

Cada resposta de IA registra empresa, conversa, modelo, modelo de embedding, chave usada, tokens, custo estimado, status e tipo de requisicao.

## WhatsApp Cloud API futuramente

Estrutura preparada:

- `src/modules/providers/message-provider.ts`
- `src/modules/providers/mock-provider.ts`
- `src/modules/providers/whatsapp-cloud.provider.ts`
- `src/app/api/webhooks/whatsapp/route.ts`

Para ativar futuramente:

```env
MESSAGE_PROVIDER="whatsapp-cloud"
WHATSAPP_VERIFY_TOKEN="..."
WHATSAPP_ACCESS_TOKEN="..."
WHATSAPP_PHONE_NUMBER_ID="..."
```

## Verificacoes

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Neste ambiente Windows, se o Next/SWC nativo falhar com `not a valid Win32 application`, rode novamente apos reinstalar dependencias. Os scripts ja usam Webpack explicitamente para evitar Turbopack.
