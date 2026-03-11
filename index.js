const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const QRCode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

const commands = require("./lib/commands");
const groups = require("./lib/groups");
const security = require("./lib/security");
const broadcast = require("./lib/broadcast");
const dashboardRouter = require("./web/dashboard");

const app = express();
const PORT = process.env.PORT || 5000;

let currentQR = null;
let botStatus = "disconnected";
let botPhoneNumber = null;

app.use(express.json());
app.use(dashboardRouter);

app.get("/", async (req, res) => {
  let qrImageTag = "";
  if (currentQR) {
    try {
      const qrDataUrl = await QRCode.toDataURL(currentQR);
      qrImageTag = `<img src="${qrDataUrl}" alt="QR Code" style="width:280px;height:280px;" />`;
    } catch {
      qrImageTag = "<p>Check the terminal for the QR code.</p>";
    }
  }

  const statusColor =
    botStatus === "connected" ? "#25D366" : botStatus === "connecting" ? "#FFA500" : "#e74c3c";

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>IgniteBot — WhatsApp Bot</title>
  <meta http-equiv="refresh" content="5"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#111b21;color:#e9edef;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}
    .card{background:#202c33;border-radius:16px;padding:40px 48px;max-width:480px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)}
    .logo{font-size:2.4rem;font-weight:700;color:#25D366;margin-bottom:6px}
    .subtitle{font-size:0.95rem;color:#8696a0;margin-bottom:24px}
    .status-badge{display:inline-flex;align-items:center;gap:8px;background:#111b21;border-radius:20px;padding:6px 16px;font-size:0.85rem;font-weight:500;margin-bottom:24px}
    .dot{width:10px;height:10px;border-radius:50%;background:${statusColor}}
    .qr-box{background:#fff;border-radius:12px;padding:16px;display:inline-block;margin-bottom:20px}
    .instruction{font-size:0.88rem;color:#8696a0;line-height:1.6}
    .instruction ol{text-align:left;padding-left:20px;margin-top:10px}
    .instruction li{margin-bottom:4px}
    .connected-msg{font-size:1.1rem;color:#25D366;font-weight:600;margin-bottom:12px}
    .features{margin-top:20px;text-align:left;background:#111b21;border-radius:10px;padding:16px}
    .features h3{color:#25D366;font-size:0.85rem;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px}
    .feat-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
    .feat{font-size:0.82rem;color:#8696a0}
    .feat span{color:#e9edef;font-weight:500}
    .btn{display:inline-block;margin-top:16px;padding:10px 24px;background:#25D366;color:#111;border-radius:8px;font-weight:600;text-decoration:none;font-size:0.9rem}
  </style>
</head>
<body>
<div class="card">
  <div class="logo">⚡ IgniteBot</div>
  <div class="subtitle">Full-Featured WhatsApp Bot · 20+ Features</div>
  <div class="status-badge">
    <div class="dot"></div>
    ${botStatus === "connected" ? "Connected & Running" : botStatus === "connecting" ? "Connecting…" : "Waiting for QR Scan"}
  </div>
  ${botStatus === "connected"
    ? `<div class="connected-msg">✓ Bot is online!</div>
       <div style="font-size:0.9rem;color:#8696a0;margin-bottom:16px">Connected as: +${botPhoneNumber || "Unknown"}</div>
       <div class="features">
         <h3>Active Features</h3>
         <div class="feat-grid">
           <div class="feat"><span>🤖 AI Chat</span></div>
           <div class="feat"><span>🎨 Sticker Maker</span></div>
           <div class="feat"><span>📥 Downloader</span></div>
           <div class="feat"><span>🌍 Translator</span></div>
           <div class="feat"><span>🔊 Text-to-Speech</span></div>
           <div class="feat"><span>🖼 Image Generator</span></div>
           <div class="feat"><span>🛒 E-commerce</span></div>
           <div class="feat"><span>📅 Booking</span></div>
           <div class="feat"><span>📢 Broadcast</span></div>
           <div class="feat"><span>🔐 Security</span></div>
           <div class="feat"><span>👥 Group Mgmt</span></div>
           <div class="feat"><span>📊 Analytics</span></div>
         </div>
       </div>
       <a href="/dashboard" class="btn">📊 View Dashboard</a>`
    : currentQR
      ? `<div class="qr-box">${qrImageTag}</div>
         <div class="instruction">
           Scan this QR code with WhatsApp to connect.<br/>
           <ol>
             <li>Open WhatsApp on your phone</li>
             <li>Tap Menu (⋮) → Linked Devices</li>
             <li>Tap "Link a Device"</li>
             <li>Point your camera at the QR code</li>
           </ol>
         </div>`
      : `<div class="instruction">⏳ Starting up...<br/>QR code will appear shortly. Page refreshes automatically.</div>`
  }
</div>
</body>
</html>`);
});

app.get("/status", (req, res) => {
  res.json({ status: botStatus, phone: botPhoneNumber });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ IgniteBot web server running on port ${PORT}`);
});

const AUTH_FOLDER = "./auth_info_baileys";

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: true,
    shouldIgnoreJid: (jid) => isJidBroadcast(jid),
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      botStatus = "connecting";
      console.log("\n📱 Scan the QR code in the web preview to connect:\n");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      botStatus = "disconnected";
      currentQR = null;
      console.log(`Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log("Logged out. Clearing session...");
        if (fs.existsSync(AUTH_FOLDER)) {
          fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        }
        setTimeout(startBot, 1000);
      }
    }

    if (connection === "open") {
      botStatus = "connected";
      currentQR = null;
      const jid = sock.user?.id;
      if (jid) {
        botPhoneNumber = jid.split(":")[0].replace("@s.whatsapp.net", "");
      }
      console.log("✅ WhatsApp bot connected!");
      if (botPhoneNumber) console.log(`📞 Connected as: +${botPhoneNumber}`);
      console.log("⚡ All features active. Type !menu to see commands.");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (msg.key.fromMe) return;
      if (!msg.message) return;

      const from = msg.key.remoteJid;
      const senderJid = msg.key.participant || from;

      if (security.isBanned(senderJid)) return;

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      broadcast.addRecipient(senderJid);

      await commands.handle(sock, msg).catch((err) => {
        console.error("Message handler error:", err.message);
      });
    }
  });

  sock.ev.on("group-participants.update", async ({ id, participants, action }) => {
    if (action === "add") {
      for (const participant of participants) {
        await groups.sendWelcome(sock, id, participant).catch(() => {});
      }
    } else if (action === "remove") {
      for (const participant of participants) {
        await groups.sendGoodbye(sock, id, participant).catch(() => {});
      }
    }
  });

  sock.ev.on("messages.delete", async (item) => {
    if ("keys" in item) {
      for (const key of item.keys) {
        if (!key.remoteJid) continue;
        const isGroup = key.remoteJid.endsWith("@g.us");
        if (!isGroup) continue;
        const settings = security.getGroupSettings(key.remoteJid);
        if (!settings.antiDelete) continue;
        const cached = security.getCachedMessage(key.id);
        if (cached) {
          const original = cached.msg;
          const body =
            original.message?.conversation ||
            original.message?.extendedTextMessage?.text ||
            "";
          if (body) {
            const senderPhone = (key.participant || "").split("@")[0];
            await sock
              .sendMessage(key.remoteJid, {
                text: `🗑 *Deleted message from @${senderPhone}:*\n\n${body}`,
                mentions: [key.participant],
              })
              .catch(() => {});
          }
        }
      }
    }
  });
}

startBot().catch((err) => {
  console.error("Fatal bot error:", err);
  process.exit(1);
});
