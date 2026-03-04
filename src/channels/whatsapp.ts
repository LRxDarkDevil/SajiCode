import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  type WASocket,
  type BaileysEventMap,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const qrcode = require("qrcode-terminal");
import path from "path";
import os from "os";
import chalk from "chalk";
import type { ChannelAdapter, ChannelMessage } from "./channel.js";
import type { WhatsAppConfig } from "../types/index.js";

const GLOBAL_SAJICODE_DIR = path.join(os.homedir(), ".sajicode");
const AUTH_DIR = path.join(GLOBAL_SAJICODE_DIR, "whatsapp-auth");
const MAX_MESSAGE_LENGTH = 4096;

export class WhatsAppAdapter implements ChannelAdapter {
  readonly name = "whatsapp";
  private socket: WASocket | null = null;
  private handler: ((msg: ChannelMessage) => void) | null = null;
  private authDir: string;
  private recentlySentIds = new Set<string>();
  private config: WhatsAppConfig;

  constructor(_projectPath: string, config: WhatsAppConfig) {
    this.authDir = AUTH_DIR;
    this.config = config;
  }

  onMessage(handler: (msg: ChannelMessage) => void): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    // Silent logger to suppress Baileys' verbose JSON output
    const silentLogger = {
      level: "silent",
      child: () => silentLogger,
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
    } as any;

    const socket = makeWASocket({
      version,
      logger: silentLogger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      syncFullHistory: false,
    });

    this.socket = socket;

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("");
        console.log(chalk.hex("#FF8C00").bold("  📱 WhatsApp — Scan QR Code"));
        console.log(chalk.gray("  Open WhatsApp → Settings → Linked Devices → Link a Device"));
        console.log("");
        qrcode.generate(qr, { small: true }, (code: string) => {
          const lines = code.split("\n");
          for (const line of lines) {
            console.log(`  ${line}`);
          }
        });
        console.log("");
      }

      if (connection === "close") {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(chalk.yellow("  ⚡ WhatsApp disconnected, reconnecting..."));
          this.start();
        } else {
          console.log(chalk.red("  ✗ WhatsApp logged out. Delete .sajicode/whatsapp-auth/ and restart to re-link."));
        }
      }

      if (connection === "open") {
        const name = socket.user?.name ?? "Unknown";
        console.log(chalk.green(`  ✓ WhatsApp connected as ${name}`));
        console.log(chalk.gray(`    Send a message to this number to interact with SajiCode`));
        console.log("");
      }
    });

    socket.ev.on("messages.upsert" as keyof BaileysEventMap, (upsert: any) => {
      if (upsert.type !== "notify") return;

      for (const msg of upsert.messages) {
        if (!msg.message) continue;

        const msgId = msg.key.id ?? "";
        if (this.recentlySentIds.has(msgId)) continue;

        // Skip status broadcast messages
        if (msg.key.remoteJid === "status@broadcast") continue;

        // Mode-based filtering:
        // admin  → only process messages sent BY the user (fromMe)
        // personal → only process messages FROM contacts (not fromMe)
        const isFromMe = msg.key.fromMe === true;
        if (this.config.mode === "admin" && !isFromMe) continue;
        if (this.config.mode === "personal" && isFromMe) continue;

        const text = this.extractText(msg);
        if (!text) continue;

        const senderId = msg.key.remoteJid ?? "";
        const senderName = msg.pushName ?? senderId.split("@")[0] ?? "Unknown";
        const threadId = `wa-${senderId}`;

        console.log(chalk.hex("#25D366")(`  📱 WhatsApp message from ${senderName}: ${text.slice(0, 60)}${text.length > 60 ? "..." : ""}`));

        const channelMsg: ChannelMessage = {
          channel: "whatsapp",
          senderId,
          senderName,
          text,
          threadId,
          timestamp: (msg.messageTimestamp as number) * 1000 || Date.now(),
          reply: async (response: string) => {
            await this.sendMessage(senderId, response);
          },
        };

        if (this.handler) {
          this.handler(channelMsg);
        }
      }
    });
  }

  async stop(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
  }

  private extractText(msg: any): string | null {
    const m = msg.message;
    if (!m) return null;

    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    if (m.documentMessage?.caption) return m.documentMessage.caption;

    return null;
  }

  private async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.socket) return;

    if (text.length <= MAX_MESSAGE_LENGTH) {
      const sent = await this.socket.sendMessage(jid, { text });
      this.trackSentId(sent?.key?.id);
      return;
    }

    const chunks = this.chunkText(text, MAX_MESSAGE_LENGTH);
    for (const chunk of chunks) {
      const sent = await this.socket.sendMessage(jid, { text: chunk });
      this.trackSentId(sent?.key?.id);
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  private trackSentId(id: string | undefined | null): void {
    if (!id) return;
    this.recentlySentIds.add(id);
    setTimeout(() => this.recentlySentIds.delete(id), 30_000);
  }

  private chunkText(text: string, maxLen: number): string[] {
    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }

      // Try to break at a newline
      let breakIdx = remaining.lastIndexOf("\n", maxLen);
      if (breakIdx < maxLen * 0.5) {
        // No good newline break, try space
        breakIdx = remaining.lastIndexOf(" ", maxLen);
      }
      if (breakIdx < maxLen * 0.3) {
        breakIdx = maxLen;
      }

      chunks.push(remaining.substring(0, breakIdx));
      remaining = remaining.substring(breakIdx).trimStart();
    }

    return chunks;
  }
}
