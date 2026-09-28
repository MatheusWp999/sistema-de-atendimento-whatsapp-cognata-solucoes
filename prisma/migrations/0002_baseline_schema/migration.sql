-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "whatsappNumber" TEXT,
    "whatsappSessionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "whatsappConnectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "whatsappConnectedAt" TIMESTAMP(3),
    "whatsappLastSeenAt" TIMESTAMP(3),
    "whatsappLastError" TEXT,
    "whatsappPhoneNumberId" TEXT,
    "whatsappQrCodeDataUrl" TEXT,
    "whatsappQrCodeUpdatedAt" TIMESTAMP(3),
    "description" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "businessHours" JSONB,
    "notes" TEXT,
    "aiProvider" TEXT NOT NULL DEFAULT 'openai',
    "useOwnOpenAiKey" BOOLEAN NOT NULL DEFAULT false,
    "openAiApiKeyEncrypted" TEXT,
    "useOwnOpenRouterKey" BOOLEAN NOT NULL DEFAULT false,
    "openRouterApiKeyEncrypted" TEXT,
    "openRouterModel" TEXT,
    "defaultAiModel" TEXT,
    "fallbackAiModel" TEXT,
    "embeddingModel" TEXT,
    "dailyMessageLimit" INTEGER,
    "monthlyMessageLimit" INTEGER,
    "dailyCostLimit" DOUBLE PRECISION,
    "monthlyCostLimit" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OPERATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assistant" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "personality" TEXT NOT NULL,
    "tone" TEXT,
    "greetingMessage" TEXT,
    "closingMessage" TEXT,
    "formalityLevel" INTEGER NOT NULL DEFAULT 3,
    "friendlinessLevel" INTEGER NOT NULL DEFAULT 3,
    "objectivityLevel" INTEGER NOT NULL DEFAULT 3,
    "commercialLevel" INTEGER NOT NULL DEFAULT 3,
    "detailLevel" INTEGER NOT NULL DEFAULT 3,
    "responseSize" TEXT NOT NULL DEFAULT 'medium',
    "useEmojis" BOOLEAN NOT NULL DEFAULT false,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "maxTokens" INTEGER NOT NULL DEFAULT 700,
    "mandatoryRules" TEXT,
    "forbiddenRules" TEXT,
    "humanEscalationRules" TEXT,
    "fallbackMessage" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assistant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "aiStatus" TEXT NOT NULL DEFAULT 'AI_ACTIVE',
    "currentOwner" TEXT NOT NULL DEFAULT 'AI',
    "supportStatus" TEXT NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "assignedUserId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "slaDueAt" TIMESTAMP(3),
    "ownerEpoch" INTEGER NOT NULL DEFAULT 0,
    "lastMessage" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "lastCustomerMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internalNotes" TEXT,
    "aiSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSummaryJob" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "force" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSummaryJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationContactAlias" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationContactAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyModule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationModuleState" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "currentStep" TEXT,
    "collectedData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationModuleState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrder" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT NOT NULL,
    "fulfillmentType" TEXT NOT NULL,
    "address" TEXT,
    "paymentMethod" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "subtotal" DECIMAL(12,2),
    "deliveryFee" DECIMAL(12,2),
    "total" DECIMAL(12,2),
    "rawData" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "conversationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "senderType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "status" TEXT NOT NULL DEFAULT 'sent',
    "origin" TEXT NOT NULL,
    "metadata" JSONB,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "claimToken" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "responseToMessageId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDeliveryAttempt" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "MessageDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "filePath" TEXT,
    "sourceType" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeChunk" (
    "id" TEXT NOT NULL,
    "knowledgeItemId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "tokenCount" INTEGER,
    "embedding" vector,
    "embeddingModel" TEXT,
    "embeddingVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "conversationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'openai',
    "model" TEXT NOT NULL,
    "embeddingModel" TEXT,
    "usedCompanyKey" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCost" DOUBLE PRECISION,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT,
    "externalId" TEXT NOT NULL,
    "companyId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppSessionCommand" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "payload" JSONB,
    "requestedBy" TEXT,
    "lockedBy" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppSessionCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "companyId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_whatsappPhoneNumberId_key" ON "Company"("whatsappPhoneNumberId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "CompanyMembership_companyId_role_idx" ON "CompanyMembership"("companyId", "role");
CREATE UNIQUE INDEX "CompanyMembership_userId_companyId_key" ON "CompanyMembership"("userId", "companyId");
CREATE UNIQUE INDEX "Assistant_companyId_key" ON "Assistant"("companyId");
CREATE INDEX "Conversation_companyId_lastMessageAt_idx" ON "Conversation"("companyId", "lastMessageAt");
CREATE INDEX "Conversation_companyId_aiStatus_lastMessageAt_idx" ON "Conversation"("companyId", "aiStatus", "lastMessageAt");
CREATE INDEX "Conversation_companyId_supportStatus_slaDueAt_idx" ON "Conversation"("companyId", "supportStatus", "slaDueAt");
CREATE INDEX "Conversation_assignedUserId_supportStatus_idx" ON "Conversation"("assignedUserId", "supportStatus");
CREATE INDEX "Conversation_aiStatus_currentOwner_idx" ON "Conversation"("aiStatus", "currentOwner");
CREATE UNIQUE INDEX "Conversation_companyId_customerPhone_key" ON "Conversation"("companyId", "customerPhone");
CREATE INDEX "ConversationSummaryJob_status_scheduledAt_idx" ON "ConversationSummaryJob"("status", "scheduledAt");
CREATE INDEX "ConversationSummaryJob_status_leaseExpiresAt_idx" ON "ConversationSummaryJob"("status", "leaseExpiresAt");
CREATE INDEX "ConversationSummaryJob_conversationId_status_idx" ON "ConversationSummaryJob"("conversationId", "status");
CREATE INDEX "ConversationSummaryJob_companyId_status_idx" ON "ConversationSummaryJob"("companyId", "status");
CREATE INDEX "ConversationContactAlias_conversationId_idx" ON "ConversationContactAlias"("conversationId");
CREATE UNIQUE INDEX "ConversationContactAlias_companyId_alias_key" ON "ConversationContactAlias"("companyId", "alias");
CREATE INDEX "CompanyModule_companyId_enabled_idx" ON "CompanyModule"("companyId", "enabled");
CREATE UNIQUE INDEX "CompanyModule_companyId_moduleKey_key" ON "CompanyModule"("companyId", "moduleKey");
CREATE INDEX "ConversationModuleState_companyId_moduleKey_status_idx" ON "ConversationModuleState"("companyId", "moduleKey", "status");
CREATE UNIQUE INDEX "ConversationModuleState_conversationId_moduleKey_key" ON "ConversationModuleState"("conversationId", "moduleKey");
CREATE INDEX "RestaurantOrder_companyId_status_createdAt_idx" ON "RestaurantOrder"("companyId", "status", "createdAt");
CREATE INDEX "RestaurantOrder_conversationId_createdAt_idx" ON "RestaurantOrder"("conversationId", "createdAt");
CREATE INDEX "RestaurantOrderItem_orderId_idx" ON "RestaurantOrderItem"("orderId");
CREATE UNIQUE INDEX "Message_externalId_key" ON "Message"("externalId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_conversationId_senderType_createdAt_idx" ON "Message"("conversationId", "senderType", "createdAt");
CREATE INDEX "Message_companyId_createdAt_idx" ON "Message"("companyId", "createdAt");
CREATE INDEX "Message_status_createdAt_idx" ON "Message"("status", "createdAt");
CREATE INDEX "Message_status_nextAttemptAt_idx" ON "Message"("status", "nextAttemptAt");
CREATE INDEX "Message_status_leaseExpiresAt_idx" ON "Message"("status", "leaseExpiresAt");
CREATE UNIQUE INDEX "Message_conversationId_idempotencyKey_key" ON "Message"("conversationId", "idempotencyKey");
CREATE INDEX "MessageDeliveryAttempt_messageId_attemptNumber_idx" ON "MessageDeliveryAttempt"("messageId", "attemptNumber");
CREATE INDEX "MessageDeliveryAttempt_companyId_status_startedAt_idx" ON "MessageDeliveryAttempt"("companyId", "status", "startedAt");
CREATE INDEX "MessageDeliveryAttempt_conversationId_startedAt_idx" ON "MessageDeliveryAttempt"("conversationId", "startedAt");
CREATE UNIQUE INDEX "MessageDeliveryAttempt_messageId_attemptNumber_key" ON "MessageDeliveryAttempt"("messageId", "attemptNumber");
CREATE INDEX "KnowledgeItem_companyId_active_idx" ON "KnowledgeItem"("companyId", "active");
CREATE INDEX "KnowledgeChunk_companyId_idx" ON "KnowledgeChunk"("companyId");
CREATE INDEX "KnowledgeChunk_knowledgeItemId_idx" ON "KnowledgeChunk"("knowledgeItemId");
CREATE UNIQUE INDEX "KnowledgeChunk_knowledgeItemId_chunkIndex_key" ON "KnowledgeChunk"("knowledgeItemId", "chunkIndex");
CREATE INDEX "AIUsageLog_companyId_createdAt_idx" ON "AIUsageLog"("companyId", "createdAt");
CREATE INDEX "AIUsageLog_requestType_status_idx" ON "AIUsageLog"("requestType", "status");
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");
CREATE INDEX "InboundEvent_status_receivedAt_idx" ON "InboundEvent"("status", "receivedAt");
CREATE INDEX "InboundEvent_status_leaseExpiresAt_idx" ON "InboundEvent"("status", "leaseExpiresAt");
CREATE INDEX "InboundEvent_companyId_receivedAt_idx" ON "InboundEvent"("companyId", "receivedAt");
CREATE UNIQUE INDEX "InboundEvent_provider_externalId_key" ON "InboundEvent"("provider", "externalId");
CREATE INDEX "WhatsAppSessionCommand_status_createdAt_idx" ON "WhatsAppSessionCommand"("status", "createdAt");
CREATE INDEX "WhatsAppSessionCommand_companyId_status_idx" ON "WhatsAppSessionCommand"("companyId", "status");
CREATE INDEX "AuditLog_companyId_createdAt_idx" ON "AuditLog"("companyId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyMembership" ADD CONSTRAINT "CompanyMembership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Assistant" ADD CONSTRAINT "Assistant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConversationSummaryJob" ADD CONSTRAINT "ConversationSummaryJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationSummaryJob" ADD CONSTRAINT "ConversationSummaryJob_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationContactAlias" ADD CONSTRAINT "ConversationContactAlias_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationContactAlias" ADD CONSTRAINT "ConversationContactAlias_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationModuleState" ADD CONSTRAINT "ConversationModuleState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConversationModuleState" ADD CONSTRAINT "ConversationModuleState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrder" ADD CONSTRAINT "RestaurantOrder_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RestaurantOrderItem" ADD CONSTRAINT "RestaurantOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "RestaurantOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDeliveryAttempt" ADD CONSTRAINT "MessageDeliveryAttempt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDeliveryAttempt" ADD CONSTRAINT "MessageDeliveryAttempt_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MessageDeliveryAttempt" ADD CONSTRAINT "MessageDeliveryAttempt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeItem" ADD CONSTRAINT "KnowledgeItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_knowledgeItemId_fkey" FOREIGN KEY ("knowledgeItemId") REFERENCES "KnowledgeItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InboundEvent" ADD CONSTRAINT "InboundEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WhatsAppSessionCommand" ADD CONSTRAINT "WhatsAppSessionCommand_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
