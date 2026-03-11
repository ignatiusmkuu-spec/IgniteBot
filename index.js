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
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 5000;

let currentQR = null;
let botStatus = "disconnected";
let botPhoneNumber = null;

app.get("/", async (req, res) => {
  let qrImageTag = "";

  if (currentQR) {
    try {
      const qrDataUrl = await QRCode.toDataURL(currentQR);
      qrImageTag = `<img src="${qrDataUrl}" alt="WhatsApp QR Code" style="width:280px;height:280px;" />`;
    } catch (e) {
      qrImageTag = "<p>Error generating QR image. Check the terminal.</p>";
    }
  }

  const statusColor =
    botStatus === "connected"
      ? "#25D366"
      : botStatus === "connecting"
        ? "#FFA500"
        : "#e74c3c";

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IgniteBot — WhatsApp Bot</title>
  <meta http-equiv="refresh" content="5" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #111b21;
      color: #e9edef;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #202c33;
      border-radius: 16px;
      padding: 40px 48px;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    }
    .logo { font-size: 2.4rem; font-weight: 700; color: #25D366; margin-bottom: 6px; }
    .subtitle { font-size: 0.95rem; color: #8696a0; margin-bottom: 28px; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #111b21;
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 0.85rem;
      font-weight: 500;
      margin-bottom: 28px;
    }
    .dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      background: ${statusColor};
    }
    .qr-box {
      background: #fff;
      border-radius: 12px;
      padding: 16px;
      display: inline-block;
      margin-bottom: 20px;
    }
    .instruction {
      font-size: 0.88rem;
      color: #8696a0;
      line-height: 1.6;
    }
    .instruction ol { text-align: left; padding-left: 20px; margin-top: 10px; }
    .instruction li { margin-bottom: 4px; }
    .connected-msg { font-size: 1.05rem; color: #25D366; font-weight: 600; margin-bottom: 12px; }
    .phone { font-size: 0.9rem; color: #8696a0; }
    .commands { margin-top: 28px; text-align: left; }
    .commands h3 { font-size: 0.9rem; color: #25D366; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    .cmd { background: #111b21; border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; font-size: 0.85rem; }
    .cmd span { color: #25D366; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">⚡ IgniteBot</div>
    <div class="subtitle">WhatsApp Bot · Powered by Baileys</div>
    <div class="status-badge">
      <div class="dot"></div>
      ${botStatus === "connected" ? "Connected" : botStatus === "connecting" ? "Connecting…" : "Waiting for QR Scan"}
    </div>

    ${
      botStatus === "connected"
        ? `<div class="connected-msg">✓ Bot is online and ready!</div>
       ${botPhoneNumber ? `<div class="phone">Connected as: +${botPhoneNumber}</div>` : ""}
       <div class="commands">
         <h3>Available Commands</h3>
         <div class="cmd"><span>!ping</span> — Check if bot is alive</div>
         <div class="cmd"><span>!hello</span> — Get a greeting</div>
         <div class="cmd"><span>!help</span> — List all commands</div>
         <div class="cmd"><span>!time</span> — Get current server time</div>
         <div class="cmd"><span>!echo [text]</span> — Echo your message back</div>
       </div>`
        : currentQR
          ? `<div class="qr-box">${qrImageTag}</div>
         <div class="instruction">
           Scan this QR code with WhatsApp to connect the bot.
           <ol>
             <li>Open WhatsApp on your phone</li>
             <li>Tap Menu (⋮) → Linked Devices</li>
             <li>Tap "Link a Device"</li>
             <li>Point your phone camera at this QR code</li>
           </ol>
         </div>`
          : `<div class="instruction">Starting up… QR code will appear shortly.<br/>This page refreshes automatically every 5 seconds.</div>`
    }
  </div>
</body>
</html>`);
});

app.get("/status", (req, res) => {
  res.json({ status: botStatus, phone: botPhoneNumber });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`IgniteBot web server running on port ${PORT}`);
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
      console.log("\n(Or visit the web preview to scan via your camera)\n");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        `Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`
      );
      botStatus = "disconnected";
      currentQR = null;

      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log("Logged out. Delete auth_info_baileys/ folder to re-pair.");
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
      console.log("✅ WhatsApp bot connected successfully!");
      if (botPhoneNumber) {
        console.log(`📞 Connected as: +${botPhoneNumber}`);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;
      if (!msg.message) continue;

      const from = msg.key.remoteJid;
      const isGroup = from.endsWith("@g.us");

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

      if (!body.startsWith("!")) continue;

      const [command, ...args] = body.trim().split(/\s+/);
      const text = args.join(" ");

      console.log(
        `[${isGroup ? "GROUP" : "DM"}] ${from} → ${body}`
      );

      let reply = null;

      switch (command.toLowerCase()) {
        case "!ping":
          reply = "🏓 Pong! Bot is alive.";
          break;

        case "!hello":
          reply = "👋 Hello! I'm IgniteBot, your WhatsApp assistant. Type *!help* to see what I can do.";
          break;

        case "!help":
          reply =
            `*IgniteBot Commands*\n\n` +
            `*!ping* — Check if bot is alive\n` +
            `*!hello* — Get a greeting\n` +
            `*!time* — Get current server time\n` +
            `*!echo [text]* — Echo your message back\n` +
            `*!help* — Show this help message`;
          break;

        case "!time":
          reply = `🕐 Current server time: *${new Date().toUTCString()}*`;
          break;

        case "!echo":
          reply = text
            ? `🔁 ${text}`
            : "⚠️ Please provide some text. Usage: *!echo hello world*";
          break;

        default:
          reply = `❓ Unknown command: *${command}*\nType *!help* to see available commands.`;
          break;
      }

      if (reply) {
        await sock.sendMessage(from, { text: reply }, { quoted: msg });
      }
    }
  });
}

startBot().catch((err) => {
  console.error("Fatal error starting bot:", err);
  process.exit(1);
});
