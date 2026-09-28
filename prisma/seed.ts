import { PrismaClient } from "@prisma/client";
import { ConversationAIStatus, ConversationOwner, SenderType } from "../src/lib/constants";
import { hashPassword } from "../src/services/password.service";

const prisma = new PrismaClient();

async function main() {
  await prisma.aIUsageLog.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.knowledgeChunk.deleteMany();
  await prisma.knowledgeItem.deleteMany();
  await prisma.companyMembership.deleteMany();
  await prisma.user.deleteMany();
  await prisma.assistant.deleteMany();
  await prisma.company.deleteMany();
  await prisma.systemSetting.deleteMany();

  await prisma.systemSetting.createMany({
    data: [
      { key: "openai_global_key", value: "", encrypted: true },
      { key: "default_ai_model", value: "gpt-4o-mini" },
      { key: "default_embedding_model", value: "text-embedding-3-small" },
    ],
  });

  const companies = [
    {
      name: "Empresa Alpha",
      whatsappNumber: "+5511999000001",
      description: "Atendimento comercial consultivo para produtos e servicos locais.",
      notes: "Usa chave geral no MVP.",
      assistant: {
        name: "Ana",
        role: "Atendente comercial",
        personality: "Objetiva, educada e comercial.",
        tone: "Profissional, claro e direto.",
        responseSize: "curto",
        useEmojis: false,
      },
    },
    {
      name: "Empresa Beta",
      whatsappNumber: "+5511999000002",
      description: "Empresa especializada em atendimento consultivo e acolhedor.",
      notes: "Preparada para chave individual, mas sem chave cadastrada.",
      useOwnOpenAiKey: true,
      assistant: {
        name: "Sofia",
        role: "Atendente consultiva",
        personality: "Simpatica, consultiva e acolhedora.",
        tone: "Calmo, humano e prestativo.",
        friendlinessLevel: 5,
        detailLevel: 4,
        responseSize: "medium",
        useEmojis: true,
      },
    },
    {
      name: "Empresa Gamma",
      whatsappNumber: "+5511999000003",
      description: "Operacao tecnica com foco em seguranca, prazos e processos.",
      assistant: {
        name: "Clara",
        role: "Atendente tecnica",
        personality: "Tecnica, segura e detalhista.",
        tone: "Didatico, preciso e confiavel.",
        formalityLevel: 4,
        detailLevel: 5,
        responseSize: "detalhado",
        useEmojis: false,
      },
    },
    {
      name: "Empresa Delta",
      whatsappNumber: "+5511999000004",
      description: "Atendimento rapido para qualificacao comercial e vendas.",
      assistant: {
        name: "Laura",
        role: "Atendente de vendas",
        personality: "Direta, rapida e persuasiva.",
        tone: "Energetico, objetivo e comercial.",
        commercialLevel: 5,
        objectivityLevel: 5,
        responseSize: "curto",
        useEmojis: true,
      },
    },
  ];

  for (const companyData of companies) {
    const { assistant, ...company } = companyData;
    const created = await prisma.company.create({
      data: {
        ...company,
        defaultAiModel: "gpt-4o-mini",
        embeddingModel: "text-embedding-3-small",
        dailyMessageLimit: 300,
        monthlyMessageLimit: 5000,
        dailyCostLimit: 20,
        monthlyCostLimit: 300,
        assistant: {
          create: {
            ...assistant,
            greetingMessage: `Ola! Tudo bem? Eu sou a ${assistant.name}, atendente da ${company.name}.`,
            closingMessage: "Fico a disposicao. Posso te ajudar com mais alguma coisa?",
            mandatoryRules: "Responder em portugues do Brasil. Nao inventar informacoes. Usar apenas a base da empresa atual.",
            forbiddenRules: "Nao prometer descontos, aprovacao, resultado, contemplacao ou condicao especial sem base documentada.",
            humanEscalationRules: "Chamar humano para reclamacoes, negociacao sensivel, juridico, cancelamento, dados sensiveis ou informacao desconhecida.",
            fallbackMessage: "Para te passar essa informacao com seguranca, vou encaminhar sua conversa para um atendente responsavel.",
          },
        },
      },
      include: { assistant: true },
    });

    const knowledge = await prisma.knowledgeItem.create({
      data: {
        companyId: created.id,
        title: `Guia comercial - ${created.name}`,
        type: "FAQ",
        sourceType: "manual",
        active: true,
        processed: true,
        content: `${created.name} atende em horario comercial. A IA deve coletar nome, telefone e necessidade do cliente antes de encaminhar propostas.`,
      },
    });

    await prisma.knowledgeChunk.create({
      data: {
        companyId: created.id,
        knowledgeItemId: knowledge.id,
        content: knowledge.content ?? "",
        chunkIndex: 0,
        tokenCount: 40,
      },
    });

    const conversation = await prisma.conversation.create({
      data: {
        companyId: created.id,
        customerName: `Cliente ${created.name.split(" ").at(-1)}`,
        customerPhone: `+55119888${created.whatsappNumber?.slice(-4)}`,
        aiStatus: ConversationAIStatus.AI_ACTIVE,
        currentOwner: ConversationOwner.AI,
        lastMessage: "Quero saber mais sobre o atendimento.",
        lastMessageAt: new Date(),
        unreadCount: 1,
        tags: ["lead", "simulado"],
        aiSummary: "Cliente iniciou contato pedindo informacoes sobre atendimento.",
      },
    });

    await prisma.message.createMany({
      data: [
        {
          companyId: created.id,
          conversationId: conversation.id,
          senderType: SenderType.CUSTOMER,
          content: "Ola, quero saber mais sobre o atendimento de voces.",
          origin: "whatsapp",
          status: "received",
        },
        {
          companyId: created.id,
          conversationId: conversation.id,
          senderType: SenderType.AI,
          content: created.assistant?.greetingMessage ?? "Ola! Como posso ajudar?",
          origin: "ai",
          status: "sent",
        },
      ],
    });

    const slug = created.name.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "");
    const user = await prisma.user.create({
      data: {
        name: `Admin ${created.name}`,
        email: `${slug}@demo.local`,
        passwordHash: hashPassword("Empresa@123"),
        role: "OWNER",
        memberships: { create: { companyId: created.id, role: "OWNER" } },
      },
    });
    console.log(`Usuario criado para ${created.name}: ${user.email} / Empresa@123`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
