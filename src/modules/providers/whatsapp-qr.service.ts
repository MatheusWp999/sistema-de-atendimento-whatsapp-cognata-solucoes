import { randomUUID } from "crypto";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  type Contact,
  type WAMessage,
  type WASocket,
  useMultiFileAuthState as createMultiFileAuthState,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/db";
import { normalizeConversationPhone, resolveConversationForCustomer } from "@/services/conversation-identity.service";
import { redactSensitiveContent } from "@/services/privacy.service";

type SessionStatus = "idle" | "connecting" | "qr" | "connected" | "stale" | "disconnected" | "error";

export type WhatsAppQrSessionSnapshot = {
  companyId: string;
  status: SessionStatus;
  qrCodeDataUrl?: string;
  phoneNumber?: string;
  startedAt?: string;
  lastError?: string;
  lastHealthCheckAt?: string;
  lastSuccessfulHealthCheckAt?: string;
  healthFailures?: number;
};

type SessionState = {
  companyId: string;
  status: SessionStatus;
  socket?: WASocket;
  qrCodeDataUrl?: string;
  phoneNumber?: string;
  startedAt?: Date;
  lastError?: string;
  contacts: Map<string, { name?: string; phone?: string }>;
  reconnectAttempts: number;
  reconnectTimer?: NodeJS.Timeout;
  presenceTimer?: NodeJS.Timeout;
  lastHealthCheckAt?: Date;
  lastSuccessfulHealthCheckAt?: Date;
  healthFailures: number;
  lastHealthPersistedAt?: Date;
};

const sessionsDir = path.join(process.cwd(), "storage", "whatsapp-sessions");
const COMMAND_LEASE_MS = 60_000;
const workerId = `${process.pid}-${randomUUID()}`;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return Promise.race([
    promise,
    new Promise<never>((_resolve, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

function extractMessageText(message: NonNullable<Parameters<WASocket["ev"]["on"]>[1]> extends never ? never : unknown) {
  if (!message || typeof message !== "object") return "";
  const value = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
    documentMessage?: { caption?: string };
    ephemeralMessage?: { message?: unknown };
    viewOnceMessage?: { message?: unknown };
  };

  if (value.ephemeralMessage?.message) return extractMessageText(value.ephemeralMessage.message);
  if (value.viewOnceMessage?.message) return extractMessageText(value.viewOnceMessage.message);

  return (
    value.conversation ??
    value.extendedTextMessage?.text ??
    value.imageMessage?.caption ??
    value.videoMessage?.caption ??
    value.documentMessage?.caption ??
    ""
  ).trim();
}

function normalizeJid(to: string) {
  if (to.includes("@")) return to;
  const digits = to.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

async function resolveOutboundJid(socket: WASocket, to: string) {
  const jid = normalizeJid(to);
  if (!jid.endsWith("@lid")) return jid;

  const phoneJid = await socket.signalRepository.lidMapping.getPNForLID(jid).catch(() => null);
  return phoneJid ?? jid;
}

function contactDisplayName(contact?: Partial<Contact> | null) {
  return contact?.name || contact?.verifiedName || contact?.notify || contact?.username || undefined;
}

function contactPhone(contact?: Partial<Contact> | null) {
  return contact?.phoneNumber ? normalizeConversationPhone(contact.phoneNumber) : undefined;
}

function messageTimestampToDate(timestamp: WAMessage["messageTimestamp"]) {
  if (!timestamp) return new Date();
  const value = typeof timestamp === "number" ? timestamp : Number(timestamp.toString());
  return new Date(value * 1000);
}

export class WhatsAppQrSessionManager {
  private sessions = new Map<string, SessionState>();
  private restorePromise?: Promise<void>;

  private isCurrentSession(session: SessionState) {
    return this.sessions.get(session.companyId) === session;
  }

  private stopOnlinePresence(session: SessionState) {
    if (!session.presenceTimer) return;
    clearInterval(session.presenceTimer);
    session.presenceTimer = undefined;
  }

  private startOnlinePresence(session: SessionState) {
    this.stopOnlinePresence(session);

    const sendOnline = async () => {
      if (!this.isCurrentSession(session)) return;
      if (session.status !== "connected" || !session.socket) return;
      await this.checkConnectedSessionHealth(session);
    };

    void sendOnline();
    session.presenceTimer = setInterval(() => void sendOnline(), 20_000);
    session.presenceTimer.unref?.();
  }

  private async markSessionStale(session: SessionState, reason: string) {
    if (!this.isCurrentSession(session)) return;
    this.stopOnlinePresence(session);
    session.status = "stale";
    session.lastError = reason;
    await this.updateCompanyConnection(session.companyId, {
      status: "STALE",
      sessionEnabled: true,
      lastError: reason,
    });
  }

  private async checkConnectedSessionHealth(session: SessionState, options?: { forcePersist?: boolean }) {
    if (!this.isCurrentSession(session)) return;
    if (session.status !== "connected" || !session.socket) return;

    session.lastHealthCheckAt = new Date();

    try {
      if (!session.socket.ws.isOpen) throw new Error("Socket do WhatsApp fechado.");
      await withTimeout(session.socket.sendPresenceUpdate("available"), 5_000, "Tempo limite ao validar presenca do WhatsApp QR.");
      session.healthFailures = 0;
      session.lastError = undefined;
      session.lastSuccessfulHealthCheckAt = new Date();

      const shouldPersist = options?.forcePersist ||
        !session.lastHealthPersistedAt ||
        Date.now() - session.lastHealthPersistedAt.getTime() > 60_000;

      if (shouldPersist) {
        session.lastHealthPersistedAt = new Date();
        await this.updateCompanyConnection(session.companyId, { status: "CONNECTED", sessionEnabled: true, lastError: null });
      }
    } catch (error) {
      session.healthFailures += 1;
      session.lastError = error instanceof Error ? error.message : "Falha ao validar conexao WhatsApp.";
      if (session.healthFailures >= 2) {
        await this.markSessionStale(session, `Conexao WhatsApp sem resposta no health check: ${session.lastError}`);
      }
    }
  }

  private async updateCompanyConnection(companyId: string, data: {
    status: string;
    phoneNumber?: string;
    lastError?: string | null;
    connected?: boolean;
    sessionEnabled?: boolean;
    qrCodeDataUrl?: string | null;
  }) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        whatsappConnectionStatus: data.status,
        whatsappLastSeenAt: new Date(),
        whatsappLastError: data.lastError,
        ...(data.phoneNumber ? { whatsappNumber: data.phoneNumber } : {}),
        ...(data.connected ? { whatsappConnectedAt: new Date() } : {}),
        ...(typeof data.sessionEnabled === "boolean" ? { whatsappSessionEnabled: data.sessionEnabled } : {}),
        ...(data.qrCodeDataUrl !== undefined
          ? { whatsappQrCodeDataUrl: data.qrCodeDataUrl, whatsappQrCodeUpdatedAt: data.qrCodeDataUrl ? new Date() : null }
          : {}),
      },
    }).catch(() => undefined);
  }

  private async stopSessionLocally(companyId: string, reason: string) {
    const session = this.sessions.get(companyId);
    if (session?.reconnectTimer) clearTimeout(session.reconnectTimer);
    if (session) this.stopOnlinePresence(session);
    await session?.socket?.end(new Error(reason)).catch(() => undefined);
    this.sessions.delete(companyId);
  }

  private async disableDuplicateNumberSessions(companyId: string, phoneNumber?: string) {
    if (!phoneNumber) return;

    const duplicates = await prisma.company.findMany({
      where: {
        id: { not: companyId },
        whatsappNumber: phoneNumber,
        whatsappSessionEnabled: true,
      },
      select: { id: true, name: true },
    });

    for (const duplicate of duplicates) {
      const reason = `Numero ${phoneNumber} assumido por outra empresa conectada ao WhatsApp QR.`;
      await this.stopSessionLocally(duplicate.id, reason);
      await this.updateCompanyConnection(duplicate.id, {
        status: "DISCONNECTED",
        sessionEnabled: false,
        lastError: reason,
      });
      console.warn("[whatsapp-qr] sessao duplicada desativada", { companyId: duplicate.id, companyName: duplicate.name, phoneNumber });
    }
  }

  private scheduleSessionReconnect(session: SessionState, reason: string, options?: { slow?: boolean }) {
    if (!this.isCurrentSession(session)) return;

    this.stopOnlinePresence(session);
    if (session.reconnectTimer) clearTimeout(session.reconnectTimer);

    const attempt = session.reconnectAttempts + 1;
    session.reconnectAttempts = attempt;
    session.status = "disconnected";
      session.qrCodeDataUrl = undefined;
      session.lastError = reason;

      const baseDelay = options?.slow ? 10_000 : 2_000;
    const maxDelay = options?.slow ? 120_000 : 60_000;
    const delay = Math.min(maxDelay, baseDelay * attempt);

    void this.updateCompanyConnection(session.companyId, {
      status: "RESTORING",
      sessionEnabled: true,
      lastError: `${reason}. Tentando reconectar automaticamente em ${Math.round(delay / 1000)}s.`,
      qrCodeDataUrl: null,
    });

    session.reconnectTimer = setTimeout(() => {
      if (!this.isCurrentSession(session)) return;
      this.sessions.delete(session.companyId);
      void this.start(session.companyId, { restore: true }).catch((error) => {
        this.sessions.set(session.companyId, {
          companyId: session.companyId,
          status: "error",
          contacts: new Map(),
          reconnectAttempts: attempt,
          healthFailures: 0,
          lastError: error instanceof Error ? error.message : "Erro ao reconectar WhatsApp",
        });
      });
    }, delay);
    session.reconnectTimer.unref?.();
  }

  private async flushUndeliveredOutboundMessages(session: SessionState & { socket: WASocket }) {
    const messages = await prisma.message.findMany({
      where: {
        companyId: session.companyId,
        externalId: null,
        senderType: { in: ["AI", "HUMAN"] },
        status: { in: ["sending", "error"] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { conversation: { select: { customerPhone: true } } },
      orderBy: { createdAt: "asc" },
      take: 20,
    });

    for (const message of messages) {
      const sentContent =
        typeof message.metadata === "object" &&
        message.metadata !== null &&
        !Array.isArray(message.metadata) &&
        typeof message.metadata.sentContent === "string"
          ? message.metadata.sentContent
          : message.content;

      try {
        const jid = await resolveOutboundJid(session.socket, message.conversation.customerPhone);
        const sent = await withTimeout(
          session.socket.sendMessage(jid, { text: sentContent }),
          20_000,
          "Tempo limite ao reenviar mensagem pendente pelo WhatsApp QR.",
        );
        const externalId = sent?.key.id ?? undefined;
        if (!externalId) throw new Error("WhatsApp QR nao confirmou o reenvio da mensagem pendente.");
        await prisma.message.update({ where: { id: message.id }, data: { status: "sent", externalId } });
      } catch (error) {
        await prisma.message.update({ where: { id: message.id }, data: { status: "error" } }).catch(() => undefined);
        console.warn("[whatsapp-qr] erro ao reenviar mensagem pendente", error instanceof Error ? error.message : error);
      }
    }
  }

  private async hasSavedCredentials(companyId: string) {
    try {
      await fs.access(path.join(this.resolveSessionDir(companyId), "creds.json"));
      return true;
    } catch {
      return false;
    }
  }

  private resolveSessionDir(companyId: string) {
    if (!/^[a-z0-9_-]{8,64}$/i.test(companyId)) throw new Error("companyId invalido");
    const resolvedSessionsDir = path.resolve(sessionsDir);
    const resolvedSessionDir = path.resolve(resolvedSessionsDir, companyId);
    if (path.dirname(resolvedSessionDir) !== resolvedSessionsDir) throw new Error("Diretorio de sessao invalido");
    return resolvedSessionDir;
  }

  private async deleteSavedCredentials(companyId: string) {
    await fs.rm(this.resolveSessionDir(companyId), { recursive: true, force: true }).catch(() => undefined);
  }

  async dispose() {
    for (const session of this.sessions.values()) {
      if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
      this.stopOnlinePresence(session);
      await session.socket?.end(new Error("Substituindo instancia do WhatsApp QR no servidor.")).catch(() => undefined);
    }
    this.sessions.clear();
  }

  async restoreEnabledSessions() {
    if (this.restorePromise) return this.restorePromise;

    this.restorePromise = (async () => {
      const companies = await prisma.company.findMany({
        where: { whatsappSessionEnabled: true },
        select: { id: true },
      });

      for (const company of companies) {
        const session = this.sessions.get(company.id);
        if (session?.status === "connected" || session?.status === "connecting" || session?.status === "qr") continue;
        if (!(await this.hasSavedCredentials(company.id))) {
        await this.updateCompanyConnection(company.id, {
            status: "QR_REQUIRED",
            sessionEnabled: true,
            lastError: "Sessao WhatsApp sem credenciais salvas. Gere um novo QR Code para reconectar.",
            qrCodeDataUrl: null,
          });
          continue;
        }
        await this.start(company.id, { restore: true }).catch((error) => {
          return this.updateCompanyConnection(company.id, {
            status: "ERROR",
            lastError: error instanceof Error ? error.message : "Erro ao restaurar sessao WhatsApp",
          });
        });
      }
    })().finally(() => {
      this.restorePromise = undefined;
    });

    return this.restorePromise;
  }

  private async waitUntilConnected(companyId: string, timeoutMs = 20_000): Promise<SessionState & { socket: WASocket }> {
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      const session = this.sessions.get(companyId);
      if (session?.status === "connected" && session.socket) return session as SessionState & { socket: WASocket };
      if (session?.status === "qr") {
        throw new Error("WhatsApp precisa ser reconectado. Abra /whatsapp e escaneie o QR Code novamente.");
      }
      if (session?.status === "error") {
        throw new Error(session.lastError ?? "Erro ao conectar WhatsApp.");
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error("WhatsApp ainda nao conectou. Aguarde alguns segundos ou reconecte em /whatsapp.");
  }

  getSnapshot(companyId: string): WhatsAppQrSessionSnapshot {
    const session = this.sessions.get(companyId);
    if (!session) return { companyId, status: "idle" };
    return {
      companyId,
      status: session.status,
      qrCodeDataUrl: session.qrCodeDataUrl,
      phoneNumber: session.phoneNumber,
      startedAt: session.startedAt?.toISOString(),
      lastError: session.lastError,
      lastHealthCheckAt: session.lastHealthCheckAt?.toISOString(),
      lastSuccessfulHealthCheckAt: session.lastSuccessfulHealthCheckAt?.toISOString(),
      healthFailures: session.healthFailures,
    };
  }

  getAllSnapshots() {
    return Array.from(this.sessions.values()).map((session) => this.getSnapshot(session.companyId));
  }

  async start(companyId: string, options?: { restore?: boolean }) {
    const existing = this.sessions.get(companyId);
    if (existing?.status === "connected" || existing?.status === "qr" || existing?.status === "connecting") {
      if (existing.status === "connected" && existing.socket) {
        await this.flushUndeliveredOutboundMessages(existing as SessionState & { socket: WASocket });
      }
      return this.getSnapshot(companyId);
    }

    const session: SessionState = {
      companyId,
      status: "connecting",
      startedAt: new Date(),
      contacts: new Map(),
      reconnectAttempts: existing?.reconnectAttempts ?? 0,
      healthFailures: 0,
    };
    this.sessions.set(companyId, session);

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      if (this.isCurrentSession(session)) this.sessions.delete(companyId);
      throw new Error("Empresa nao encontrada para conectar WhatsApp.");
    }
    if (company.whatsappConnectionStatus === "LOGGED_OUT") {
      await this.deleteSavedCredentials(companyId);
    }
    await this.disableDuplicateNumberSessions(companyId, company.whatsappNumber ?? undefined);

    await this.updateCompanyConnection(companyId, {
      status: options?.restore ? "RESTORING" : "CONNECTING",
      sessionEnabled: true,
      lastError: null,
      qrCodeDataUrl: null,
    });

    const { state, saveCreds } = await createMultiFileAuthState(this.resolveSessionDir(companyId));
    const { version } = await fetchLatestBaileysVersion();
    const socket = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: "silent" }),
      browser: Browsers.ubuntu("Cognita"),
      markOnlineOnConnect: true,
      printQRInTerminal: false,
      syncFullHistory: true,
    });

    session.socket = socket;

    socket.ev.on("creds.update", () => {
      void saveCreds().catch((error) => {
        console.warn("[whatsapp-qr] erro ao salvar credenciais", error instanceof Error ? error.message : error);
      });
    });

    socket.ev.on("connection.update", async (update) => {
      console.log("[whatsapp-qr] connection.update", {
        companyId,
        connection: update.connection,
        hasQr: Boolean(update.qr),
        lastDisconnect: update.lastDisconnect?.error?.message,
      });

      if (!this.isCurrentSession(session)) return;

      if (update.qr) {
        const qrCodeDataUrl = await QRCode.toDataURL(update.qr, { margin: 2, width: 320 });
        if (!this.isCurrentSession(session)) return;
        session.qrCodeDataUrl = qrCodeDataUrl;
        session.status = "qr";
        session.lastError = undefined;
        await this.updateCompanyConnection(companyId, { status: "QR_REQUIRED", sessionEnabled: true, lastError: null, qrCodeDataUrl });
      }

      if (update.connection === "open") {
        if (!this.isCurrentSession(session)) return;
        session.status = "connected";
        session.reconnectAttempts = 0;
        session.healthFailures = 0;
        session.qrCodeDataUrl = undefined;
        session.phoneNumber = socket.user?.id?.split(":")[0]?.replace(/\D/g, "");
        await this.disableDuplicateNumberSessions(companyId, session.phoneNumber);
        this.startOnlinePresence(session);
        await this.updateCompanyConnection(companyId, {
          status: "CONNECTED",
          phoneNumber: session.phoneNumber,
          connected: true,
          sessionEnabled: true,
          lastError: null,
          qrCodeDataUrl: null,
        });
        await this.flushUndeliveredOutboundMessages(session as SessionState & { socket: WASocket });
      }

      if (update.connection === "close") {
        if (!this.isCurrentSession(session)) return;
        this.stopOnlinePresence(session);
        const statusCode = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const disconnectMessage = update.lastDisconnect?.error?.message ?? "";
        const isConflict = disconnectMessage.toLowerCase().includes("conflict");
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const reason = disconnectMessage || "Conexao WhatsApp fechada.";

        if (isLoggedOut) {
          session.status = "disconnected";
          session.qrCodeDataUrl = undefined;
          session.lastError = reason;
          if (session.reconnectTimer) clearTimeout(session.reconnectTimer);
          await this.deleteSavedCredentials(companyId);
          await socket.end(new Error("Sessao WhatsApp encerrada; novo QR necessario.")).catch(() => undefined);
          this.sessions.delete(companyId);
          await this.updateCompanyConnection(companyId, {
            status: "LOGGED_OUT",
            lastError: session.lastError ?? null,
            sessionEnabled: false,
            qrCodeDataUrl: null,
          });
          return;
        }

        this.scheduleSessionReconnect(session, isConflict ? "Conflito temporario entre instancias WhatsApp" : reason, { slow: isConflict });
      }
    });

    setTimeout(() => {
      const current = this.sessions.get(companyId);
      if (current === session && current.status === "connecting") {
        current.status = "error";
        current.lastError = "O WhatsApp nao retornou QR Code em 30 segundos. Verifique internet, firewall/antivirus e tente gerar novamente.";
      }
    }, 30_000);

    const saveContacts = async (contacts: Partial<Contact>[]) => {
      if (!this.isCurrentSession(session)) return;
      for (const contact of contacts) {
        if (!contact.id) continue;
        const name = contactDisplayName(contact);
        const phone = contactPhone(contact);
        session.contacts.set(contact.id, { name, phone });
        if (contact.lid) session.contacts.set(contact.lid, { name, phone });
        if (contact.phoneNumber) session.contacts.set(contact.phoneNumber, { name, phone });
        if (!name) continue;

        const possiblePhones = [contact.id, contact.lid, contact.phoneNumber, phone]
          .filter((value): value is string => Boolean(value))
          .map(normalizeConversationPhone);

        await prisma.conversation.updateMany({
          where: { companyId, customerPhone: { in: possiblePhones } },
          data: { customerName: name },
        });
      }
    };

    const findContactForJid = (jid: string) => {
      const normalized = normalizeConversationPhone(jid);
      return session.contacts.get(jid) ?? session.contacts.get(normalized);
    };

    const upsertConversationFromWhatsApp = async (params: {
      jid: string;
      customerName?: string;
      lastMessage?: string;
      lastMessageAt?: Date;
    }) => {
      const contact = findContactForJid(params.jid);
      const customerName = params.customerName || contact?.name;
      const customerPhone = normalizeConversationPhone(contact?.phone || params.jid);
      const possiblePhones = [params.jid, normalizeConversationPhone(params.jid), contact?.phone]
        .filter((value): value is string => Boolean(value))
        .map(normalizeConversationPhone);

      return resolveConversationForCustomer({
        companyId,
        customerPhone,
        aliases: possiblePhones,
        customerName,
        defaults: {
          aiStatus: "AI_ACTIVE",
          currentOwner: "AI",
          lastMessage: params.lastMessage,
          lastMessageAt: params.lastMessageAt,
        },
      });
    };

    const persistWhatsAppMessage = async (item: WAMessage, source: "history" | "live") => {
      const remoteJid = item.key.remoteJid;
      const externalId = item.key.id ?? undefined;
      if (!remoteJid || remoteJid.endsWith("@g.us") || !externalId) return;
      const content = extractMessageText(item.message);
      if (!content) return;
      const safeContent = redactSensitiveContent(content);

      const existingMessage = await prisma.message.findUnique({ where: { externalId } });
      if (existingMessage) return;

      const createdAt = messageTimestampToDate(item.messageTimestamp);
      const contact = findContactForJid(remoteJid);
      const conversation = await upsertConversationFromWhatsApp({
        jid: remoteJid,
        customerName: item.pushName ?? contact?.name,
        lastMessage: safeContent,
        lastMessageAt: createdAt,
      });

      if (item.key.fromMe) {
        const recentBotOrHumanMessage = await prisma.message.findFirst({
          where: {
            conversationId: conversation.id,
            senderType: { in: ["AI", "HUMAN"] },
            createdAt: { gte: new Date(Date.now() - 20_000) },
          },
          orderBy: { createdAt: "desc" },
        });
        if (recentBotOrHumanMessage) {
          await prisma.message.update({ where: { id: recentBotOrHumanMessage.id }, data: { externalId } });
          return;
        }
      }

      const persistedMessage = await prisma.message.create({
        data: {
          externalId,
          conversationId: conversation.id,
          companyId,
          senderType: item.key.fromMe ? "HUMAN" : "CUSTOMER",
          content: safeContent,
          status: item.key.fromMe ? "sent" : "received",
          origin: "whatsapp",
          createdAt,
          metadata: { source },
        },
      });
      if (!item.key.fromMe) {
        await prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastCustomerMessageAt: persistedMessage.createdAt },
        });
      }
    };

    socket.ev.on("contacts.upsert", (contacts) => {
      if (!this.isCurrentSession(session)) return;
      void saveContacts(contacts);
    });

    socket.ev.on("contacts.update", (contacts) => {
      if (!this.isCurrentSession(session)) return;
      void saveContacts(contacts);
    });

    socket.ev.on("messaging-history.set", ({ chats, contacts, messages, progress, syncType }) => {
      if (!this.isCurrentSession(session)) return;
      console.log("[whatsapp-qr] messaging-history.set", {
        companyId,
        chats: chats.length,
        contacts: contacts.length,
        messages: messages.length,
        progress,
        syncType,
      });

      void (async () => {
        if (!this.isCurrentSession(session)) return;
        await saveContacts(contacts);
        for (const chat of chats) {
          if (!this.isCurrentSession(session)) return;
          if (!chat.id || chat.id.endsWith("@g.us")) continue;
          const contact = findContactForJid(chat.id);
          await upsertConversationFromWhatsApp({
            jid: chat.id,
            customerName: contact?.name,
            lastMessageAt: chat.conversationTimestamp ? messageTimestampToDate(chat.conversationTimestamp) : undefined,
          });
        }
        for (const message of messages) {
          if (!this.isCurrentSession(session)) return;
          await persistWhatsAppMessage(message, "history").catch((error) => {
            console.warn("[whatsapp-qr] erro ao persistir mensagem historica", error instanceof Error ? error.message : error);
          });
        }
      })().catch((error) => {
        console.warn("[whatsapp-qr] erro ao processar historico", error instanceof Error ? error.message : error);
      });
    });

    socket.ev.on("messages.upsert", async ({ messages, type }) => {
      if (!this.isCurrentSession(session)) return;
      for (const item of messages) {
        try {
          if (!this.isCurrentSession(session)) return;
          const remoteJid = item.key.remoteJid;
          if (!remoteJid || remoteJid.endsWith("@g.us")) continue;
          const content = extractMessageText(item.message);
          if (!content) continue;

          if (!item.key.fromMe) {
            await socket.presenceSubscribe(remoteJid).catch(() => undefined);
            await socket.sendPresenceUpdate("available", remoteJid).catch(() => undefined);
            await socket.readMessages([item.key]).catch(() => undefined);
          }

          if (item.key.fromMe || type !== "notify") {
            await persistWhatsAppMessage(item, "live");
            continue;
          }

          const { handleIncomingMessage } = await import("@/services/message-orchestrator.service");
          await handleIncomingMessage({
            companyId,
            from: normalizeConversationPhone(findContactForJid(remoteJid)?.phone || remoteJid),
            customerName: item.pushName ?? findContactForJid(remoteJid)?.name,
            contactAliases: [remoteJid, findContactForJid(remoteJid)?.phone].filter((value): value is string => Boolean(value)),
            message: redactSensitiveContent(content),
            externalId: item.key.id ?? undefined,
          });
        } catch (error) {
          console.warn("[whatsapp-qr] erro ao processar mensagem recebida", error instanceof Error ? error.message : error);
        }
      }
    });

    return this.getSnapshot(companyId);
  }

  async sendMessage(companyId: string, to: string, message: string) {
    const currentSession = this.sessions.get(companyId);
    if (!currentSession || currentSession.status === "idle" || currentSession.status === "stale" || currentSession.status === "disconnected" || currentSession.status === "error") {
      await this.start(companyId);
    }

    const session = await this.waitUntilConnected(companyId);
    await this.checkConnectedSessionHealth(session, { forcePersist: true });
    if (session.status !== "connected") throw new Error(session.lastError ?? "WhatsApp QR nao esta conectado.");

    const jid = await resolveOutboundJid(session.socket, to);
    const sent = await withTimeout(session.socket.sendMessage(jid, { text: message }), 20_000, "Tempo limite ao enviar mensagem pelo WhatsApp QR.");
    const externalId = sent?.key.id ?? undefined;
    if (!externalId) throw new Error(`WhatsApp QR nao confirmou o envio para ${jid}.`);
    return externalId;
  }

  async refreshHealth(companyId: string) {
    const session = this.sessions.get(companyId);
    if (session?.status === "connected") {
      await this.checkConnectedSessionHealth(session, { forcePersist: true });
      return this.getSnapshot(companyId);
    }

    if (!session) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { whatsappConnectionStatus: true, whatsappSessionEnabled: true },
      });
      if (company?.whatsappSessionEnabled && ["CONNECTED", "CONNECTING", "RESTORING"].includes(company.whatsappConnectionStatus)) {
        await this.updateCompanyConnection(companyId, {
          status: "STALE",
          sessionEnabled: true,
          lastError: "Sessao WhatsApp nao esta ativa no servidor. Gere um novo QR Code ou aguarde a restauracao.",
          qrCodeDataUrl: null,
        });
      } else if (!company?.whatsappSessionEnabled && ["CONNECTED", "CONNECTING", "RESTORING", "STALE", "QR_REQUIRED"].includes(company?.whatsappConnectionStatus ?? "")) {
        await this.updateCompanyConnection(companyId, {
          status: "DISCONNECTED",
          sessionEnabled: false,
          lastError: null,
          qrCodeDataUrl: null,
        });
      }
    }

    return this.getSnapshot(companyId);
  }

  async refreshAllEnabledSessionsHealth() {
    const companies = await prisma.company.findMany({
      where: { OR: [{ whatsappSessionEnabled: true }, { whatsappConnectionStatus: { in: ["CONNECTED", "CONNECTING", "RESTORING"] } }] },
      select: { id: true },
    });

    await Promise.all(companies.map((company) => this.refreshHealth(company.id)));
  }

  async disconnect(companyId: string) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { whatsappNumber: true },
    });

    const affectedCompanyIds = new Set([companyId]);
    if (company?.whatsappNumber) {
      const companiesWithSameNumber = await prisma.company.findMany({
        where: { whatsappNumber: company.whatsappNumber },
        select: { id: true },
      });
      for (const companyWithSameNumber of companiesWithSameNumber) affectedCompanyIds.add(companyWithSameNumber.id);

      for (const session of this.sessions.values()) {
        if (session.phoneNumber === company.whatsappNumber) affectedCompanyIds.add(session.companyId);
      }
    }

    for (const affectedCompanyId of affectedCompanyIds) {
      const session = this.sessions.get(affectedCompanyId);
      if (session?.reconnectTimer) clearTimeout(session.reconnectTimer);
      if (session) this.stopOnlinePresence(session);
      this.sessions.delete(affectedCompanyId);
      if (session?.socket) {
        await session.socket.logout().catch(async () => {
          await session.socket?.end(new Error("Sessao WhatsApp desconectada manualmente.")).catch(() => undefined);
        });
      }
      await this.deleteSavedCredentials(affectedCompanyId);
      await this.updateCompanyConnection(affectedCompanyId, {
        status: "DISCONNECTED",
        sessionEnabled: false,
        lastError: null,
        qrCodeDataUrl: null,
      });
    }

    return { companyId, status: "idle" as const, affectedCompanyIds: Array.from(affectedCompanyIds) };
  }

  async processPendingCommands(options?: { limit?: number }) {
    await prisma.whatsAppSessionCommand.updateMany({
      where: { status: "processing", leaseExpiresAt: { lt: new Date() } },
      data: { status: "failed_retryable", lockedBy: null, leaseExpiresAt: null },
    });

    const commands = await prisma.whatsAppSessionCommand.findMany({
      where: { status: { in: ["queued", "failed_retryable"] } },
      orderBy: { createdAt: "asc" },
      take: options?.limit ?? 10,
    });

    const results = [];
    for (const command of commands) {
      const claim = await prisma.whatsAppSessionCommand.updateMany({
        where: { id: command.id, status: { in: ["queued", "failed_retryable"] } },
        data: { status: "processing", lockedBy: workerId, leaseExpiresAt: new Date(Date.now() + COMMAND_LEASE_MS), startedAt: new Date() },
      });
      if (!claim.count) continue;

      try {
        const result = command.action === "disconnect"
          ? await this.disconnect(command.companyId)
          : await this.start(command.companyId);
        await prisma.whatsAppSessionCommand.updateMany({
          where: { id: command.id, status: "processing", lockedBy: workerId },
          data: { status: "completed", errorMessage: null, lockedBy: null, leaseExpiresAt: null, finishedAt: new Date() },
        });
        results.push({ commandId: command.id, companyId: command.companyId, action: command.action, status: "completed", result });
      } catch (error) {
        await prisma.whatsAppSessionCommand.updateMany({
          where: { id: command.id, status: "processing", lockedBy: workerId },
          data: {
            status: "failed_retryable",
            errorMessage: error instanceof Error ? error.message : "Erro desconhecido ao executar comando WhatsApp QR",
            lockedBy: null,
            leaseExpiresAt: null,
            finishedAt: new Date(),
          },
        });
        results.push({ commandId: command.id, companyId: command.companyId, action: command.action, status: "failed_retryable" });
      }
    }

    return results;
  }
}

const managerVersion = 12;
const globalForWhatsApp = globalThis as unknown as {
  whatsappQrSessionManager?: WhatsAppQrSessionManager;
  whatsappQrSessionManagerVersion?: number;
};

export const whatsappQrSessionManager =
  globalForWhatsApp.whatsappQrSessionManager && globalForWhatsApp.whatsappQrSessionManagerVersion === managerVersion
    ? globalForWhatsApp.whatsappQrSessionManager
    : new WhatsAppQrSessionManager();

if (globalForWhatsApp.whatsappQrSessionManager && globalForWhatsApp.whatsappQrSessionManagerVersion !== managerVersion) {
  void globalForWhatsApp.whatsappQrSessionManager.dispose();
}

globalForWhatsApp.whatsappQrSessionManager = whatsappQrSessionManager;
globalForWhatsApp.whatsappQrSessionManagerVersion = managerVersion;
