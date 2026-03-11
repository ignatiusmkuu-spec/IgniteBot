const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  downloadMediaMessage,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const fs = require("fs");
const path = require("path");

const commands = require("./lib/commands");
const groups = require("./lib/groups");
const security = require("./lib/security");
const broadcast = require("./lib/broadcast");
const settings = require("./lib/settings");
const admin = require("./lib/admin");
const db = require("./lib/db");

const app = express();
const PORT = process.env.PORT || 5000;
const AUTH_FOLDER = "./auth_info_baileys";

let botStatus = "disconnected";
let botPhoneNumber = null;
let sockRef = null;
let alwaysOnlineInterval = null;
let currentSessionId = null;

const SESSION_PREFIX = "NEXUS-MD:~";
const NEXUS_RE = /^NEXUS-MD[^A-Za-z0-9+/]*/;

function encodeSession() {
  try {
    const credsPath = path.join(AUTH_FOLDER, "creds.json");
    if (!fs.existsSync(credsPath)) return null;
    const creds = fs.readFileSync(credsPath, "utf8");
    return SESSION_PREFIX + Buffer.from(creds).toString("base64");
  } catch {
    return null;
  }
}

function restoreSession(sessionId) {
  try {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });

    // Any NEXUS-MD prefix (NEXUS-MD:~, NEXUS-MD::, NEXUS-MD: etc.)
    if (sessionId.startsWith("NEXUS-MD")) {
      const b64 = sessionId.replace(NEXUS_RE, "");
      const creds = Buffer.from(b64, "base64").toString("utf8");
      JSON.parse(creds); // validate JSON before writing
      fs.writeFileSync(path.join(AUTH_FOLDER, "creds.json"), creds);
      console.log("✅ Session restored from NEXUS-MD session ID");
      return true;
    }

    // Legacy multi-file format — base64 of { filename: base64content }
    const files = JSON.parse(Buffer.from(sessionId, "base64").toString("utf8"));
    for (const [name, content] of Object.entries(files)) {
      const filePath = path.join(AUTH_FOLDER, name);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(content, "base64"));
    }
    console.log("✅ Session restored from legacy SESSION_ID");
    return true;
  } catch (err) {
    console.error("❌ Failed to restore session:", err.message);
    return false;
  }
}

// Always restore NEXUS-MD sessions (overwrite existing auth to stay fresh)
// For other formats, only restore if auth folder is missing
if (process.env.SESSION_ID) {
  const isNexus = process.env.SESSION_ID.startsWith("NEXUS-MD");
  if (isNexus || !fs.existsSync(AUTH_FOLDER)) {
    console.log("📦 Restoring WhatsApp session from SESSION_ID...");
    restoreSession(process.env.SESSION_ID);
  }
}

app.use(express.json());

app.get("/", (req, res) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
  res.json({
    bot: "IgniteBot",
    status: botStatus,
    phone: botPhoneNumber ? "+" + botPhoneNumber : null,
    uptime: `${h}h ${m}m ${s}s`,
    session_format: "NEXUS-MD:~",
    tip: "Set SESSION_ID env var with a NEXUS-MD:~ session to connect",
  });
});

app.get("/status", (req, res) => {
  res.json({ status: botStatus, phone: botPhoneNumber, mode: settings.get("mode") });
});

app.get("/api/session", (req, res) => {
  const sid = encodeSession();
  currentSessionId = sid;
  res.json({ sessionId: sid, connected: botStatus === "connected", phone: botPhoneNumber });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ IgniteBot running on port ${PORT}`);
});


async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();
  const pinoBase = pino({ level: "silent" });
  const logger = Object.create(pinoBase);
  const _noisy = /Bad MAC|decrypt|session_cipher|libsignal|Session error|queue_job/i;
  for (const lvl of ["trace","debug","info","warn","error","fatal"]) {
    logger[lvl] = (...a) => {
      const msg = typeof a[0] === "string" ? a[0] : JSON.stringify(a[0]);
      if (_noisy.test(msg)) return;
      pinoBase[lvl]?.(...a);
    };
  }
  logger.child = () => logger;

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
    markOnlineOnConnect: true,
    retryRequestDelayMs: 2000,
    getMessage: async () => undefined,
  });

  sockRef = sock;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      botStatus = "disconnected";
      sockRef = null;
      if (alwaysOnlineInterval) { clearInterval(alwaysOnlineInterval); alwaysOnlineInterval = null; }
      console.log(`🔌 Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log("⚠️ Logged out. Clearing session and restarting...");
        if (fs.existsSync(AUTH_FOLDER)) fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        setTimeout(startBot, 1000);
      }
    }

    if (connection === "open") {
      botStatus = "connected";
      sockRef = sock;
      const jid = sock.user?.id;
      if (jid) botPhoneNumber = jid.split(":")[0].replace("@s.whatsapp.net", "");
      currentSessionId = encodeSession();
      console.log("✅ WhatsApp connected!");
      console.log(`📞 Phone: +${botPhoneNumber}`);
      if (currentSessionId) {
        console.log(`🔑 Session ID: ${currentSessionId.slice(0, 30)}...`);
        console.log("💡 Set SESSION_ID env var with this value to auto-connect on restart");
      }
      console.log(`⚡ Bot ready — prefix: ${require("./lib/settings").get("prefix") || "."} | Type .menu`);

      if (alwaysOnlineInterval) clearInterval(alwaysOnlineInterval);
      alwaysOnlineInterval = setInterval(async () => {
        if (settings.get("alwaysOnline") && sock) {
          await sock.sendPresenceUpdate("available").catch(() => {});
        }
      }, 30000);
    }
  });

  sock.ev.on("creds.update", () => {
    saveCreds();
    currentSessionId = encodeSession();
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const from = msg.key.remoteJid;
      const senderJid = msg.key.participant || from;

      if (security.isBanned(senderJid)) continue;

      if (from === "status@broadcast") {
        if (settings.get("antiDeleteStatus")) security.cacheStatus(msg.key.id, msg);
        if (settings.get("autoViewStatus")) await sock.readMessages([msg.key]).catch(() => {});
        if (settings.get("autoLikeStatus")) {
          const statusOwner = msg.key.participant || senderJid;
          await sock.sendMessage(
            statusOwner,
            { react: { text: "❤️", key: msg.key } },
            { statusJidList: [statusOwner, sock.user?.id].filter(Boolean) }
          ).catch(() => {});
        }
        continue;
      }

      broadcast.addRecipient(senderJid);
      await commands.handle(sock, msg).catch((err) => {
        console.error("Message handler error:", err.message);
      });
    }
  });

  sock.ev.on("call", async ([call]) => {
    if (!settings.get("antiCall")) return;
    try {
      await sock.rejectCall(call.id, call.from);
      await sock.sendMessage(call.from, {
        text: "📵 *Auto-reject:* I don't accept calls. Please send a message instead.",
      });
      console.log(`📵 Rejected call from ${call.from}`);
    } catch (err) {
      console.error("Anti-call error:", err.message);
    }
  });

  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    if (action === "add") {
      for (const p of participants) await groups.sendWelcome(sock, id, p).catch(() => {});
    } else if (action === "remove") {
      for (const p of participants) await groups.sendGoodbye(sock, id, p).catch(() => {});
    }
  });

  sock.ev.on("messages.delete", async (item) => {
    if (!("keys" in item)) return;
    for (const key of item.keys) {
      if (!key.remoteJid) continue;

      if (key.remoteJid === "status@broadcast" && settings.get("antiDeleteStatus")) {
        const cached = security.getCachedStatus(key.id);
        if (cached && botPhoneNumber) {
          const adminJid = `${botPhoneNumber}@s.whatsapp.net`;
          const originalMsg = cached.msg;
          const msgType = Object.keys(originalMsg.message || {})[0];
          const ownerPhone = (key.participant || "").split("@")[0];
          try {
            if (msgType === "conversation" || msgType === "extendedTextMessage") {
              const text = originalMsg.message?.conversation || originalMsg.message?.extendedTextMessage?.text;
              if (text) await sock.sendMessage(adminJid, { text: `🗑 *Deleted Status from @${ownerPhone}:*\n\n${text}` });
            } else if (msgType === "imageMessage" || msgType === "videoMessage") {
              const mediaBuf = await downloadMediaMessage(originalMsg, "buffer", {}).catch(() => null);
              if (mediaBuf) {
                const isVideo = msgType === "videoMessage";
                await sock.sendMessage(adminJid, {
                  [isVideo ? "video" : "image"]: mediaBuf,
                  caption: `🗑 *Deleted ${isVideo ? "video" : "image"} status from @${ownerPhone}*`,
                });
              }
            }
          } catch (err) { console.error("Anti-delete status error:", err.message); }
        }
        continue;
      }

      if (!key.remoteJid.endsWith("@g.us")) continue;
      const grpSettings = security.getGroupSettings(key.remoteJid);
      if (!grpSettings.antiDelete) continue;
      const cached = security.getCachedMessage(key.id);
      if (!cached) continue;
      const original = cached.msg;
      const body = original.message?.conversation || original.message?.extendedTextMessage?.text || "";
      const senderPhone = (key.participant || "").split("@")[0];
      if (body) {
        await sock.sendMessage(key.remoteJid, {
          text: `🗑 *Deleted message from @${senderPhone}:*\n\n${body}`,
          mentions: [key.participant],
        }).catch(() => {});
      } else {
        const msgType = Object.keys(original.message || {})[0];
        if (msgType === "imageMessage" || msgType === "videoMessage") {
          try {
            const mediaBuf = await downloadMediaMessage(original, "buffer", {});
            const isVideo = msgType === "videoMessage";
            await sock.sendMessage(key.remoteJid, {
              [isVideo ? "video" : "image"]: Buffer.from(mediaBuf),
              caption: `🗑 *Deleted ${isVideo ? "video" : "image"} from @${senderPhone}*`,
              mentions: [key.participant],
            }).catch(() => {});
          } catch {}
        }
      }
    }
  });

  sock.ev.on("presences.update", ({ id, presences }) => {
    for (const [jid, presence] of Object.entries(presences)) {
      if (presence.lastKnownPresence === "composing") {
        console.log(`✏️ ${jid.split("@")[0]} is typing in ${id.split("@")[0]}...`);
      }
    }
  });
}

db.init()
  .then(() => startBot())
  .catch((err) => {
    console.error("Fatal bot error:", err);
    process.exit(1);
  });
