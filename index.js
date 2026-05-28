// Auto-load .env file if present (panels / VPS / local dev — no-op on Heroku)
try { require("dotenv").config({ quiet: true }); } catch {}

// Ensure the pairing site URL is always available to every module (including
// the obfuscated commands handler) before any require() calls run below.
if (!process.env.PAIR_SITE_URL) {
  process.env.PAIR_SITE_URL = "https://nexus-session-76ah.onrender.com";
}

// ── Apply Baileys patches BEFORE the first require('@whiskeysockets/baileys') ──
// This ensures the msmsg + shouldIgnoreJid filters are stripped from Baileys
// internals on EVERY bot startup — including Heroku dynos where postinstall
// may have been skipped due to build-cache hits.
try { require("./scripts/apply-baileys-patches"); } catch (_pErr) {
  console.warn("[startup-patch] Could not apply Baileys patches:", _pErr.message);
}

// Hint for libuv thread pool (effective when set before process start via Procfile)
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "8";

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  isJidBroadcast,
  downloadMediaMessage,
  normalizeMessageContent,
  getContentType,
} = require('@whiskeysockets/baileys');
const express = require("express");
const fs = require("fs");
const path = require("path");

const commands = require("./lib/commands");
const groups = require("./lib/groups");
const security = require("./lib/security");
const handleProtocolMessage = require("./lib/antidelete");
const broadcast = require("./lib/broadcast");
const settings = require("./lib/settings");
const admin = require("./lib/admin");
const db = require("./lib/db");
const platform = require("./lib/platform");
const premium = require("./lib/premium");
const axios = require("axios");
const downloader = require("./lib/downloader");
const dataPkgs   = require("./lib/data_packages");
const pluginLoader = require("./lib/loader");

// ── xwolf.space API helpers ──────────────────────────────────────────────────
const XWOLF_BASE = "https://apis.xwolf.space";
const _XWOLF_AUDIO_EPS = ["yta2","mp3","audio","dlmp3","ytmp3","yta","yta3"];
const _XWOLF_VIDEO_EPS = ["hd","dlmp4","video","ytmp4","mp4"];

async function _xwolfSearch(query) {
  const res = await axios.get(
    `${XWOLF_BASE}/api/search?q=${encodeURIComponent(query)}`,
    { timeout: 20000 }
  );
  const items = res.data?.items || [];
  if (!items.length) throw new Error("No search results found.");
  return { url: `https://www.youtube.com/watch?v=${items[0].id}`, title: items[0].title || query };
}

async function _xwolfAudio(videoUrl, songTitle) {
  for (const ep of _XWOLF_AUDIO_EPS) {
    try {
      const res = await axios.get(
        `${XWOLF_BASE}/download/${ep}?url=${encodeURIComponent(videoUrl)}&q=${encodeURIComponent(songTitle)}`,
        { timeout: 60000 }
      );
      const d = res.data;
      const payload = d?.mp3 || d; // ytmp5 returns nested {mp3,mp4}
      if (payload?.success && payload?.downloadUrl) return payload;
    } catch {}
  }
  throw new Error("All audio download endpoints failed. Please try again later.");
}

async function _xwolfVideo(videoUrl, videoTitle) {
  for (const ep of _XWOLF_VIDEO_EPS) {
    try {
      const res = await axios.get(
        `${XWOLF_BASE}/download/${ep}?url=${encodeURIComponent(videoUrl)}&q=${encodeURIComponent(videoTitle)}`,
        { timeout: 60000 }
      );
      const d = res.data;
      const payload = d?.mp4 || d; // ytmp5 returns nested {mp3,mp4}
      if (payload?.success && payload?.downloadUrl) return payload;
    } catch {}
  }
  throw new Error("All video download endpoints failed. Please try again later.");
}

// ── Download status bar builder ──────────────────────────────────────────────
function _buildCombinedBar(query, title, type) {
  const isVideo = type === "video";
  const emoji   = isVideo ? "🎬" : "🎵";
  const fmt     = isVideo ? "MP4 · 720p" : "MP3 · 320kbps";
  return [
    `⚡ *𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥* ⚡`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `🔎  *${query}*`,
    `✅  ${emoji} *${title}*`,
    ``,
    `▰▰▰▰▰▰▰▰▰▰▱▱▱▱▱  *70%*`,
    `📡  Fetching · ${fmt}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    `_𝗣𝗼𝘄𝗲𝗿𝗲𝗱 𝗯𝘆 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗_`,
  ].join("\n");
}

function _buildFileDone(title, type, quality) {
  const isVideo = type === "video";
  const emoji   = isVideo ? "🎬" : "🎵";
  const fmt     = quality || (isVideo ? "MP4 · 720p" : "MP3 · 320kbps");
  return `${emoji} *${title}*\n🎯 ${fmt}  ·  ⚡ *𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗 𝗕𝗬 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗*`;
}

const app = express();
const PORT = process.env.PORT || 5000;
const AUTH_FOLDER = "./auth_info_baileys";

// ── Heroku app name / URL resolver ───────────────────────────────────────────
// HEROKU_APP_NAME is only auto-set when the Heroku dyno-metadata lab is enabled.
// Users may not have that lab. As a permanent fallback:
//   1. Honour HEROKU_APP_NAME if present (env var or dyno-metadata).
//   2. Parse APP_URL — if it points to *.herokuapp.com, extract the app name.
//   3. Return null if neither is available (user should set APP_URL).
function _resolveHerokuAppName() {
  if (process.env.HEROKU_APP_NAME) return process.env.HEROKU_APP_NAME;
  const url = process.env.APP_URL || "";
  const m = url.match(/^https?:\/\/([a-z0-9-]+)\.herokuapp\.com/i);
  return m ? m[1] : null;
}
function _resolveAppUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const appName = _resolveHerokuAppName();
  if (appName) return `https://${appName}.herokuapp.com`;
  return null;
}

// ── Ignatius Perez AI Persona ─────────────────────────────────────────────────
// Injected as system context into every AI chatbot call.
// Change this to customize the bot's personality and expertise.
const _AI_PERSONA = `You are an elite AI assistant embedded inside a WhatsApp bot built specifically for Ignatius Perez, a software engineer focused on automation, bot development, APIs, and scalable digital systems. You are not a general assistant. You are a technical co-builder, systems architect, and growth strategist.

You think like a senior developer, hacker, and entrepreneur combined. You prioritize execution over explanation and assume every request is meant for real-world deployment. You focus on performance, scalability, efficiency, and maintainability in every response.

You operate inside a WhatsApp bot environment. All responses must be fast, structured, mobile-friendly, and practical. Avoid long paragraphs unless necessary. Prefer commands, code snippets, structured outputs, and clean formatting. Assume integration with Baileys or WhatsApp Web API, Node.js or Python backends, and databases like MongoDB, Firebase, or MySQL.

LANGUAGE HANDLING:
- Detect the user's language automatically.
- Respond in the same language the user used.
- Do NOT mix languages unless the user does.
- For technical responses, keep code and keywords in English, but explanations follow the detected language.
- Keep Kiswahili responses natural, modern, and clear.

Always upgrade the user's request. If the request is basic, improve it, optimize it, and make it production-ready. Add automation, scalability, and better logic automatically.

Your default response structure: Quick answer → Implementation (code or logic) → Optional upgrades.

Always provide ready-to-use outputs. Avoid unnecessary theory. When building systems, think: Architecture, Performance, Security, Scalability.

You are highly skilled in: WhatsApp bot development (Baileys, MD bots), Telegram bots, Command handlers, Anti-delete and anti-view-once systems, Admin/moderation tools, Website development, API integrations, Scraping and automation, AI prompt engineering, Growth and monetization systems.

Response style: Clean, Direct, Structured, Slightly assertive, Focused on results.`;

// ── Chatbot helpers: per-chat enable/disable + global toggle ─────────────────
const _cbKey = (jid) => `aiChat_${jid}`;

function _isChatbotOn(jid) {
  const global = settings.get("aiChatGlobal") === true || settings.get("aiChatGlobal") === "on";
  if (global) return true;
  return db.read(_cbKey(jid), { enabled: false }).enabled === true;
}

function _setChatbot(jid, on) {
  db.write(_cbKey(jid), { enabled: on });
}

// ── AI API call with persona injection ───────────────────────────────────────
async function _callAI(userText) {
  const groqKey  = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  // Groq — fastest, supports system prompt natively
  if (groqKey) {
    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama3-8b-8192",
        messages: [
          { role: "system",  content: _AI_PERSONA },
          { role: "user",    content: userText },
        ],
        max_tokens: 800,
        temperature: 0.7,
      },
      { headers: { Authorization: `Bearer ${groqKey}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    return res.data?.choices?.[0]?.message?.content?.trim() || null;
  }

  // OpenAI — fallback if key set
  if (openaiKey) {
    const res = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: _AI_PERSONA },
          { role: "user",   content: userText },
        ],
        max_tokens: 800,
      },
      { headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" }, timeout: 30000 }
    );
    return res.data?.choices?.[0]?.message?.content?.trim() || null;
  }

  // Public fallback — prepend a compressed persona snippet to steer the response
  const contextPrefix = "You are an elite technical AI co-builder for Ignatius Perez (software engineer, automation & bots). Be concise, structured, and production-ready. ";
  const res = await axios.get(
    `https://apiskeith.top/ai/gpt4?q=${encodeURIComponent(contextPrefix + userText)}`,
    { timeout: 30000 }
  );
  return res.data?.result || res.data?.message || res.data?.reply || null;
}

// External pairing site — users visit this to generate a SESSION_ID
const PAIR_SITE_URL = process.env.PAIR_SITE_URL || "https://nexus-session-76ah.onrender.com";

let botStatus = "disconnected";
let botPhoneNumber = null;
let sockRef = null;
let alwaysOnlineInterval = null;
let sessionPersistInterval = null;   // periodic full auth-folder → DB save
let currentSessionId = null;
let reconnectAttempts = 0;
let consecutive408s   = 0;           // counts consecutive 408/timedOut failures — stops infinite loop
let waitingForSession = false;       // true when no creds exist — don't auto-reconnect
let isShuttingDown = false;          // set on SIGTERM to prevent reconnect loops during shutdown
let isConnecting = false;            // guard — prevents two startnexus() calls running in parallel
let aliveSent = false;               // guard — send "Master, am alive!" only on first connect
const _autoAddedCache = new Set();   // track users already added this session → avoid repeat attempts

const SESSION_PREFIX = "NEXUS-MD:~";
const NEXUS_RE = /^NEXUS-MD[^A-Za-z0-9+/=]*/;

let pairingCode = null;
let pairingPhone = null;

function encodeSession() {
  try {
    if (!fs.existsSync(AUTH_FOLDER)) return null;
    const files = fs.readdirSync(AUTH_FOLDER).filter(f => f.endsWith(".json"));
    if (!files.length) return null;
    // Build a multi-file map so ALL signal keys survive a dyno/container restart,
    // not just creds.json. Missing signal keys cause WhatsApp to force-logout.
    const map = {};
    for (const file of files) {
      const buf = fs.readFileSync(path.join(AUTH_FOLDER, file));
      map[file] = buf.toString("base64");
    }
    if (!map["creds.json"]) return null;
    return SESSION_PREFIX + Buffer.from(JSON.stringify(map)).toString("base64");
  } catch {
    return null;
  }
}

// Normalise known short-link hosts to their raw/download equivalents
function normaliseUrl(url) {
  // Pastebin  → raw (always https)
  url = url.replace(/^https?:\/\/pastebin\.com\/(?!raw\/)([A-Za-z0-9]+)$/, "https://pastebin.com/raw/$1");
  // GitHub Gist share page → raw (always https)
  url = url.replace(/^https?:\/\/gist\.github\.com\/([^/]+\/[a-f0-9]+)\/?$/, "https://gist.github.com/$1/raw");
  // GitHub blob → raw.githubusercontent.com (always https)
  url = url.replace(/^https?:\/\/github\.com\/(.+?)\/blob\/(.+)$/, "https://raw.githubusercontent.com/$1/$2");
  return url;
}

// Guard: reject non-https and private/internal addresses (SSRF protection)
function assertSafeUrl(rawUrl) {
  let parsed;
  try { parsed = new URL(rawUrl); } catch { throw new Error("Invalid URL"); }
  if (parsed.protocol !== "https:") throw new Error("Only https:// URLs are accepted");
  const host = parsed.hostname.toLowerCase();
  // Block localhost variants
  if (host === "localhost" || host === "::1") throw new Error("Private host not allowed");
  // Block .local mDNS
  if (host.endsWith(".local")) throw new Error("Private host not allowed");
  // Block private / link-local IPv4 ranges
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 10 ||                         // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) ||          // 192.168.0.0/16
      (a === 127) ||                       // 127.0.0.0/8 loopback
      (a === 169 && b === 254) ||          // 169.254.0.0/16 link-local
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 CGNAT
      a === 0                             // 0.0.0.0/8
    ) throw new Error("Private/reserved IP not allowed");
  }
  // Block IPv6 private ranges (simplified)
  if (host.startsWith("[")) {
    const inner = host.slice(1, -1).toLowerCase();
    if (inner === "::1" || inner.startsWith("fc") || inner.startsWith("fd") || inner.startsWith("fe80")) {
      throw new Error("Private/link-local IPv6 not allowed");
    }
  }
}

// Fetch text from a safe https:// URL
async function fetchUrl(url) {
  assertSafeUrl(url);
  const res = await axios.get(url, {
    responseType: "text",
    timeout: 15000,
    maxRedirects: 5,
    // Validate each redirect target too
    beforeRedirect: (_opts, { headers }) => {
      const location = headers.location;
      if (location) assertSafeUrl(new URL(location, url).href);
    }
  });
  return String(res.data).trim();
}

// Write creds.json from a raw JSON string or base64-encoded JSON string.
// Strips any known bot prefix before decoding.
function writeCreds(raw) {
  const stripped = raw.replace(NEXUS_RE, "").trim();
  let json;
  try {
    json = JSON.parse(stripped);
  } catch {
    const decoded = Buffer.from(stripped, "base64").toString("utf8");
    json = JSON.parse(decoded);
  }
  // Validate it looks like Baileys creds
  if (!json || typeof json !== "object") throw new Error("Not a valid creds object");
  fs.mkdirSync(AUTH_FOLDER, { recursive: true });
  fs.writeFileSync(path.join(AUTH_FOLDER, "creds.json"), JSON.stringify(json));
}

// ── Universal session restorer ───────────────────────────────────────────────
// Accepts (in order of attempt):
//   1. NEXUS-MD:~ prefixed base64/URL sessions
//   2. Any https:// URL — fetches content then recurses
//   3. Raw JSON string  { noiseKey: {...}, ... }
//   4. Plain base64-encoded creds.json
//   5. Legacy multi-file base64 map { "creds.json": "<b64>", ... }
//   6. Any other known bot prefix (WAMD:, TENNOR:, etc.) stripped then treated as base64
// Returns true when the string looks like a recognisable session (text-based).
// Binary blobs (e.g. an mp3 file contents) are rejected early so we skip all
// the decode attempts and show a clear error instead of a confusing JSON parse failure.
function isValidSessionString(s) {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (!t.length) return false;

  // ── Minimum length check ──────────────────────────────────────────────────
  // Real NEXUS-MD sessions are large (the creds.json alone is several KB, and
  // we base64-encode the entire auth folder). Any string shorter than 200 chars
  // is either a placeholder, an incomplete paste, or a non-session value.
  if (t.length < 200) return false;

  // ── Placeholder / example-value detection ─────────────────────────────────
  // Catches common copy-paste mistakes where the user left the template value
  // from .env.example or the README in place instead of a real session.
  const _PLACEHOLDERS = [
    "paste_your_session_here",
    "your_session_here",
    "session_here",
    "nexus-md:~paste",
    "<session",
    "xxxxxxx",
  ];
  const tLower = t.toLowerCase();
  if (_PLACEHOLDERS.some(p => tLower.includes(p))) return false;

  // ── Binary / non-printable character check ────────────────────────────────
  // A valid session string is entirely ASCII printable text (base64, JSON, URLs).
  // Reject if more than 2 % of the first 500 chars are outside the printable ASCII
  // range (9=tab, 10=LF, 13=CR, 32-126 printable) — this catches binary blobs,
  // UTF-8 multi-byte sequences, and BOM/replacement characters (\uFFFD etc.).
  const sample = t.slice(0, 500);
  let badBytes = 0;
  for (let i = 0; i < sample.length; i++) {
    const c = sample.charCodeAt(i);
    const isPrintableAscii = c === 9 || c === 10 || c === 13 || (c >= 32 && c <= 126);
    if (!isPrintableAscii) badBytes++;
  }
  if (badBytes / sample.length > 0.02) return false;
  return true;
}

async function restoreSession(sessionId) {
  try {
    fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    const id = (sessionId || "").trim();

    // Reject obviously corrupted / binary session data before trying any decoder.
    if (!isValidSessionString(id)) {
      throw new Error("Session value contains binary or non-printable data — likely corrupted. Please provide a valid NEXUS-MD:~ session string.");
    }

    // ── 1. NEXUS-MD prefixed ──────────────────────────────────────────────
    if (id.startsWith("NEXUS-MD")) {
      const afterPrefix = id.replace(NEXUS_RE, "").trim();

      // URL variant: NEXUS-MD:~https://...
      if (/^https:\/\//i.test(afterPrefix)) {
        const rawUrl = normaliseUrl(afterPrefix);
        console.log(`🌐 Fetching session from URL: ${rawUrl}`);
        const fetched = await fetchUrl(rawUrl);
        return await restoreSession(fetched);   // recurse with fetched content
      }

      // Decode base64 payload and detect format
      try {
        const decoded = Buffer.from(afterPrefix, "base64").toString("utf8");
        const parsed  = JSON.parse(decoded);
        if (typeof parsed === "object" && !Array.isArray(parsed)) {
          // ── Multi-file map: { "creds.json": "<b64>", "app-state-...": "<b64>", ... }
          if (parsed["creds.json"]) {
            for (const [name, content] of Object.entries(parsed)) {
              const filePath = path.join(AUTH_FOLDER, name);
              fs.mkdirSync(path.dirname(filePath), { recursive: true });
              fs.writeFileSync(filePath, Buffer.from(String(content), "base64"));
            }
            console.log(`✅ Session restored (NEXUS-MD multi-file, ${Object.keys(parsed).length} files)`);
            return true;
          }
          // ── Raw creds.json object encoded as base64 after the prefix
          // Format: NEXUS-MD:~eyJ{base64 of raw creds JSON}
          // Detected by presence of Baileys creds fields at the top level.
          if (parsed.noiseKey || parsed.signedIdentityKey || parsed.registered !== undefined || parsed.me) {
            fs.mkdirSync(AUTH_FOLDER, { recursive: true });
            fs.writeFileSync(path.join(AUTH_FOLDER, "creds.json"), JSON.stringify(parsed));
            console.log("✅ Session restored (NEXUS-MD creds format)");
            return true;
          }
        }
      } catch { /* not base64 JSON — fall through to writeCreds */ }

      // Legacy: afterPrefix is a raw JSON string or other encodable form
      writeCreds(afterPrefix);
      console.log("✅ Session restored (NEXUS-MD format)");
      return true;
    }

    // ── 2. Bare https:// URL ──────────────────────────────────────────────
    if (/^https:\/\//i.test(id)) {
      const rawUrl = normaliseUrl(id);
      console.log(`🌐 Fetching session from URL: ${rawUrl}`);
      const fetched = await fetchUrl(rawUrl);
      return await restoreSession(fetched);     // recurse with fetched content
    }

    // ── 3. JSON API response wrapping a session ───────────────────────────
    //    e.g. { sessionId: "NEXUS-MD...", ... } or { session: "...", creds: {...} }
    try {
      const parsed = JSON.parse(id);
      const inner = parsed.sessionId || parsed.session || parsed.id || parsed.key;
      if (inner && typeof inner === "string") {
        console.log("📡 Extracted session from JSON wrapper");
        return await restoreSession(inner);
      }
      // Raw creds object itself
      if (parsed.noiseKey || parsed.signedIdentityKey || parsed.me || parsed.registered) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        fs.writeFileSync(path.join(AUTH_FOLDER, "creds.json"), JSON.stringify(parsed));
        console.log("✅ Session restored (raw JSON creds)");
        return true;
      }
    } catch { /* not JSON — continue */ }

    // ── 4. Plain base64 → creds.json ─────────────────────────────────────
    try {
      const decoded = Buffer.from(id, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      // Could be raw creds or a multi-file map
      if (parsed.noiseKey || parsed.signedIdentityKey || parsed.me || parsed.registered) {
        fs.mkdirSync(AUTH_FOLDER, { recursive: true });
        fs.writeFileSync(path.join(AUTH_FOLDER, "creds.json"), JSON.stringify(parsed));
        console.log("✅ Session restored (base64 creds)");
        return true;
      }
      // ── 5. Legacy multi-file map { "creds.json": "<b64>", ... } ──────
      if (typeof parsed === "object" && !Array.isArray(parsed)) {
        const keys = Object.keys(parsed);
        if (keys.some(k => k.endsWith(".json") || k === "creds")) {
          for (const [name, content] of Object.entries(parsed)) {
            const filePath = path.join(AUTH_FOLDER, name);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, Buffer.from(String(content), "base64"));
          }
          console.log("✅ Session restored (legacy multi-file format)");
          return true;
        }
      }
    } catch { /* not base64 JSON — continue */ }

    // ── 6. Other bot prefixes (WAMD:, TENNOR:, etc.) ─────────────────────
    const OTHER_PREFIX_RE = /^[A-Z][A-Z0-9_-]{1,15}[^A-Za-z0-9+/=]*/;
    if (OTHER_PREFIX_RE.test(id)) {
      const stripped = id.replace(OTHER_PREFIX_RE, "").trim();
      console.log("🔄 Stripped unknown prefix — retrying...");
      return await restoreSession(stripped);
    }

    throw new Error("Could not recognise session format. Tried: NEXUS-MD, URL, JSON, base64, multi-file, prefixed.");
  } catch (err) {
    console.error("❌ Failed to restore session:", err.message);
    return false;
  }
}

app.use(express.json());
app.use(require("./web/dashboard"));

app.get("/", (req, res) => {
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = Math.floor(uptime % 60);
  res.json({
    bot: "NEXUS-MD",
    status: botStatus,
    phone: botPhoneNumber ? "+" + botPhoneNumber : null,
    uptime: `${h}h ${m}m ${s}s`,
    session_format: "universal (NEXUS-MD, base64, raw JSON, https:// URL)",
    tip: botStatus !== "connected"
      ? `Not connected. 1) Visit ${PAIR_SITE_URL} to get a session. 2) POST any valid Baileys session to /session: curl -X POST /session -H 'Content-Type:application/json' -d '{"session":"<your-session-here>"}'`
      : "Bot is connected! Type .menu in WhatsApp to get started.",
    sessionEndpoint: "POST /session  { session: '<NEXUS-MD:~... | base64 | JSON | https://URL>' }",
    pairingSite: PAIR_SITE_URL,
    pairingCode: pairingCode || null,
  });
});

app.get("/status", (req, res) => {
  res.json({ status: botStatus, phone: botPhoneNumber, mode: settings.get("mode") });
});

// ── Disconnect history — lets dashboard show WHY the bot disconnected ─────────
app.get("/api/disconnects", (req, res) => {
  // Merge in-memory (current session) with DB-persisted (across restarts)
  const persisted = (() => { try { return db.read("_disconnectLog", []); } catch { return []; } })();
  const merged = [..._disconnectLog];
  for (const e of persisted) {
    if (!merged.some(m => m.at === e.at)) merged.push(e);
  }
  merged.sort((a, b) => b.at.localeCompare(a.at));
  res.json(merged.slice(0, 20));
});

// ── Health check — Heroku / UptimeRobot / health monitors hit this ───────────
app.get("/health", (req, res) => {
  const _plat = platform.get();
  const _hasSessionEnv = !!(process.env.SESSION_ID || process.env.SESSION);
  const _sessionEnvValid = (() => {
    const s = process.env.SESSION_ID || process.env.SESSION;
    return s ? isValidSessionString(s) : false;
  })();
  const _hasDB = !!process.env.DATABASE_URL;
  const _dbSession = (() => { try { const d = db.read("_latestSession", null); return !!(d && d.id); } catch { return false; } })();
  const _credsOnDisk = require("fs").existsSync(require("path").join(AUTH_FOLDER, "creds.json"));

  const issues = [];
  if (waitingForSession) {
    if (!_hasSessionEnv && !_dbSession && !_credsOnDisk)
      issues.push("NO_SESSION: No session env var, no DB session, no creds on disk — bot is waiting for setup");
    else if (_hasSessionEnv && !_sessionEnvValid)
      issues.push("BAD_SESSION_ENV: SESSION_ID/SESSION env var is set but contains corrupted/binary data");
    else if (_hasSessionEnv && _sessionEnvValid)
      issues.push("SESSION_RESTORE_FAILED: Env var looks valid but restore failed — session may be expired/revoked");
  }
  if (!_hasDB) issues.push("NO_DATABASE_URL: Sessions will not survive dyno restarts without DATABASE_URL");

  res.status(200).json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    status: botStatus,
    session: waitingForSession ? "waiting" : "active",
    phone: botPhoneNumber || null,
    platform: _plat.name,
    env: {
      SESSION_ID_set: !!(process.env.SESSION_ID),
      SESSION_set: !!(process.env.SESSION),
      SESSION_env_valid: _sessionEnvValid,
      DATABASE_URL_set: _hasDB,
      db_has_session: _dbSession,
      creds_on_disk: _credsOnDisk,
      HEROKU_APP_NAME: _resolveHerokuAppName() || null,
      APP_URL: process.env.APP_URL || null,
      ADMIN_NUMBERS: !!(process.env.ADMIN_NUMBERS),
    },
    issues,
    fix: issues.length ? "Visit /dashboard?tab=setup to paste a fresh session from nexus-session-76ah.onrender.com" : null,
  });
});

app.get("/api/session", (req, res) => {
  const sid = encodeSession();
  currentSessionId = sid;
  res.json({ sessionId: sid, connected: botStatus === "connected", phone: botPhoneNumber });
});

// ── Manual reconnect trigger ──────────────────────────────────────────────────
// POST /api/reconnect — forcefully (re)connects the bot without needing to
// re-submit the session.  Useful when the bot is stuck in "disconnected" state
// but the creds.json on disk is still valid.
app.post("/api/reconnect", (req, res) => {
  if (botStatus === "connected") {
    return res.json({ ok: false, message: "Bot is already connected." });
  }
  const credsPath = require("path").join(AUTH_FOLDER, "creds.json");
  if (!require("fs").existsSync(credsPath)) {
    return res.status(400).json({ ok: false, message: "No session found. Submit a session first via the Setup tab." });
  }
  waitingForSession = false;
  reconnectAttempts  = 0;
  if (sockRef) { try { sockRef.ws.close(); } catch {} }
  console.log("🔄 Manual reconnect triggered via /api/reconnect");
  setTimeout(startnexus, 300);
  res.json({ ok: true, message: "Reconnect scheduled. Check logs for progress." });
});

// ── Accept any session ID/string and connect ─────────────────────────────────
// Accepts: NEXUS-MD, bare URL, raw JSON string, base64 creds, object-form creds
app.post("/session", async (req, res) => {
  const body = req.body || {};
  let rawValue = body.session || body.sessionId;

  // Object-form: { session: { noiseKey: {...}, ... } } — serialise to string
  if (rawValue && typeof rawValue === "object") {
    rawValue = JSON.stringify(rawValue);
  }

  const raw = (rawValue || "").trim();
  if (!raw) return res.status(400).json({
    error: "Provide { session: '...' } in the request body.",
    hint: "Accepted formats: NEXUS-MD:~..., https:// URL, raw JSON string, base64, creds object"
  });

  try {
    console.log("📥 Restoring session (universal detector)...");
    const ok = await restoreSession(raw);
    if (!ok) return res.status(500).json({
      error: "Could not restore session. Make sure it is a valid Baileys creds.json (any format)."
    });

    // Pre-save to DB immediately — protects against SIGTERM arriving before
    // WhatsApp finishes the handshake (same race that affected env-var boot).
    try {
      const sid = encodeSession();
      if (sid) {
        db.write("_latestSession", { id: sid });
        console.log("💾 Session pre-saved to database (POST /session).");
      }
    } catch (_) {}

    res.json({ ok: true, message: "Session saved. Reconnecting bot..." });

    waitingForSession = false;
    reconnectAttempts = 0;
    aliveSent = false;   // allow a fresh alive message after re-pairing
    // Close any existing socket cleanly, then always start fresh.
    // Never rely only on the close-event to trigger reconnect — the socket
    // may already be dead/closed and the close event would never fire.
    if (sockRef) {
      try { sockRef.ws.close(); } catch {}
    }
    console.log("🔄 Session saved — scheduling startnexus() in 600 ms...");
    setTimeout(startnexus, 600);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Load session from any URL ─────────────────────────────────────────────────
// POST /session/url  { url: "https://..." }
app.post("/session/url", async (req, res) => {
  const { url } = req.body || {};
  if (!url || !/^https:\/\//i.test(url)) return res.status(400).json({
    error: "Provide { url: 'https://...' } — only https:// URLs are accepted."
  });

  try {
    console.log(`📥 Loading session from URL: ${url}`);
    const ok = await restoreSession(url);
    if (!ok) return res.status(500).json({ error: "Could not load a valid session from that URL." });

    // Pre-save to DB immediately — same SIGTERM race protection as /session.
    try {
      const sid = encodeSession();
      if (sid) {
        db.write("_latestSession", { id: sid });
        console.log("💾 Session pre-saved to database (POST /session/url).");
      }
    } catch (_) {}

    res.json({ ok: true, message: "Session loaded from URL. Reconnecting bot..." });

    waitingForSession = false;
    reconnectAttempts = 0;
    aliveSent = false;   // allow a fresh alive message after re-pairing
    if (sockRef) {
      try { sockRef.ws.close(); } catch {}
    }
    console.log("🔄 Session loaded from URL — scheduling startnexus() in 600 ms...");
    setTimeout(startnexus, 600);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Heroku config-var pusher ──────────────────────────────────────────────────
// POST /api/heroku/config  { apiKey, appName, vars: { KEY: VALUE, ... } }
app.post("/api/heroku/config", async (req, res) => {
  const { apiKey, appName, vars } = req.body || {};
  if (!apiKey || !appName || !vars || typeof vars !== "object") {
    return res.status(400).json({ error: "Provide apiKey, appName, and vars object." });
  }
  try {
    const response = await axios.patch(
      `https://api.heroku.com/apps/${appName}/config-vars`,
      vars,
      {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Accept": "application/vnd.heroku+json; version=3",
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );
    res.json({ ok: true, message: `Config vars updated on ${appName}`, vars: response.data });
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    res.status(500).json({ error: errMsg });
  }
});

// ── Heroku app creator ───────────────────────────────────────────────────────
// POST /api/heroku/create  { apiKey, appName, region, vars: { KEY: VALUE, ... } }
app.post("/api/heroku/create", async (req, res) => {
  const { apiKey, appName, region, vars } = req.body || {};
  if (!apiKey) return res.status(400).json({ error: "Heroku API key is required." });
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Accept": "application/vnd.heroku+json; version=3",
    "Content-Type": "application/json",
  };
  try {
    // Step 1: create the app
    const createPayload = { stack: "heroku-22" };
    if (appName) createPayload.name = appName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (region === "eu") createPayload.region = "eu";
    const createResp = await axios.post("https://api.heroku.com/apps", createPayload, { headers, timeout: 20000 });
    const createdName = createResp.data.name;
    const webUrl = createResp.data.web_url;

    // Step 2: push config vars if any
    if (vars && typeof vars === "object" && Object.keys(vars).length) {
      await axios.patch(`https://api.heroku.com/apps/${createdName}/config-vars`, vars, { headers, timeout: 15000 });
    }

    res.json({ ok: true, appName: createdName, webUrl, message: `App ${createdName} created and config vars set.` });
  } catch (err) {
    const errMsg = err.response?.data?.message || err.response?.data?.id || err.message;
    res.status(500).json({ error: errMsg });
  }
});

// ── Heroku app list for auto-detect ──────────────────────────────────────────
// GET /api/heroku/apps?apiKey=...
app.get("/api/heroku/apps", async (req, res) => {
  const apiKey = req.query.apiKey || req.headers["x-heroku-api-key"];
  if (!apiKey) return res.status(400).json({ error: "Provide apiKey as query param or X-Heroku-Api-Key header." });
  try {
    const response = await axios.get("https://api.heroku.com/apps", {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Accept": "application/vnd.heroku+json; version=3",
      },
      timeout: 15000,
    });
    res.json({ ok: true, apps: response.data.map(a => ({ name: a.name, url: a.web_url })) });
  } catch (err) {
    const errMsg = err.response?.data?.message || err.message;
    res.status(500).json({ error: errMsg });
  }
});

// ── Platform info API ─────────────────────────────────────────────────────────
app.get("/api/platform", (req, res) => {
  const plat = platform.get();
  res.json({
    platform: plat.name,
    icon: plat.icon,
    isPanel: plat.isPanel,
    isHeroku: plat.name === "Heroku",
    herokuAppName: _resolveHerokuAppName(),
    waitingForSession,
    botStatus,
  });
});

// Redirect bare /pair to the external pairing site
app.get("/pair", (req, res) => {
  res.redirect(302, PAIR_SITE_URL);
});

app.get("/pair/:phone", async (req, res) => {
  const phone = req.params.phone.replace(/\D/g, "");
  if (!phone) return res.json({ error: "Provide phone number e.g. /pair/254706535581" });

  // ── CRITICAL SAFETY GUARD ─────────────────────────────────────────────────
  // requestPairingCode() must NEVER be called when a session already exists.
  // Calling it on a socket that has credentials tells WhatsApp "start a new
  // pairing", which immediately revokes the current session (force-logout 401).
  // We block this endpoint whenever:
  //   • The bot is already connected (live session)
  //   • waitingForSession === false (credentials exist even if momentarily offline)
  //   • A valid session is stored in the DB (belt-and-suspenders)
  if (!waitingForSession) {
    return res.json({ error: "Bot already has a session. Disconnect and clear the session before re-pairing." });
  }
  if (botStatus === "connected") {
    return res.json({ error: "Bot already connected!", phone: botPhoneNumber });
  }
  const _storedSess = db.read("_latestSession", null);
  if (_storedSess?.id) {
    return res.json({ error: "A stored session exists. Clear it from the dashboard before requesting a new pairing code." });
  }
  if (!sockRef) return res.json({ error: "Bot socket not ready yet, try again in a few seconds." });

  try {
    pairingPhone = phone;
    const code = await sockRef.requestPairingCode(phone);
    pairingCode = code;
    console.log(`📲 Pairing code for ${phone}: ${code}`);
    res.json({ pairingCode: code, phone, instructions: `Open WhatsApp → Linked Devices → Link with phone number → enter code: ${code}` });
  } catch (err) {
    res.json({ error: err.message });
  }
});

const _server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`⚡ IgniteBot running on port ${PORT}`);
});
_server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️  Port ${PORT} busy — retrying in 1.5s…`);
    const { execSync } = require("child_process");
    // Try multiple portable methods to free the port
    try { execSync(`lsof -ti :${PORT} | xargs kill -9 2>/dev/null || true`, { stdio: "ignore" }); } catch {}
    try { execSync(`pkill -f "node.*index" 2>/dev/null || true`, { stdio: "ignore" }); } catch {}
    setTimeout(() => _server.listen(PORT, "0.0.0.0"), 1500);
  } else {
    // Log but do NOT exit — crashing here causes a Heroku restart loop on non-fatal errors
    console.error("Server error (non-fatal):", err.message);
  }
});

// ── Keep-alive (Heroku / Render / Replit — dynos that sleep after inactivity) ─
// Two-layer approach so the bot never goes silent:
//  Layer 1 — Internal self-ping via localhost (zero config, always works)
//  Layer 2 — External URL ping as a backup (uses APP_URL or HEROKU_APP_NAME)
(function startKeepAlive() {
  const plat = platform.get();
  if (!plat.isSleepy) return; // VPS/Pterodactyl — never sleep, skip

  // ── Layer 1: internal self-ping (zero config, always works) ──────────────
  const localUrl = `http://localhost:${PORT}/`;
  setInterval(async () => {
    try { await axios.get(localUrl, { timeout: 8000 }); } catch {}
  }, 10 * 60 * 1000); // every 10 minutes
  console.log(`💓 Keep-alive: internal self-ping every 10 min (port ${PORT})`);

  // ── Layer 2: external URL ping (belt-and-suspenders) ─────────────────────
  const appUrl = _resolveAppUrl();
  if (appUrl) {
    setInterval(async () => {
      try { await axios.get(appUrl, { timeout: 10000 }); } catch {}
    }, 12 * 60 * 1000); // every 12 minutes
    console.log(`💓 Keep-alive: external ping to ${appUrl} every 12 min`);
  }
})();

// ── Graceful shutdown (SIGTERM from panel stop / Heroku restart) ─────────────
// IMPORTANT: save the full session to DB *before* closing so the next
// startup has the latest keys even if the 30 s periodic save hasn't fired.
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;          // already shutting down — ignore duplicate signals
  isShuttingDown = true;
  console.log(`\n🛑 ${signal} received — shutting down gracefully…`);
  // 1. Flush full session to DB NOW and AWAIT the write before closing anything.
  //    Wait 300 ms first so any Baileys async key-file writes (pre-keys, session
  //    keys, app-state) that were in-flight when SIGTERM arrived have time to
  //    complete before encodeSession() reads the files — otherwise we can save
  //    a stale snapshot that causes Bad MAC / logout on the next start.
  await new Promise(r => setTimeout(r, 300));
  try {
    const sid = encodeSession();
    if (sid) {
      await db.persistNow("_latestSession", { id: sid });
      console.log("💾 Session flushed to DB before shutdown.");
    }
  } catch {}
  // 2. Close the WhatsApp WebSocket directly — avoids triggering the
  //    connection.update reconnect handler (end() with no error emits 'close'
  //    with undefined statusCode which falls into the reconnect path).
  try {
    if (sockRef?.ws && !sockRef.ws.isClosed && !sockRef.ws.isClosing) {
      sockRef.ws.close();
    }
  } catch {}
  // 3. Close HTTP server
  _server.close(() => {
    console.log("✅ HTTP server closed. Goodbye!");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000); // force-exit after 8 s
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT",  () => gracefulShutdown("SIGINT"));

// ── Emergency session flush on crash ─────────────────────────────────────────
// Save the session before exiting so the next startup reconnects without re-pairing.
function emergencyFlush(label, err) {
  console.error(`💥 ${label}:`, err?.message || err);
  try {
    const sid = encodeSession();
    if (sid) db.write("_latestSession", { id: sid });
  } catch {}
}
process.on("uncaughtException", (err) => {
  const msg = err?.message || String(err);
  // Baileys / WebSocket internal errors — these are safe to swallow and must NOT
  // crash the dyno. Exiting on these causes the Heroku restart loop the user sees.
  const isBaileysNoise = /session_cipher|queue_job|Closing session|SessionEntry|chainKey|indexInfo|registrationId|ephemeralKey|Bad MAC|decrypt|libsignal|Session error|ECONNREFUSED|ECONNRESET|ETIMEDOUT|socket hang up|read ECONNRESET|write ECONNRESET|WebSocket|ws error|stream error|boomed|rate-limit|Connection Closed|connection closed|Timed Out|connect ETIMEDOUT/i.test(msg);
  if (isBaileysNoise) {
    console.warn(`⚠️ Suppressed internal noise (uncaughtException): ${msg.slice(0, 120)}`);
    return;
  }
  emergencyFlush("Uncaught exception", err);
  // Only exit for genuinely unrecoverable errors — not Baileys transport noise.
  setTimeout(() => process.exit(1), 500);
});
// ── Session-health tracking — must be declared before any handler that uses them
const _PURE_NOISE   = /session_cipher|queue_job|Closing session|SessionEntry|chainKey|indexInfo|registrationId|ephemeralKey|ECONNREFUSED.*5432/i;
const _SESSION_WARN = /Bad MAC|decrypt|libsignal|Session error/i;
let _lastSessionWarn = 0;
// Track recent disconnect reasons so the dashboard can surface them
const _disconnectLog = [];            // [{ at, code, reason }]  max 20 entries

process.on("unhandledRejection", (err) => {
  // Baileys generates many internal unhandled rejections — log them but don't exit.
  const msg = err?.message || String(err);
  // Pure transport noise — safe to drop entirely
  const isPureNoise = /ECONNREFUSED|timeout|socket hang up|session_cipher|queue_job|Closing session|SessionEntry/i.test(msg);
  if (isPureNoise) return;
  // Signal-key health issues — deduplicated, one per minute max (these
  // often precede logout, so they must be visible but not flood the log)
  const isKeyIssue = /Bad MAC|decrypt|libsignal|Session error/i.test(msg);
  if (isKeyIssue) {
    const now = Date.now();
    if (now - _lastSessionWarn > 60000) {
      _lastSessionWarn = now;
      console.warn(`[SESSION-WARN] Signal key issue (unhandled rejection): ${msg.slice(0, 120)}`);
    }
    return;
  }
  console.warn(`⚠️  Unhandled rejection:`, msg.slice(0, 200));
});
for (const method of ["log", "warn", "error", "debug", "trace", "info"]) {
  const _orig = console[method].bind(console);
  console[method] = (...args) => {
    const text = args.map(a => (typeof a === "string" ? a : (a instanceof Error ? a.message : JSON.stringify(a) ?? ""))).join(" ");
    if (_PURE_NOISE.test(text)) return;
    if (_SESSION_WARN.test(text)) {
      const now = Date.now();
      if (now - _lastSessionWarn > 60000) {   // at most once per minute
        _lastSessionWarn = now;
        _orig(`[SESSION-WARN] Signal key issue detected — may cause logout: ${text.slice(0, 120)}`);
      }
      return;
    }
    _orig(...args);
  };
}

function reconnectDelay() {
  const base = 3000;
  const max  = 60000;
  const delay = Math.min(base * Math.pow(2, reconnectAttempts), max);
  reconnectAttempts++;
  return delay;
}

// ── Connection watchdog ───────────────────────────────────────────────────────
// Checks every 30 s whether the bot has a live open socket.
// Catches two failure modes:
//   1. botStatus is not "connected" and no reconnect is in progress (standard drop).
//   2. botStatus says "connected" but the underlying WebSocket is actually closed
//      (silent death — no disconnect event fired). Previously the dual-condition
//      guard missed this case entirely.
// Also enforces a pong deadline: if the socket hasn't received a WS pong for
// more than 2 minutes while "connected", the connection is treated as dead.
let _lastPongAt = 0; // updated whenever the raw WS receives a pong frame
setInterval(() => {
  if (isShuttingDown || waitingForSession || isConnecting) return;
  const ws = sockRef?.ws;
  const wsAlive = ws && !ws.isClosed && !ws.isClosing;

  // Case 1: not connected and nothing is already reconnecting
  if (botStatus !== "connected" && !isConnecting) {
    console.warn("[WATCHDOG] 🔄 Not connected — forcing reconnect...");
    reconnectAttempts = 0;
    startnexus().catch(() => {});
    return;
  }

  // Case 2: status says "connected" but WS is actually dead
  if (botStatus === "connected" && !wsAlive) {
    console.warn("[WATCHDOG] 🔄 Silent socket death detected (ws closed while status=connected) — forcing reconnect...");
    botStatus = "disconnected";
    sockRef = null;
    reconnectAttempts = 0;
    startnexus().catch(() => {});
    return;
  }

  // Case 3: pong deadline — Baileys sends a WS ping every 15 s (keepAliveIntervalMs).
  // If we haven't seen a pong for >2 min the connection is effectively frozen.
  if (botStatus === "connected" && wsAlive && _lastPongAt > 0) {
    const silentSec = Math.floor((Date.now() - _lastPongAt) / 1000);
    if (silentSec > 120) {
      console.warn(`[WATCHDOG] 🔄 No WS pong for ${silentSec}s — connection frozen, forcing reconnect...`);
      botStatus = "disconnected";
      sockRef = null;
      reconnectAttempts = 0;
      try { ws.terminate?.(); } catch {}
      startnexus().catch(() => {});
    }
  }
}, 30 * 1000);

// ── Memory watchdog ───────────────────────────────────────────────────────────
// Checks every 3 minutes. If RSS > 400 MB, clear the media buffer cache so
// accumulated download buffers don't push a Heroku 512 MB dyno into R14.
// If RSS > 480 MB, log a critical warning so the operator knows to scale up.
setInterval(() => {
  const rss = process.memoryUsage().rss;
  const rssMB = Math.round(rss / 1024 / 1024);
  if (rssMB > 480) {
    console.error(`[MEM⚠️ CRITICAL] RSS=${rssMB}MB — approaching OOM kill threshold. Consider upgrading dyno.`);
  } else if (rssMB > 400) {
    console.warn(`[MEM⚠️] RSS=${rssMB}MB — clearing media cache to free memory.`);
  }
  if (rssMB > 400 && typeof _mediaBufferCache !== "undefined") {
    try { _mediaBufferCache.clear?.(); } catch {}
  }
}, 3 * 60 * 1000);

// Simple in-memory message cache so Baileys can retry failed decryptions
const _msgCache = new Map();
const _pendingOrders = new Map(); // jid → { pkg, step: "phone"|"confirm" }

// LID → real-phone-JID resolver.
// Baileys v7 multi-device uses privacy "LID" identifiers (@lid suffix) for
// group-message participants. Without this map every @lid sender looks like
// a random number → _isOwner / isSuperAdmin / phone comparisons all fail.
// We populate it from the contacts events Baileys emits on connect.
const _lidMap = new Map(); // "XXXXX@lid" → "254XXXXXXXX@s.whatsapp.net"
function _indexContacts(contacts) {
  if (!Array.isArray(contacts)) return;
  for (const c of contacts) {
    const lid  = c?.lid  || c?.id;
    const real = c?.jid  || c?.phone;
    if (lid?.endsWith("@lid") && real && !real.endsWith("@lid")) {
      _lidMap.set(lid, real);
    }
    // Also index reverse: real → lid (so we can go both ways if needed)
    if (real?.endsWith("@s.whatsapp.net") && lid?.endsWith("@lid")) {
      _lidMap.set(real, lid);
    }
  }
}
// Resolve a potentially-LID JID to the best real phone JID we know.
function _resolveSenderJid(jid) {
  if (!jid) return jid;
  if (!jid.endsWith("@lid")) return jid;
  return _lidMap.get(jid) || jid; // fall back to original if unknown
}

// Active processMessage concurrency counter — flood protection
let _activeMsgCount = 0;
function _cacheMsg(msg) {
  if (!msg?.key?.id || !msg.message) return;
  _msgCache.set(msg.key.id, msg.message);
  if (_msgCache.size > 2000) {
    const oldest = _msgCache.keys().next().value;
    _msgCache.delete(oldest);
  }
}

// Media buffer cache — stores downloaded media buffers keyed by message ID.
// Populated eagerly on arrival so antidelete can recover media even after
// the WhatsApp CDN URL has expired (which happens within minutes of sending).
const _mediaBufferCache = new Map();
const _MEDIA_TYPES_AD = new Set(["imageMessage","videoMessage","audioMessage","stickerMessage","documentMessage","ptvMessage"]);

// Group metadata cache — avoids a live WhatsApp fetch on every group message.
// Entries expire after 60 seconds so admin changes are eventually picked up.
const _groupMetaCache = new Map();

// Normalize any WhatsApp JID to the canonical phone@s.whatsapp.net form.
// Handles both legacy (254xxx@s.whatsapp.net) and multi-device (254xxx:10@s.whatsapp.net).
// The broken .replace(/:\d+@/, "@s.whatsapp.net") produced "254xxx@s.whatsapp.nets.whatsapp.net";
// this function is the safe replacement used everywhere.
const _nj = (jid) => (jid || "").split(":")[0].split("@")[0] + "@s.whatsapp.net";
async function _getGroupMeta(sock, jid) {
  const cached = _groupMetaCache.get(jid);
  if (cached && Date.now() - cached.ts < 300000) return cached.data;
  try {
    const data = await sock.groupMetadata(jid);
    _groupMetaCache.set(jid, { data, ts: Date.now() });
    return data;
  } catch {
    return cached?.data || null;
  }
}
async function _eagerCacheMedia(msg) {
  try {
    if (!msg?.key?.id || !msg.message) return;
    // Unwrap ephemeral / viewonce / document-with-caption wrappers
    const innerMsg =
      msg.message?.ephemeralMessage?.message ||
      msg.message?.viewOnceMessage?.message ||
      msg.message?.viewOnceMessageV2?.message?.viewOnceMessage?.message ||
      msg.message;
    const msgType = Object.keys(innerMsg)[0];
    if (!_MEDIA_TYPES_AD.has(msgType)) return;
    const buf = await downloadMediaMessage(msg, "buffer", {}).catch(() => null);
    if (!buf) return;
    const msgData = innerMsg[msgType] || {};
    _mediaBufferCache.set(msg.key.id, {
      buffer:   buf,
      mimetype: msgData.mimetype || null,
      msgType,
      ptt:      msgData.ptt || false,
      caption:  msgData.caption || null,
      fileName: msgData.fileName || null,
      gifPlayback: msgData.gifPlayback || false,
    });
    // Keep cache bounded — drop oldest entries above 200
    if (_mediaBufferCache.size > 200) {
      const oldest = _mediaBufferCache.keys().next().value;
      _mediaBufferCache.delete(oldest);
    }
  } catch {}
}

async function fetchSettings() {
  const data = await getSettings();
  return {
    wapresence:  data.wapresence  ?? "online",
    autoread:    data.autoread    ?? "off",
    mode:        data.mode        ?? "public",
    prefix:      data.prefix      ?? ".",
    autolike:    data.autolike    ?? "on",
    autoview:    data.autoview    ?? "on",
    antilink:    data.antilink    ?? "on",
    antilinkall: data.antilinkall ?? "off",
    antidelete:  data.antidelete  ?? "on",
    antibot:     data.antibot     ?? "off",
    welcome:     data.welcome     ?? "off",
    goodbye:     data.goodbye     ?? "off",
    autobio:     data.autobio     ?? "off",
    badword:     data.badword     ?? "on",
    gptdm:       data.gptdm       ?? "off",
    anticall:    data.anticall    ?? "off",
  };
}

async function startnexus() {
  // Guard: never run two startnexus() calls concurrently.
  // A duplicate call can create two simultaneous WA sockets → 440 (replaced) → potential 401.
  if (isConnecting) {
    console.log("⚠️  startnexus() called while already connecting — skipped.");
    return;
  }
  isConnecting = true;
  // Load all plugins once at startup (auto-loads on first dispatch anyway, but this gives early logs)
  pluginLoader.load();

  let autobio, autolike, welcome, autoview, mode, prefix, anticall;

  try {
    const s = await fetchSettings();
    console.log("😴 settings object:", s);

    ({ autobio, autolike, welcome, autoview, mode, prefix, anticall } = s);

    console.log("✅ Settings loaded successfully.... indexfile");
  } catch (error) {
    console.error("❌ Failed to load settings:...indexfile", error.message || error);
    // Don't give up — retry after 10 s. Without this, a transient DB hiccup
    // on Heroku startup leaves the bot permanently dead until the next dyno restart.
    console.log("🔄 Retrying startnexus in 10 s...");
    isConnecting = false;
    setTimeout(startnexus, 10000);
    return;
  }

  // If the auth folder is empty or missing (e.g. container restarted mid-cycle
  // and the startup DB-restore ran but was skipped this call), try the DB again.
  const credsPath = path.join(AUTH_FOLDER, "creds.json");
  if (!fs.existsSync(credsPath)) {
    const dbSess = db.read("_latestSession", null);
    if (dbSess?.id) {
      console.log("🔄 Auth folder empty on reconnect — re-restoring from DB...");
      await restoreSession(dbSess.id).catch(() => {});
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  // ── Signal-key DB mirror ──────────────────────────────────────────────────
  // Baileys writes pre-keys, session-keys and app-state keys directly to disk
  // via async keys.set(), which does NOT fire creds.update. Without this hook
  // the 30 s sessionPersistInterval is the only thing saving those files to DB.
  // If the dyno restarts within that window the DB has stale keys → Bad MAC →
  // WhatsApp forces a logout. We intercept keys.set so a DB snapshot is taken
  // within 3 s of any signal-key change, keeping the DB nearly always current.
  const _origKeysSet = state.keys.set.bind(state.keys);
  let _keysSetTimer = null;
  state.keys.set = async (data) => {
    await _origKeysSet(data);          // write files to disk first
    if (_keysSetTimer) clearTimeout(_keysSetTimer);
    _keysSetTimer = setTimeout(() => {
      const sid = encodeSession();
      if (sid) {
        currentSessionId = sid;
        try { db.write("_latestSession", { id: sid }); } catch {}
      }
    }, 1000);                          // batch multiple back-to-back key updates (1 s for fast Heroku restarts)
  };

  // Detect a real user-provided session.
  // IMPORTANT: Baileys auto-generates noiseKey/signedIdentityKey in-memory for every
  // fresh socket — those keys alone do NOT indicate a real WhatsApp account session.
  // The only reliable signals are:
  //   1. state.creds.me    — non-null after a successful handshake (best signal)
  //   2. state.creds.account — populated after a successful registration
  //   3. creds.json exists on disk with size > 200 bytes — user has explicitly
  //      provided a session (a real session file always contains keys + account data)
  const credsDiskOk = fs.existsSync(credsPath) && fs.statSync(credsPath).size > 200;
  const hasCreds = !!(
    state.creds?.me ||
    state.creds?.account ||
    credsDiskOk
  );
  console.log(`[startnexus] hasCreds=${hasCreds} | me=${state.creds?.me?.id || "null"} | noiseKey=${!!state.creds?.noiseKey} | credsDisk=${credsDiskOk}`);
  if (!hasCreds) {
    waitingForSession = true;
    let host;
    if (process.env.RAILWAY_STATIC_URL) {
      host = process.env.RAILWAY_STATIC_URL.startsWith("http")
        ? process.env.RAILWAY_STATIC_URL
        : `https://${process.env.RAILWAY_STATIC_URL}`;
    } else {
      host = _resolveAppUrl() || `http://localhost:${PORT}`;
    }
    console.log("⚠️  No WhatsApp session — waiting for setup.");
    console.log(`🔗 Visit the dashboard to set up: ${host}/dashboard?tab=setup`);
    console.log(`   Or POST session directly: curl -X POST ${host}/session -H 'Content-Type: application/json' -d '{"session":"<session-id>"}'`);
    // ── IMPORTANT: return here so we do NOT create a Baileys socket.
    // Creating a socket without credentials causes a failed WhatsApp connection
    // attempt that closes immediately, which triggers Heroku's crash/restart loop.
    // The HTTP server (already listening) keeps the process alive stably.
    // When the user POSTs a session via /session, startnexus() is called again.
    isConnecting = false;  // allow a new startnexus() when the user provides a session
    return;
  }

  waitingForSession = false;
  // Fetch the current WA version with a 5-second timeout so a stalled
  // network request never freezes the entire bot startup indefinitely.
  console.log("[startnexus] Fetching WA version...");
  let version;
  try {
    const vRes = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout after 5s")), 5000)),
    ]);
    version = vRes.version;
    console.log("[startnexus] WA version:", version);
  } catch (vErr) {
    version = [2, 3000, 1023597560];
    console.warn("[WA] Could not fetch latest version — using built-in fallback:", version, `(${vErr.message})`);
  }

  // Completely silent no-op logger — prevents Baileys printing internal signal state
  const noop = () => {};
  const logger = { trace: noop, debug: noop, info: noop, warn: noop, error: noop, fatal: noop, child() { return this; }, level: "silent" };

  console.log("[startnexus] Creating WA socket...");
  const plat = platform.get();
  const sock = makeWASocket({
    version,
    logger,
    // Show QR in terminal on panels/VPS; cloud platforms use web pairing UI
    printQRInTerminal: plat.printQR || !!process.env.PRINT_QR,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: false,
    shouldIgnoreJid: () => false,   // accept messages from ALL JIDs — filters removed by startup patch
    markOnlineOnConnect: false,
    retryRequestDelayMs: 2000,          // default — avoid rate-limit kicks from WA
    connectTimeoutMs: 20000,            // fail-fast on slow connections
    keepAliveIntervalMs: 15000,         // WA WebSocket keepalive every 15s
    maxMsgRetryCount: 3,                // limit retry storms
    syncFullHistory: false,             // don't sync old message history on connect
    defaultQueryTimeoutMs: undefined,   // never let a query timeout kill the socket
    getMessage: async (key) => {
      return _msgCache.get(key.id) || undefined;
    },
  });

  sockRef = sock;


  // Wrap sendMessage with logging, 90s timeout guard, and one auto-retry for media
  const _origSendMessage = sock.sendMessage.bind(sock);
  const _sendWithTimeout = (jid, content, opts) =>
    Promise.race([
      _origSendMessage(jid, content, opts),
      new Promise((_, rej) => setTimeout(() => rej(new Error("media upload timeout after 90s")), 90000)),
    ]);
  sock.sendMessage = async (jid, content, opts) => {
    const mtype = Object.keys(content)[0];
    const isMedia = ["image","video","audio","document","sticker"].includes(mtype);
    console.log(`[SEND→] to=${jid?.split("@")[0]} type=${mtype}${isMedia ? " (media)" : ""}`);
    try {
      const result = isMedia
        ? await _sendWithTimeout(jid, content, opts)
        : await _origSendMessage(jid, content, opts);
      console.log(`[SEND✓] to=${jid?.split("@")[0]} type=${mtype}`);
      return result;
    } catch (firstErr) {
      if (isMedia) {
        // One automatic retry for media after a short pause (handles transient upload failures)
        console.warn(`[SEND↺] retrying ${mtype} to=${jid?.split("@")[0]} after err: ${firstErr.message}`);
        await new Promise(r => setTimeout(r, 3000));
        try {
          const result = await _sendWithTimeout(jid, content, opts);
          console.log(`[SEND✓] to=${jid?.split("@")[0]} type=${mtype} (retry)`);
          return result;
        } catch (retryErr) {
          console.error(`[SEND✗] to=${jid?.split("@")[0]} type=${mtype} err=${retryErr.message} (after retry)`);
          throw retryErr;
        }
      }
      console.error(`[SEND✗] to=${jid?.split("@")[0]} type=${mtype} err=${firstErr.message}`);
      throw firstErr;
    }
  };

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    // Never attempt to reconnect while a graceful shutdown is in progress.
    // Without this guard, end()/ws.close() emits 'close' with undefined statusCode
    // which falls into the reconnect branch and races against SIGTERM → dual connection → logout.
    if (isShuttingDown) return;

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const errMsg     = lastDisconnect?.error?.message || "";
      botStatus = "disconnected";
      sockRef = null;
      isConnecting = false;  // connection attempt settled — allow next startnexus() call
      if (alwaysOnlineInterval)    { clearInterval(alwaysOnlineInterval);    alwaysOnlineInterval    = null; }
      if (sessionPersistInterval)  { clearInterval(sessionPersistInterval);  sessionPersistInterval  = null; }

      // Immediately snapshot the full session to DB on every disconnect so the
      // reconnect has the freshest possible keys — no gap from the periodic save.
      try {
        const snapSid = encodeSession();
        if (snapSid) db.write("_latestSession", { id: snapSid });
      } catch {}

      // Record disconnect reason so dashboard can show WHY the bot disconnected
      const _dcEntry = { at: new Date().toISOString(), code: statusCode, reason: errMsg.slice(0, 120) };
      _disconnectLog.unshift(_dcEntry);
      if (_disconnectLog.length > 20) _disconnectLog.pop();
      try { db.write("_disconnectLog", _disconnectLog.slice(0, 10)); } catch {}

      const DR = DisconnectReason;
      const isLoggedOut        = statusCode === DR.loggedOut;         // 401 — WhatsApp revoked the session
      const isReplaced         = statusCode === DR.connectionReplaced; // 440 — another device took over

      // Always log the exact disconnect code so it appears in Heroku logs
      console.log(`🔴 WA disconnected | code=${statusCode ?? "none"} | ${errMsg.slice(0, 80) || "no message"}`);

      if (isLoggedOut) {
        reconnectAttempts = 0;
        console.log("⚠️  Logged out by WhatsApp (401) — WhatsApp has revoked this session.");
        console.log("   This happens when the linked device is removed from WhatsApp or the session expires.");
        console.log("   You need a NEW session. Visit the dashboard → Setup tab to pair again.");

        // Save the revoked session as a labelled backup so the dashboard can surface it,
        // but mark it clearly as revoked so we never try to reconnect with it.
        try {
          const revokedSid = encodeSession();
          if (revokedSid) db.write("_revokedSession", { id: revokedSid, at: new Date().toISOString() });
        } catch {}

        // Clear local auth files — these keys are permanently invalid after a 401.
        if (fs.existsSync(AUTH_FOLDER)) fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
        try { db.write("_latestSession", { id: null }); } catch {}

        // Check if the SESSION_ID env var looks valid and is different from what just got revoked.
        // If so, try it — it may be a freshly generated replacement the user already set.
        const _envSess = process.env.SESSION_ID || process.env.SESSION || null;
        if (_envSess && isValidSessionString(_envSess)) {
          console.log("🔄 Found valid SESSION_ID env var — attempting auto-restore after 10 s...");
          setTimeout(async () => {
            const ok = await restoreSession(_envSess).catch(() => false);
            if (ok) {
              console.log("✅ Auto-restored from SESSION_ID env var after 401.");
              setTimeout(startnexus, 1000);
            } else {
              console.log("❌ SESSION_ID env var restore failed — waiting for manual session input.");
              // Do NOT park waitingForSession=true permanently — the watchdog would
              // skip it and the bot stays dead forever. Instead flag it as waiting
              // but schedule a self-heal retry after 2 minutes so the bot recovers
              // automatically if the user sets a new SESSION_ID env var later.
              waitingForSession = true;
              setTimeout(() => {
                if (!waitingForSession) return; // user already provided session
                console.log("[WATCHDOG] ⏳ Session-wait retry — re-checking SESSION_ID env var...");
                waitingForSession = false;
                reconnectAttempts = 0;
                startnexus().catch(() => {});
              }, 2 * 60 * 1000);
            }
          }, 10000);
        } else {
          if (_envSess) console.log("⚠️  SESSION_ID env var is corrupted/binary — cannot auto-restore. Please set a valid SESSION_ID.");
          setTimeout(startnexus, 5000);
        }
      } else if (isReplaced) {
        // Another WhatsApp instance connected with the same session.
        // On Heroku we wait 60 s (longer than the SIGTERM window) so the old
        // dyno is fully dead before the new one reconnects.
        // On other platforms (Replit, VPS, local) 10 s is enough.
        const _replacedDelay = process.env.DYNO ? 60000 : 10000;
        console.log(`⚠️  Connection replaced (440) — another instance started. Retrying in ${_replacedDelay / 1000} s...`);
        reconnectAttempts = 0;
        setTimeout(startnexus, _replacedDelay);
      } else if (waitingForSession) {
        // No session yet — don't loop. Wait for the user to POST a session.
        console.log(`⏳ No session configured. Visit /dashboard?tab=setup to get started.`);
      } else if (statusCode === 408 || statusCode === 515 || (errMsg && errMsg.toLowerCase().includes("qr"))) {
        // 408 = timedOut / QR scan timeout — happens when stored session has no valid account
        // identity (me=null). Blindly reconnecting with the same bad creds just loops forever.
        consecutive408s++;
        if (consecutive408s >= 5) {
          consecutive408s = 0;
          reconnectAttempts = 0;
          console.log("━".repeat(60));
          console.log("🚫 SESSION INVALID — bot got code 408 five times in a row.");
          console.log("   The stored session has no valid WhatsApp account (me=null).");
          console.log("   ➡  Get a fresh session ID from: " + PAIR_SITE_URL);
          console.log("   ➡  Paste it in the dashboard → Setup tab → SESSION ID field.");
          console.log("   Pausing reconnection for 5 minutes to avoid WhatsApp rate-limits.");
          console.log("━".repeat(60));
          // Pause for 5 minutes then try once more in case the user pasted a new session
          setTimeout(() => {
            consecutive408s = 0;
            reconnectAttempts = 0;
            startnexus();
          }, 5 * 60 * 1000);
        } else {
          const delay = Math.min(6000 * consecutive408s, 30000); // 6s → 12s → 18s → 24s
          console.log(`🔌 Connection closed (code: 408 — QR timeout, attempt ${consecutive408s}/5). Retrying in ${Math.round(delay / 1000)}s...`);
          console.log(`   ⚠️  If this repeats, your session is expired. Get a new one at: ${PAIR_SITE_URL}`);
          setTimeout(startnexus, delay);
        }
      } else {
        const delay = reconnectDelay();
        console.log(`🔌 Connection closed (code: ${statusCode}). Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempts})...`);
        setTimeout(startnexus, delay);
      }
    }

    if (connection === "open") {
      reconnectAttempts = 0;
      consecutive408s   = 0;           // successful open — clear bad-session counter
      isConnecting = false;  // fully connected — allow future reconnect calls
      botStatus = "connected";
      sockRef = sock;

      // ── Pong tracker — stamp _lastPongAt on every WS pong so the watchdog
      // can detect frozen connections (no pong for >2 min → force reconnect).
      // Baileys exposes the raw uWebSockets/ws object on sock.ws.
      _lastPongAt = Date.now(); // seed with now so we don't false-fire on first connect
      try {
        const _rawWs = sock.ws;
        if (_rawWs && typeof _rawWs.on === "function") {
          _rawWs.on("pong", () => { _lastPongAt = Date.now(); });
        }
      } catch {}

      const jid = sock.user?.id;
      if (jid) botPhoneNumber = jid.split(":")[0].replace("@s.whatsapp.net", "");
      currentSessionId = encodeSession();
      console.log("✅ WhatsApp connected!");
      console.log(`📞 Phone: +${botPhoneNumber}`);
      platform.logStartup();
      if (currentSessionId) {
        console.log(`🔑 Session ID: ${currentSessionId.slice(0, 30)}...`);
        console.log("💡 Set SESSION_ID env var with this value to auto-connect on restart");
        // Persist immediately so a fast dyno restart can recover without QR
        try { db.write("_latestSession", { id: currentSessionId }); } catch {}
      }
      const prefix = settings.get("prefix") || ".";
      console.log(`⚡ Bot ready — prefix: ${prefix} | Type ${prefix}menu`);

      // Menu song and combined video are generated lazily on first .menu call
      // to avoid large memory spikes (ffmpeg + media buffers) on startup.

      // ── Startup alive message → all super-admins ──────────────────────────
      // Only send once per process lifetime — not on every reconnect.
      if (!aliveSent) {
        aliveSent = true;
        const { admins: adminNums } = require("./config");
        if (adminNums && adminNums.length) {
          const aliveMsg =
            `╔══════════════════════╗\n` +
            `║   🤖 *NEXUS-MD*        ║\n` +
            `╚══════════════════════╝\n\n` +
            `✅ *Master, am alive!*\n\n` +
            `📞 *Phone:* +${botPhoneNumber}\n` +
            `⚡ *Prefix:* ${prefix}\n` +
            `🕐 *Started:* ${new Date().toLocaleString("en-GB", { timeZone: settings.get("timezone") || "Africa/Nairobi", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}\n\n` +
            `_Type \`${prefix}menu\` to see all commands_`;
          for (const num of adminNums) {
            const ownerJid = `${num.replace(/\D/g, "")}@s.whatsapp.net`;
            await sock.sendMessage(ownerJid, { text: aliveMsg }).catch(() => {});
          }
        }
      }

      if (alwaysOnlineInterval) clearInterval(alwaysOnlineInterval);
      // Send presence every 5 min when wapresence is "online" (DB default) OR when
      // the user has toggled "always online" in the local settings module.
      // 5-min interval is much gentler than the old 25 s and avoids triggering
      // WhatsApp's multi-device app-state sync / force-logout.
      alwaysOnlineInterval = setInterval(async () => {
        if (!sock) return;
        const _alwaysOn   = settings.get("alwaysOnline");
        const _dbSettings = await getSettings().catch(() => null);
        const _wpresence  = _dbSettings?.wapresence ?? "online";
        if (_alwaysOn || _wpresence === "online") {
          await sock.sendPresenceUpdate("available").catch(() => {});
        }
      }, 5 * 60 * 1000);

      // ── Premium schedulers ─────────────────────────────────────────────────
      premium.startReminderScheduler(sock);
      premium.startDigestScheduler(sock);

      // ── Periodic full auth-folder persist every 30 s ────────────────────
      // Baileys writes signal-key files to disk independently of creds.update.
      // This timer makes sure ALL of them (pre-keys, session-keys, app-state)
      // are saved to the DB so a dyno/container restart restores them fully
      // and WhatsApp does not see a new-device mismatch → logout.

      if (sessionPersistInterval) clearInterval(sessionPersistInterval);
      sessionPersistInterval = setInterval(() => {
        const sid = encodeSession();
        if (sid) {
          currentSessionId = sid;
          try { db.write("_latestSession", { id: sid }); } catch {}
        }
      }, 30000);  // every 30 s — avoids DB lag spikes from frequent writes
    }
  });

  // Session-save debounce: creds.update fires on every message send/receive.
  // Batch DB writes to at most once every 5 s to avoid hammering the DB.
  let _sessionSaveTimer = null;
  sock.ev.on("creds.update", () => {
    saveCreds();  // write creds.json to disk immediately
    if (_sessionSaveTimer) clearTimeout(_sessionSaveTimer);
    _sessionSaveTimer = setTimeout(() => {
      // Re-encode ALL auth files (not just creds.json) after keys settle
      const sid = encodeSession();
      if (sid) {
        currentSessionId = sid;
        try {
          db.write("_latestSession", { id: sid });
        } catch (e) {
          console.error("⚠️ Could not persist session to DB:", e.message);
        }
      }
    }, 5000);
  });

  // ── App-state / history sync ACK handlers ────────────────────────────────
  // WhatsApp pushes these on every connect. Without handlers that consume and
  // ACK them, WA keeps retrying → eventually revokes the session (unpair).
  // Empty handlers are sufficient — Baileys sends the ACK automatically when
  // the event is consumed.
  sock.ev.on("messaging-history.set", () => {});
  sock.ev.on("chats.set",             () => {});
  sock.ev.on("messages.set",          () => {});

  // ── LID contact resolution — populate _lidMap so @lid JIDs can be
  //    resolved to real phone JIDs for _isOwner / isSuperAdmin checks.
  sock.ev.on("contacts.set",    ({ contacts }) => _indexContacts(contacts));
  sock.ev.on("contacts.upsert", (contacts)     => _indexContacts(contacts));
  sock.ev.on("contacts.update", (contacts)     => _indexContacts(contacts));

  // ── Active message processor — runs independently per message ──────────────
  // Spawned as a fire-and-forget Promise so multiple messages/commands never
  // block each other and the Baileys event loop is never held up.
  async function processMessage(msg) {
    const from      = msg.key.remoteJid;
    // Resolve @lid (Baileys v7 multi-device privacy IDs) → real phone JID.
    // Without this, group messages from some devices have a garbage senderJid
    // that breaks _isOwner, isSuperAdmin, and any phone-number comparison.
    const senderJid = _resolveSenderJid(msg.key.participant || from);

    // Keep the shallow-unwrapped inner for viewOnce/media checks (only strips ephemeral)
    const _inner = msg.message?.ephemeralMessage?.message || msg.message || {};
    // Linked-device messages arrive wrapped in deviceSentMessage — unwrap explicitly
    // because normalizeMessageContent (Baileys v7-rc13) does NOT strip this wrapper.
    const _deviceInner = msg.message?.deviceSentMessage?.message ||
      msg.message?.ephemeralMessage?.message?.deviceSentMessage?.message || {};
    // Use Baileys v7 normalizeMessageContent to fully unwrap ALL wrapper types
    // (ephemeral, viewOnce, documentWithCaption, etc.) for body extraction
    const _normalized = normalizeMessageContent(msg.message) || {};
    // For group messages, WhatsApp may wrap content alongside messageContextInfo.
    // Build a direct unwrap fallback by looking at all non-context keys in msg.message.
    // Skip deviceSentMessage here — we unwrap it explicitly via _deviceInner above.
    const _directMsg = (() => {
      const m = msg.message || {};
      const skip = new Set(["messageContextInfo","senderKeyDistributionMessage","protocolMessage","deviceSentMessage"]);
      for (const k of Object.keys(m)) {
        if (!skip.has(k) && m[k] && typeof m[k] === "object") return m[k];
      }
      return {};
    })();
    const body    =
      _deviceInner.conversation ||
      _deviceInner.extendedTextMessage?.text ||
      _normalized.conversation ||
      _normalized.extendedTextMessage?.text ||
      _inner.conversation ||
      _inner.extendedTextMessage?.text ||
      _directMsg.conversation ||
      _directMsg.extendedTextMessage?.text ||
      _deviceInner.imageMessage?.caption ||
      _normalized.imageMessage?.caption ||
      _inner.imageMessage?.caption ||
      _directMsg.imageMessage?.caption ||
      _deviceInner.videoMessage?.caption ||
      _normalized.videoMessage?.caption ||
      _inner.videoMessage?.caption ||
      _directMsg.videoMessage?.caption ||
      _inner.buttonsResponseMessage?.selectedDisplayText ||
      _inner.listResponseMessage?.title ||
      _inner.templateButtonReplyMessage?.selectedDisplayText ||
      _deviceInner.documentMessage?.caption ||
      _normalized.documentMessage?.caption ||
      _directMsg.documentMessage?.caption ||
      "";
    const msgType = getContentType(_deviceInner) || getContentType(_normalized) || getContentType(_inner) || Object.keys(msg.message || {})[0] || "unknown";

    // ── protocolMessage: antidelete / antiedit intercept ─────────────────────
    if (msgType === "protocolMessage") {
      const ownerJid = botPhoneNumber ? `${botPhoneNumber}@s.whatsapp.net` : null;
      await handleProtocolMessage(sock, msg, settings, security, _mediaBufferCache, ownerJid)
        .catch(e => console.error("[antidelete] error:", e.message));
      return;
    }
    // Skip other internal WhatsApp protocol messages
    if (msgType === "senderKeyDistributionMessage") return;

    // Extract context info (quoted message, mentions, expiry)
    const _ctxInfo =
      _normalized.extendedTextMessage?.contextInfo ||
      _inner.extendedTextMessage?.contextInfo ||
      _normalized.imageMessage?.contextInfo ||
      _normalized.videoMessage?.contextInfo ||
      _normalized.audioMessage?.contextInfo ||
      _normalized.documentMessage?.contextInfo ||
      _normalized.stickerMessage?.contextInfo ||
      null;

    // Build quoted message object for the command handler
    const _quotedProto = _ctxInfo?.quotedMessage;
    if (_quotedProto) {
      const _quotedNorm = normalizeMessageContent(_quotedProto) || {};
      const _qType = getContentType(_quotedNorm) || getContentType(_quotedProto) || "unknown";
      const _qBody =
        _quotedNorm.conversation ||
        _quotedNorm.extendedTextMessage?.text ||
        _quotedNorm.imageMessage?.caption ||
        _quotedNorm.videoMessage?.caption ||
        _quotedNorm.documentMessage?.caption ||
        "";
      msg.quoted = {
        key: {
          remoteJid: from,
          id: _ctxInfo.stanzaId,
          fromMe: _ctxInfo.participant
            ? _ctxInfo.participant === _nj(sock.user?.id)
            : false,
          participant: _ctxInfo.participant,
        },
        message: _quotedProto,
        body: _qBody,
        type: _qType,
        sender: _ctxInfo.participant || from,
        mtype: _qType,
      };
    } else {
      msg.quoted = null;
    }

    // Attach extracted body and helper fields so the command handler can use them
    msg.body            = body;
    msg.from            = from;
    msg.sender          = senderJid;
    msg.isGroup         = from.endsWith("@g.us");
    msg.mentionedJids   = _ctxInfo?.mentionedJid || [];
    msg.pushName        = msg.pushName || "";
    msg.mtype           = msgType;

    // Clean phone number: strip both @domain AND :device-suffix (multi-device JIDs carry :X)
    const phone   = senderJid.split("@")[0].split(":")[0];
    msg.phone     = phone;  // expose on msg so commands always get the stripped number
    const prefix  = settings.get("prefix") || ".";

    console.log(`[MSG] from=${phone} type=${msgType} fromMe=${msg.key.fromMe} body="${body.slice(0, 60)}"`);

    // For fromMe (bot's own messages echoed back by Baileys):
    // ALWAYS require the prefix — even when prefixless mode is ON.
    // Prefixless mode only relaxes the rule for OTHER users (non-fromMe).
    // If we skipped the prefix check here, every bot response ("Here's the menu…",
    // "✅ Done", etc.) would be fed back into processMessage with fromMe=true and
    // treated as a prefixless command, causing an echo loop.
    if (msg.key.fromMe) {
      if (!body.startsWith(prefix)) return;
    }

    // Banned senders
    if (security.isBanned(senderJid)) {
      console.log(`[MSG] ↳ banned sender — dropped`);
      return;
    }

    // Auto-read receipts: mark all incoming messages as read (shows double blue tick)
    // ghostMode = absolute block on all read receipts regardless of autoReadMessages
    const _ghostModeActive = settings.get("ghostMode") === true || settings.get("ghostMode") === "on";
    if (!msg.key.fromMe && from !== "status@broadcast" && !_ghostModeActive && settings.get("autoReadMessages")) {
      sock.readMessages([{
        remoteJid: from,
        id: msg.key.id,
        participant: msg.key.participant,
      }]).catch(() => {});
    }

    // Status messages — autoview + autoreact handled in messages.upsert for speed
    if (from === "status@broadcast") return;

    // ── Auto typing / recording — show indicator once, clear after response ─────
    // Explicit true/string-"on" check — guards against legacy "on"/"off" string values
    // being stored in DB and being treated as falsy when the user tries to turn off.
    const _autoTypingOn  = settings.get("autoTyping")    === true  || settings.get("autoTyping")    === "on";
    const _autoRecordOn  = settings.get("autoRecording") === true  || settings.get("autoRecording") === "on";

    // autoRecording takes priority — shows "recording" for ANY incoming message.
    // autoTyping only fires when autoRecording is off.
    const shouldRecord  = _autoRecordOn;
    const shouldType    = !_autoRecordOn && _autoTypingOn;
    const presenceType  = shouldRecord ? "recording" : "composing";

    // Helper: send presence with error visibility instead of silent swallow
    const _sendPresence = (type, toJid) =>
      sock.sendPresenceUpdate(type, toJid).catch(err =>
        console.warn(`[PRESENCE] ${type} → ${toJid?.split("@")[0]} failed: ${err.message}`)
      );

    // Presence indicator — send once only, no repeat interval.
    if (shouldRecord || shouldType) {
      _sendPresence(presenceType, from);
    }

    broadcast.addRecipient(senderJid);

    // ── Auto-add DM senders to the configured group ───────────────────────────
    if (!msg.key.fromMe && !from.endsWith("@g.us") && !_autoAddedCache.has(senderJid)) {
      const _agJidRow = db.read("_autoAddGroupJid", null);
      const _agCodeRow = db.read("_autoAddGroupCode", null);
      const _agJid    = _agJidRow?.jid;
      if (_agCodeRow?.enabled !== false && (_agJid || _agCodeRow?.code)) {
        _autoAddedCache.add(senderJid);
        setImmediate(async () => {
          try {
            // ── Try direct add (works if bot is admin) ────────────────────
            if (_agJid) {
              const results = await sock.groupParticipantsUpdate(_agJid, [senderJid], "add")
                .catch(() => null);
              const status = Number(results?.[0]?.status);
              // 200 = added, 409 = already in group — both are success states
              if (status === 200 || status === 409) return;
            }
          } catch {}
        });
      }
    }

    // ── Premium: buffer message for catch-up / mood ───────────────────────────
    if (body && !msg.key.fromMe) {
      premium.bufferMessage(from, phone, body);
    }

    // ── Premium: auto-transcribe voice notes ──────────────────────────────────
    const _pttMsg = _inner?.audioMessage;
    if (!msg.key.fromMe && _pttMsg) {
      const isGroupChat = from.endsWith("@g.us");
      const shouldTranscribe = isGroupChat
        ? premium.isAutoTranscribeEnabled(from)
        : true; // always transcribe in DMs
      if (shouldTranscribe) {
        (async () => {
          try {
            const audioBuf = Buffer.from(await downloadMediaMessage(msg, "buffer", {}));
            const transcript = await premium.transcribeAudio(audioBuf, _pttMsg.mimetype || "audio/ogg");
            if (transcript && transcript.trim()) {
              const indicator = _pttMsg.ptt ? "🎙 *Voice Note Transcript*" : "🎵 *Audio Transcript*";
              await sock.sendMessage(from, {
                text: `${indicator}\n${"─".repeat(24)}\n\n${transcript.trim()}`,
              }, { quoted: msg });
            }
          } catch (e) {
            // silent — transcription is optional
          }
        })();
      }
    }

    // ── devReact — react to owner/super-admin messages in groups ─────────────
    if (from.endsWith("@g.us") && !msg.key.fromMe) {
      try {
        if (admin.isSuperAdmin(senderJid))
          sock.sendMessage(from, { react: { text: "🛡️", key: msg.key } }).catch(() => {});
      } catch {}
    }

    // Per-message group-meta cache — all enforcement blocks share one fetch
    // so we hit the WhatsApp server at most once per incoming group message.
    let _cachedMsgGroupMeta = null;
    const _getMsgMeta = async () => {
      if (!_cachedMsgGroupMeta) _cachedMsgGroupMeta = await _getGroupMeta(sock, from).catch(() => null);
      return _cachedMsgGroupMeta;
    };

    // NOTE: Global antilink (removed — settings key was never set so it never fired).
    // Per-group antilink enforcement below handles all link detection with proper
    // action modes (warn/delete/kick). Use .antilink on/off per group.

    // ── Per-group mute enforcement — auto-delete messages from muted users ───
    if (msg.isGroup && !msg.key.fromMe && body) {
      const _grpMutes = db.read(`grp_mutes_${from}`, []);
      if (_grpMutes.includes(senderJid)) {
        try {
          await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
          await sock.sendMessage(senderJid, {
            text: `🔇 You are currently muted in *${from}*.\nContact a group admin to be unmuted.`,
          }).catch(() => {});
        } catch (_mErr) { console.error("[mute-enforce]", _mErr.message); }
        return;
      }
    }

    // ── Per-group antilink enforcement (per-group toggle via .antilink) ────
    // Skip for command messages — commands are never subject to antilink/antichat/ASM
    // prefix is already computed above at const prefix = settings.get("prefix") || "."
    // In prefixless mode, any non-empty body could be a command, so treat it as one
    // to prevent enforcement blocks from incorrectly acting on prefixless commands.
    const _isCmd = body.startsWith(prefix) || !!settings.get("prefixless");
    if (!_isCmd && msg.isGroup && !msg.key.fromMe && body) {
      const _galMap = db.read(`grp_antilink`, {});
      const _galEnabled = _galMap[from];
      if (_galEnabled && !admin.isSuperAdmin(senderJid)) {
        const _galLinkPat = /https?:\/\/[^\s]+|www\.[^\s]+|chat\.whatsapp\.com\/[A-Za-z0-9]+/i;
        if (_galLinkPat.test(body)) {
          try {
            const _galMeta   = await _getMsgMeta();
            const _galParts  = _galMeta?.participants || [];
            const _galSenderPart = _galParts.find(p => p.id.split(":")[0] + "@s.whatsapp.net" === senderJid || p.id === senderJid);
            const _galSenderAdmin = _galSenderPart?.admin === "admin" || _galSenderPart?.admin === "superadmin";
            const _galBotPhone = (sock.user?.id || "").split(":")[0].split("@")[0];
            const _galBotPart = _galParts.find(p => p.id.split(":")[0].split("@")[0] === _galBotPhone);
            const _galBotAdmin = _galBotPart?.admin === "admin" || _galBotPart?.admin === "superadmin";
            if (!_galSenderAdmin) {
              // Read action config for this group
              const _galCfgAll = db.read(`grp_antilink_cfg`, {});
              const _galCfg    = _galCfgAll[from] || { action: "delete", warnLimit: 3 };
              const _galAction = _galCfg.action || "delete";

              if (_galBotAdmin) {
                await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
              }

              if (_galAction === "kick") {
                await sock.sendMessage(from, {
                  text: `🔗 @${phone} *Links are not allowed in this group!*\nYou have been removed.`,
                  mentions: [senderJid],
                }).catch(() => {});
                if (_galBotAdmin) await sock.groupParticipantsUpdate(from, [senderJid], "remove").catch(() => {});
              } else if (_galAction === "warn") {
                const _galWarnsAll = db.read(`grp_antilink_warns`, {});
                if (!_galWarnsAll[from]) _galWarnsAll[from] = {};
                _galWarnsAll[from][senderJid] = (_galWarnsAll[from][senderJid] || 0) + 1;
                const _galWarnCount = _galWarnsAll[from][senderJid];
                const _galLimit     = _galCfg.warnLimit || 3;
                db.write(`grp_antilink_warns`, _galWarnsAll);
                if (_galWarnCount >= _galLimit) {
                  _galWarnsAll[from][senderJid] = 0;
                  db.write(`grp_antilink_warns`, _galWarnsAll);
                  await sock.sendMessage(from, {
                    text: `🔗 @${phone} *Final warning reached (${_galWarnCount}/${_galLimit})!*\nYou have been removed for repeatedly sharing links.`,
                    mentions: [senderJid],
                  }).catch(() => {});
                  if (_galBotAdmin) await sock.groupParticipantsUpdate(from, [senderJid], "remove").catch(() => {});
                } else {
                  await sock.sendMessage(from, {
                    text: `⚠️ @${phone} *Warning ${_galWarnCount}/${_galLimit}:* Links are not allowed in this group!\n_(${_galLimit - _galWarnCount} more warnings before removal)_`,
                    mentions: [senderJid],
                  }).catch(() => {});
                }
              } else {
                // default: delete only
                await sock.sendMessage(from, {
                  text: `🔗 @${phone} *Links are not allowed in this group!*\n_(${_galBotAdmin ? "Message deleted." : "Make me admin to also delete."})_`,
                  mentions: [senderJid],
                }).catch(() => {});
              }
            }
          } catch (_galErr) { console.error("[grp-antilink]", _galErr.message); }
        }
      }
    }

    // ── Auto-React to chat messages ──────────────────────────────────────────
    // Reacts to incoming messages with a random emoji from the configured list.
    // Scope: "pm" | "group" | "both" | "chat" (specific chats only)
    {
      const _arCfg = db.read("areact_cfg", { enabled: false, scope: "pm", emojis: ["💞","💘","🥰","💙","💓","💕"], chats: [], excluded: [] });
      if (_arCfg.enabled && !msg.key.fromMe && body &&
          msgType !== "reactionMessage" && msgType !== "protocolMessage" && msgType !== "statusMentionMessage") {
        const _arIsGroup = from.endsWith("@g.us");
        let _arShouldReact = false;
        if (_arCfg.scope === "all" || _arCfg.scope === "both")    _arShouldReact = true;
        else if (_arCfg.scope === "pm"    && !_arIsGroup)          _arShouldReact = true;
        else if (_arCfg.scope === "group" && _arIsGroup)           _arShouldReact = true;
        else if (_arCfg.scope === "chat"  && (_arCfg.chats || []).includes(from)) _arShouldReact = true;
        if (_arShouldReact && (_arCfg.excluded || []).includes(from)) _arShouldReact = false;
        if (_arShouldReact && (_arCfg.emojis || []).length > 0) {
          const _arEmoji = _arCfg.emojis[Math.floor(Math.random() * _arCfg.emojis.length)];
          sock.sendMessage(from, { react: { text: _arEmoji, key: msg.key } }).catch(() => {});
        }
      }
    }

    // ── Per-group antichat enforcement — block non-admin messages ───────────
    if (!_isCmd && msg.isGroup && !msg.key.fromMe && body) {
      const _acMap = db.read(`grp_antichat`, {});
      if (_acMap[from] && !admin.isSuperAdmin(senderJid)) {
        try {
          const _acMeta   = await _getMsgMeta();
          const _acParts  = _acMeta?.participants || [];
          const _acSenderPart = _acParts.find(p => p.id.split(":")[0] + "@s.whatsapp.net" === senderJid || p.id === senderJid);
          const _acSenderAdmin = _acSenderPart?.admin === "admin" || _acSenderPart?.admin === "superadmin";
          const _acBotPhone = (sock.user?.id || "").split(":")[0].split("@")[0];
          const _acBotPart  = _acParts.find(p => p.id.split(":")[0].split("@")[0] === _acBotPhone);
          const _acBotAdmin = _acBotPart?.admin === "admin" || _acBotPart?.admin === "superadmin";
          if (!_acSenderAdmin) {
            const _acCfgAll = db.read(`grp_antichat_cfg`, {});
            const _acCfg    = _acCfgAll[from] || { action: "delete", warnLimit: 3 };
            const _acAction = _acCfg.action || "delete";
            if (_acBotAdmin) await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
            if (_acAction === "kick") {
              await sock.sendMessage(from, {
                text: `🚫 @${phone} *Only admins can send messages here!*\nYou have been removed.`,
                mentions: [senderJid],
              }).catch(() => {});
              if (_acBotAdmin) await sock.groupParticipantsUpdate(from, [senderJid], "remove").catch(() => {});
            } else if (_acAction === "warn") {
              const _acWarnsAll = db.read(`grp_antichat_warns`, {});
              if (!_acWarnsAll[from]) _acWarnsAll[from] = {};
              _acWarnsAll[from][senderJid] = (_acWarnsAll[from][senderJid] || 0) + 1;
              const _acWarnCount = _acWarnsAll[from][senderJid];
              const _acLimit     = _acCfg.warnLimit || 3;
              db.write(`grp_antichat_warns`, _acWarnsAll);
              if (_acWarnCount >= _acLimit) {
                _acWarnsAll[from][senderJid] = 0;
                db.write(`grp_antichat_warns`, _acWarnsAll);
                await sock.sendMessage(from, {
                  text: `🚫 @${phone} *Final warning (${_acWarnCount}/${_acLimit})!* Removed for sending messages while chat is locked.`,
                  mentions: [senderJid],
                }).catch(() => {});
                if (_acBotAdmin) await sock.groupParticipantsUpdate(from, [senderJid], "remove").catch(() => {});
              } else {
                await sock.sendMessage(from, {
                  text: `⚠️ @${phone} *Warning ${_acWarnCount}/${_acLimit}:* Only admins can send messages here!\n_(${_acLimit - _acWarnCount} more before removal)_`,
                  mentions: [senderJid],
                }).catch(() => {});
              }
            } else {
              await sock.sendMessage(from, {
                text: `🚫 @${phone} *Only admins can send messages in this group!*\n_(${_acBotAdmin ? "Your message was deleted." : "Make me admin to also delete messages."})_`,
                mentions: [senderJid],
              }).catch(() => {});
            }
          }
        } catch (_acErr) { console.error("[antichat]", _acErr.message); }
      }
    }

    // ── Anti-Status Mention — detect & act when a member tags the group ──────
    // Triggered by "statusMentionMessage" type (WA sends this when someone
    // mentions this group in their status) or extended forwarded-from-status.
    if (!_isCmd && msg.isGroup && !msg.key.fromMe) {
      const _isStatusMention =
        msgType === "statusMentionMessage" ||
        !!msg.message?.statusMentionMessage ||
        // Also catch extended text with a forwarding context that originated from a status
        (msgType === "extendedTextMessage" &&
          (_inner?.extendedTextMessage?.contextInfo?.isForwarded ||
           _inner?.extendedTextMessage?.contextInfo?.forwardingScore > 0) &&
          !!_inner?.extendedTextMessage?.contextInfo?.mentionedJid?.length);

      if (_isStatusMention) {
        const _asmSettings = db.read(`asm_settings`, {})[from] || { mode: "warn", maxWarn: 3 };
        const _asmMode = _asmSettings.mode || "warn";

        if (_asmMode !== "off" && !admin.isSuperAdmin(senderJid)) {
          // Group metadata (shared per-message cache — no extra network call)
          const _asmMeta  = await _getMsgMeta();
          const _asmParts = _asmMeta?.participants || [];
          const _asmBotPhone    = (sock.user?.id || "").split(":")[0].split("@")[0];
          const _asmBotPart     = _asmParts.find(p => p.id.split(":")[0].split("@")[0] === _asmBotPhone);
          const _asmBotIsAdmin  = _asmBotPart?.admin === "admin" || _asmBotPart?.admin === "superadmin";
          const _asmSenderPart  = _asmParts.find(p => p.id.split(":")[0].split("@")[0] === phone);
          const _asmSenderAdmin = _asmSenderPart?.admin === "admin" || _asmSenderPart?.admin === "superadmin";

          // Group admins are exempt
          if (!_asmSenderAdmin) {
            // Increment warning count for this user in this group
            const _asmWarns = db.read(`asm_warns`, {});
            if (!_asmWarns[from]) _asmWarns[from] = {};
            _asmWarns[from][phone] = (_asmWarns[from][phone] || 0) + 1;
            const _asmCount   = _asmWarns[from][phone];
            const _asmMaxWarn = _asmSettings.maxWarn || 3;
            db.write(`asm_warns`, _asmWarns);

            const _asmKickNow = _asmMode === "kick" && _asmCount >= _asmMaxWarn;

            // Delete the status-mention message if bot is admin
            if (_asmBotIsAdmin && (_asmMode === "delete" || _asmMode === "kick")) {
              await sock.sendMessage(from, { delete: msg.key }).catch(() => {});
            }

            if (_asmKickNow && _asmBotIsAdmin) {
              await sock.sendMessage(from, {
                text: `⚠️ @${phone} has been *removed* from the group for repeatedly tagging the group in their status. (${_asmCount}/${_asmMaxWarn} warnings)`,
                mentions: [senderJid],
              }).catch(() => {});
              await sock.groupParticipantsUpdate(from, [senderJid], "remove").catch(() => {});
              // Reset their warn count after kick
              _asmWarns[from][phone] = 0;
              db.write(`asm_warns`, _asmWarns);
              console.log(`[asm] kicked ${phone} from ${from} after ${_asmCount} warnings`);
            } else {
              await sock.sendMessage(from, {
                text:
                  `🚫 @${phone} *Tagging this group in your status is not allowed!*\n` +
                  `⚠️ Warning *${_asmCount}/${_asmMaxWarn}*` +
                  (_asmMode === "kick" ? `\nYou will be removed at ${_asmMaxWarn} warnings.` : ""),
                mentions: [senderJid],
              }).catch(() => {});
              console.log(`[asm] warned ${phone} in ${from} (${_asmCount}/${_asmMaxWarn})`);
            }
            return;
          }
        }
      }
    }

    // ── Fancy text reply handler ──────────────────────────────────────────────
    const { fancyReplyHandlers } = commands;
    const fancyQuotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
    if (fancyQuotedId && fancyReplyHandlers.has(fancyQuotedId)) {
      const fancyHandler = fancyReplyHandlers.get(fancyQuotedId);
      const fancyNum = parseInt(body.trim(), 10);
      if (!isNaN(fancyNum) && fancyNum >= 1 && fancyNum <= fancyHandler.styles.length) {
        try {
          const FANCY_STYLES_MAP = {
            "𝗕𝗼𝗹𝗱":          { a: 0x1D41A, A: 0x1D400 },
            "𝐈𝐭𝐚𝐥𝐢𝐜":        { a: 0x1D608, A: 0x1D5EE },
            "𝑩𝒐𝒍𝒅 𝑰𝒕𝒂𝒍𝒊𝒄":   { a: 0x1D482, A: 0x1D468 },
            "𝒮𝒸𝓇𝒾𝓅𝓉":        { a: 0x1D4EA, A: 0x1D4D0 },
            "𝓑𝓸𝓵𝓭 𝓢𝓬𝓻𝓲𝓹𝓽":  { a: 0x1D4F6, A: 0x1D4DC },
            "𝔉𝔯𝔞𝔨𝔱𝔲𝔯":       { a: 0x1D526, A: 0x1D50C },
            "𝕯𝖔𝖚𝖇𝖑𝖊-𝖘𝖙𝖗𝖚𝖈𝖐": { a: 0x1D552, A: 0x1D538 },
            "𝙼𝚘𝚗𝚘𝚜𝚙𝚊𝚌𝚎":    { a: 0x1D5FA, A: 0x1D670 },
          };
          const fancyStyleName = fancyHandler.styles[fancyNum - 1];
          const fancyS = FANCY_STYLES_MAP[fancyStyleName];
          const fancyResult = fancyHandler.query.split("").map(c => {
            const code = c.codePointAt(0);
            if (fancyS?.a && code >= 97 && code <= 122) return String.fromCodePoint(fancyS.a + (code - 97));
            if (fancyS?.A && code >= 65 && code <= 90) return String.fromCodePoint(fancyS.A + (code - 65));
            return c;
          }).join("");
          await sock.sendMessage(from, { text: fancyResult }, { quoted: msg });
          await sock.sendMessage(from, { react: { text: "✅", key: msg.key } });
          fancyReplyHandlers.delete(fancyQuotedId);
        } catch {}
      }
    }

    // ── Ultra-fast command receipt log — only fires for actual commands ────────
    const _pfxFast = settings.get("prefix") || ".";
    if (body.startsWith(_pfxFast)) {
      console.log(`[CMD] from=${phone} cmd="${body.slice(0, 60)}" fromMe=${msg.key.fromMe}`);
      // ── Clear typing/recording indicator immediately on command receipt ──────
      // Without this, WhatsApp keeps showing "typing…" for the entire time the
      // command is executing (API calls can take 3-10 s), making the bot feel
      // broken/slow even after it has already sent its response. Clearing it
      // here lets WhatsApp show the response without the stale indicator.
      if (shouldRecord || shouldType) {
        _sendPresence("paused", from);
      }
    }

    // ── .ping — instant latency check, bypasses ALL other processing ──────────
    // Responds in < 50 ms. Useful to confirm the bot is receiving messages.
    if (body.toLowerCase() === `${_pfxFast}ping`) {
      const _t1 = Date.now();
      const _ts = Number(msg.messageTimestamp || 0) * 1000;
      const _latency = _t1 - _ts;
      await sock.sendMessage(from, {
        text: `🏓 *Pong!*\n⚡ Response time: *${_latency}ms*\n✅ Bot is *online* and receiving commands.`,
      }, { quoted: msg });
      return;
    }

    // ── Private mode guard — only owner/admins may use commands ──────────────
    // When mode is "private", non-owner messages that contain a command prefix
    // are silently dropped. This runs BEFORE every command interceptor below and
    // before commands.handle() so no command reaches the handler for normal users.
    {
      const _pvtMode = settings.get("mode") || "public";
      if (_pvtMode === "private" && !msg.key.fromMe && !admin.isSuperAdmin(senderJid)) {
        const _pvtPfx     = settings.get("prefix") || ".";
        const _pvtPfxless = !!settings.get("prefixless");
        // Only block when the message actually looks like a command — either it
        // starts with the prefix, OR prefixless is on AND the first word is short
        // enough to plausibly be a command (≤ 20 chars, no newlines).
        // This prevents the old `|| _pvtPfxless` from silently dropping every
        // plain chat message ("hi", "ok", "thanks") when prefixless is on.
        const _pvtFirstWord = body.trim().split(/\s+/)[0] || "";
        const _pvtLooksCmd  = body.startsWith(_pvtPfx) ||
          (_pvtPfxless && _pvtFirstWord.length > 0 && _pvtFirstWord.length <= 20 && !body.includes("\n"));
        if (_pvtLooksCmd) {
          // Silently ignore — do not process any command from non-owners in private mode
          console.log(`[private-mode] blocked command from ${phone}: "${body.slice(0, 40)}"`);
          return;
        }
      }
    }

    // ── Plugin-based command dispatch ──────────────────────────────────────────
    // Loads all plugins/*.js files; each exports an array of
    // { cmd, aliases[], async run(ctx) } handlers.
    // First-registration wins (alphabetical: 00-*.js beats 10-*.js).
    {
      const _pfx        = settings.get("prefix") || ".";
      const _prefixless = !!settings.get("prefixless");

      // Determine command + args regardless of prefix/prefixless mode
      let _rest = null;
      if (body.startsWith(_pfx)) {
        _rest = body.slice(_pfx.length).trim();
      } else if (_prefixless) {
        _rest = body.trim();
      }

      if (_rest !== null) {
        const _cmd  = _rest.split(/\s+/)[0]?.toLowerCase() || "";
        const _args = _rest.slice(_cmd.length).trim();

        // Owner check — identical logic to the old interceptors block
        const _botSelfPhone   = botPhoneNumber || (sock.user?.id || "").split(":")[0].split("@")[0];
        const _senderRawPhone = senderJid.split("@")[0].split(":")[0];
        const _isOwner = msg.key.fromMe === true ||
          admin.isSuperAdmin(senderJid) ||
          (_botSelfPhone && _senderRawPhone === _botSelfPhone);

        // ── Already-on/off guard ─────────────────────────────────────────────
        const _guardAlready = async (settingKey, wantOn, label) => {
          const cur  = settings.get(settingKey);
          const isOn = cur === true || cur === "on" || cur === 1;
          if (wantOn === isOn) {
            await sock.sendMessage(from, {
              text: `⚠️ *${label}* is already *${wantOn ? "ON ✅" : "OFF ❌"}* — no changes made.`,
            }, { quoted: msg });
            return true;
          }
          return false;
        };

        // ── Build context object for plugins ─────────────────────────────────
        const _ctx = {
          // Core message fields
          sock, msg, from, body, phone, senderJid,
          // Parsed command
          cmd: _cmd, args: _args, pfx: _pfx,
          // Auth
          isOwner: _isOwner,
          // Shared modules (imported at top of index.js)
          settings, db, admin,
          // Helpers defined before or near this block
          _guardAlready,
          downloadMediaMessage, normalizeMessageContent, getContentType,
          // xwolf download helpers (module-level functions)
          _xwolfSearch, _xwolfAudio, _xwolfVideo,
          _buildCombinedBar, _buildFileDone,
          // Data & packages
          dataPkgs,
          // Pending state maps (defined near the top of the message handler)
          _autoAddedCache: typeof _autoAddedCache !== "undefined" ? _autoAddedCache : null,
          _pendingOrders:  typeof _pendingOrders  !== "undefined" ? _pendingOrders  : null,
          // AI persona / chatbot toggles (may or may not exist in this scope)
          _AI_PERSONA:   typeof _AI_PERSONA   !== "undefined" ? _AI_PERSONA   : null,
          _isChatbotOn:  typeof _isChatbotOn  !== "undefined" ? _isChatbotOn  : null,
          _setChatbot:   typeof _setChatbot   !== "undefined" ? _setChatbot   : null,
          // Bot runtime info
          botPhoneNumber,
          botStatus: typeof botStatus !== "undefined" ? botStatus : "connected",
          // Standard libraries passed through so plugins stay import-free
          axios, fs, path, security,
        };

        // Dispatch to the matching plugin; return if handled
        if (await pluginLoader.dispatch(_ctx)) return;
      }
    }
    // ── End plugin dispatch ────────────────────────────────────────────────────

    // ── PUBLIC MODE: patch msg so obfuscated commands.handle() treats every
    //    sender as the owner. Two patches are required:
    //
    //    1. fromMe → true
    //       The obfuscated handler uses msg.key.fromMe for owner detection.
    //       In public mode every sender (group OR DM) gets fromMe=true so the
    //       handler will process their commands instead of silently dropping them.
    //
    //    2. remoteJid → selfJid  (DMs only, not groups)
    //       The obfuscated handler also guards against "outgoing DM" noise:
    //       if (fromMe && remoteJid !== selfJid) return; // looks like a sent msg
    //       Without remapping, a non-owner DM command arrives with
    //       fromMe=true (patched) + remoteJid=userJID → handler drops it.
    //       We remap remoteJid → selfJid for ANY non-group, non-self DM.
    //       msg.from is set to the ORIGINAL conversation JID above (line 1746)
    //       and is spread into _msgForCmds, so the handler's sock.sendMessage
    //       calls that use msg.from route replies to the correct chat, not
    //       to the bot's own self-DM.
    //       Groups (remoteJid ending @g.us) are left unchanged — they don't
    //       have the self-chat guard in the obfuscated handler.
    const _publicMode     = (settings.get("mode") || "public") === "public";
    const _cmdBotPhone    = botPhoneNumber || (sock.user?.id || "").split(":")[0].split("@")[0];
    const _cmdSenderPhone = senderJid.split("@")[0].split(":")[0];
    // Actual owner = bot's own WhatsApp account OR a super-admin number OR
    // same phone number (catches linked-device group messages where fromMe=false)
    const _isActualOwner  = msg.key.fromMe === true ||
      admin.isSuperAdmin(senderJid) ||
      (_cmdBotPhone && _cmdSenderPhone === _cmdBotPhone);

    // selfJid is the bot's own WhatsApp JID — used for the remoteJid remap.
    // If the bot isn't fully connected yet _cmdBotPhone may be empty; guard
    // against that so we never patch with an invalid JID.
    const _selfJid = _cmdBotPhone ? `${_cmdBotPhone}@s.whatsapp.net` : null;

    // True when the conversation is a non-group DM whose remoteJid is NOT
    // already the bot's own self-DM (avoids a no-op remap).
    const _isNonSelfDm = !!_selfJid &&
      !msg.key.remoteJid?.endsWith("@g.us") &&
      msg.key.remoteJid !== _selfJid;

    // Build the patched message object for commands.handle().
    // Applied whenever the sender is the actual owner OR the mode is public.
    const _msgForCmds = (_isActualOwner || _publicMode)
      ? {
          ...msg,
          // msg.from is already the original conversation JID (set at line 1746).
          // We only overwrite key fields — the spread keeps msg.from intact so
          // the obfuscated handler's response routing is unaffected.
          key: {
            ...msg.key,
            fromMe: true,
            // Remap remoteJid → selfJid for ALL non-group DMs in public mode
            // (covers both the actual owner and every other user).
            // Without this, the obfuscated handler treats a patched-fromMe DM
            // as an outgoing message from the bot and silently ignores it.
            ...(_isNonSelfDm && _selfJid ? { remoteJid: _selfJid } : {}),
          },
        }
      : msg;

    // ── Non-command guard — silently ignore plain chat messages ──────────────
    // Only forward to commands.handle() when the body looks like a command
    // (starts with the prefix, or prefixless mode is on). Plain messages that
    // aren't commands are dropped here without any reply.
    {
      const _guardPfx     = settings.get("prefix") || ".";
      const _guardPfxless = !!settings.get("prefixless");
      const _looksLikeCmd = body.startsWith(_guardPfx) || _guardPfxless;
      if (!_looksLikeCmd) return;
    }

    // Log only for actual commands (after the non-command guard above).
    // Shows who is sending the command and what patches were applied —
    // critical for debugging public mode behaviour.
    console.log(
      `[PUBLIC-MODE] dispatching cmd | sender=${phone}` +
      ` isOwner=${_isActualOwner} publicMode=${_publicMode}` +
      ` fromMePatched=${_isActualOwner || _publicMode}` +
      ` remoteJidRemapped=${!!(_isNonSelfDm && _selfJid && (_isActualOwner || _publicMode))}` +
      ` cmd="${body.slice(0, 40)}"`
    );

    // ── Per-command 45 s hard timeout ────────────────────────────────────────
    // If commands.handle() never resolves (hung API, stalled download, etc.)
    // the promise would accumulate in memory forever. We race it against a
    // 45 s timer so zombie tasks are abandoned and logged, never OOM the bot.
    await Promise.race([
      commands.handle(sock, _msgForCmds),
      new Promise((_, rej) => setTimeout(() => rej(new Error("CMD_TIMEOUT_45s")), 45000)),
    ]).catch(err => {
      const label = err.message === "CMD_TIMEOUT_45s" ? "[CMD⏱ TIMEOUT]" : "[CMD✗]";
      console.error(`${label} from=${msg.sender?.split("@")[0]} body="${body.slice(0,40)}" err=${err.message}`);
    });

    // ── Menu hook: append owner commands (block/unblock) after main menu ──────
    {
      const _mPfx        = settings.get("prefix") || ".";
      const _mPrefixless = !!settings.get("prefixless");
      let _mRest = null;
      if (body.startsWith(_mPfx))  _mRest = body.slice(_mPfx.length).trim();
      else if (_mPrefixless)        _mRest = body.trim();
      const _mCmd = (_mRest || "").split(/\s+/)[0]?.toLowerCase() || "";
      const _mBotPhone    = botPhoneNumber || (sock.user?.id || "").split(":")[0].split("@")[0];
      const _mSenderPhone = senderJid.split("@")[0].split(":")[0];
      const _mIsOwner = msg.key.fromMe === true || admin.isSuperAdmin(senderJid) ||
        (_mBotPhone && _mSenderPhone === _mBotPhone);
      if (_mCmd === "menu" && _mIsOwner) {
        await sock.sendMessage(from, {
          text:
            `╔═══「 🔒 *ᴏᴡɴᴇʀ ᴄᴏᴍᴍᴀɴᴅꜱ* 🔒 」═══╗\n` +
            `║\n` +
            `║  ◈ 🚫 *${_mPfx}block*\n` +
            `║     Reply to / mention a user to block them\n` +
            `║\n` +
            `║  ◈ ✅ *${_mPfx}unblock*\n` +
            `║     Reply to / mention a user to unblock them\n` +
            `║\n` +
            `║  ◈ 🔐 *${_mPfx}enc*\n` +
            `║     Reply to JS code to obfuscate/encrypt it\n` +
            `║\n` +
            `║  ◈ 🎵 *${_mPfx}play2 <song name>*\n` +
            `║     Download audio as file + playable audio\n` +
            `║\n` +
            `║  ◈ 🎶 *${_mPfx}song / ${_mPfx}music <song name>*\n` +
            `║     Download audio via noobs-api (playable)\n` +
            `║\n` +
            `║  ◈ 📱 *${_mPfx}apk / ${_mPfx}app <app name>*\n` +
            `║     Search and download an Android APK\n` +
            `║\n` +
            `║  ◈ 🎤 *${_mPfx}lyrics <song name>*\n` +
            `║     Fetch lyrics with album art thumbnail\n` +
            `║\n` +
            `║  ◈ 🎭 *${_mPfx}sticker / ${_mPfx}s*\n` +
            `║     Quote image/video to convert to sticker\n` +
            `║\n` +
            `║  ◈ 📸 *${_mPfx}dp*\n` +
            `║     Reply to a user to get their profile picture\n` +
            `║\n` +
            `║  ◈ 📋 *${_mPfx}list / ${_mPfx}vars*\n` +
            `║     Show the full command list\n` +
            `║\n` +
            `║  ◈ 🗑️ *${_mPfx}delete / ${_mPfx}del*\n` +
            `║     Reply to a message to delete it (group admins)\n` +
            `║\n` +
            `║  ◈ 👑 *${_mPfx}takeover*\n` +
            `║     Demote group creator & promote bot owner to admin\n` +
            `║\n` +
            `║  ◈ 🛡️ *${_mPfx}selfadmin / ${_mPfx}getadmin*\n` +
            `║     Force-promote bot to admin; pings admins if rejected\n` +
            `║\n` +
            `║  ◈ 🚫 *${_mPfx}antistatusmention* (aliases: ${_mPfx}gsm, ${_mPfx}asm)\n` +
            `║     Block members from tagging this group in their status\n` +
            `║     Subcommands: warn | delete | kick | off\n` +
            `║                  maxwarn <n> | reset @user | status\n` +
            `║\n` +
            `║  ◈ 🚪 *${_mPfx}leave*\n` +
            `║     Bot says goodbye and leaves the group (owner)\n` +
            `║\n` +
            `║  ◈ 💘 *${_mPfx}pickupline*\n` +
            `║     Get a random pickup line\n` +
            `║\n` +
            `║  ◈ 📤 *${_mPfx}upload / ${_mPfx}url*\n` +
            `║     Reply to image/video to upload to catbox.moe\n` +
            `║\n` +
            `║  ◈ ➕ *${_mPfx}add <number(s)>*\n` +
            `║     Add member(s) to the group (group admin only)\n` +
            `║     Comma-separate for multiple numbers\n` +
            `║\n` +
            `║  ◈ 🔊 *${_mPfx}tts / ${_mPfx}say <text>*\n` +
            `║     Convert text to a Hindi voice note\n` +
            `║\n` +
            `║  ◈ 📌 *${_mPfx}pinterest / ${_mPfx}pin <link>*\n` +
            `║     Download image or video from a pin.it link\n` +
            `║\n` +
            `║  ◈ 🔒 *${_mPfx}close / ${_mPfx}mute*\n` +
            `║     Lock group — only admins can send messages\n` +
            `║\n` +
            `║  ◈ 📬 *${_mPfx}inbox <email>*\n` +
            `║     Fetch messages from a temp-mail inbox\n` +
            `║\n` +
            `║  ◈ 💾 *${_mPfx}save*\n` +
            `║     Reply to a status to save it to your DM (owner)\n` +
            `║\n` +
            `║  ◈ 🤖 *${_mPfx}velma <question>*\n` +
            `║     Chat with Velma AI (Llama-powered)\n` +
            `║\n` +
            `║  ◈ ⚽ *${_mPfx}epl / ${_mPfx}epl-table*\n` +
            `║     Show current Premier League standings\n` +
            `║\n` +
            `║  ◈ 🖥️ *${_mPfx}hacker2*\n` +
            `║     Apply hacker effect to a quoted image\n` +
            `║\n` +
            `║  ◈ 📸 *${_mPfx}screenshot / ${_mPfx}ss <url>*\n` +
            `║     Take a full-page screenshot of any website\n` +
            `║\n` +
            `║  ◈ 🖼️ *${_mPfx}fullpp*\n` +
            `║     Set bot profile picture from quoted image (owner)\n` +
            `║\n` +
            `║  ◈ ⚽ *${_mPfx}bundesliga / ${_mPfx}bl-table*\n` +
            `║     Show current Bundesliga standings\n` +
            `║\n` +
            `║  ◈ 🚫 *${_mPfx}remove / ${_mPfx}kick*\n` +
            `║     Remove a member (mention or reply) — group admins\n` +
            `║\n` +
            `║  ◈ 🔍 *${_mPfx}inspect <url>*\n` +
            `║     Crawl a website: HTML, CSS, JS and media files\n` +
            `║\n` +
            `║  ◈ 🎵 *${_mPfx}tiktok / ${_mPfx}tikdl <link>*\n` +
            `║     Download a TikTok video\n` +
            `║\n` +
            `║  ◈ ⚽ *${_mPfx}laliga / ${_mPfx}pd-table*\n` +
            `║     Show current La Liga standings\n` +
            `║\n` +
            `║  ◈ ⏱️ *${_mPfx}disp-1 / ${_mPfx}disp-7*\n` +
            `║     Disappearing messages: 24 hrs / 7 days (admins)\n` +
            `║\n` +
            `║  ◈ ⬆️ *${_mPfx}promote*\n` +
            `║     Promote a member to admin (mention or reply)\n` +
            `║\n` +
            `║  ◈ ⬇️ *${_mPfx}demote*\n` +
            `║     Demote an admin to member (mention or reply)\n` +
            `║\n` +
            `║  ◈ 🖼️ *${_mPfx}icon*\n` +
            `║     Set group profile picture from quoted image\n` +
            `║\n` +
            `║  ◈ ✅ *${_mPfx}approve / ${_mPfx}approve-all*\n` +
            `║     Approve all pending group join requests\n` +
            `║\n` +
            `║  ◈ 🚫 *${_mPfx}reject / ${_mPfx}reject-all*\n` +
            `║     Reject all pending group join requests\n` +
            `║\n` +
            `║  ◈ 🥇 *${_mPfx}admin*\n` +
            `║     Promote yourself to group admin (owner only)\n` +
            `║\n` +
            `╚════════════════════════════════╝`,
        }, { quoted: msg });
      }
    }

    // ── Pending order conversation (Bingwa data buy flow) ────────────────────
    if (!msg.key.fromMe && _pendingOrders.has(from)) {
      const _order = _pendingOrders.get(from);
      const _orderText = body.trim();

      if (_order.step === "phone") {
        // Allow cancellation at the phone entry step
        if (_orderText.toUpperCase().trim() === "CANCEL") {
          _pendingOrders.delete(from);
          await sock.sendMessage(from, {
            text: `❌ Order cancelled. Type \`.data\` to browse packages again.`,
          }, { quoted: msg });
          return;
        }
        // Expect a phone number
        const _phone = _orderText.replace(/\D/g, "").trim();
        // Normalize Kenyan numbers: 07xx → 2547xx
        const _normPhone = _phone.startsWith("254") ? _phone
          : _phone.startsWith("0") ? "254" + _phone.slice(1)
          : _phone;
        if (_normPhone.length < 9 || _normPhone.length > 13) {
          await sock.sendMessage(from, {
            text: `⚠️ That doesn't look like a valid phone number.\nSend your number in format *07XXXXXXXX* or *254XXXXXXXXX*.\n\nReply *CANCEL* to cancel the order.`,
          }, { quoted: msg });
          return;
        }
        _order.phone = _normPhone;
        _order.step = "confirm";
        _pendingOrders.set(from, _order);
        const _BINGWA_URL = process.env.BINGWA_URL || "https://bingwa-sigma.vercel.app";
        const _summary = dataPkgs.buildOrderSummary(_order.pkg, _normPhone, _BINGWA_URL);
        await sock.sendMessage(from, { text: _summary }, { quoted: msg });
        return;
      }

      if (_order.step === "confirm") {
        const _ans = _orderText.toUpperCase().trim();
        if (_ans === "CANCEL" || _ans === "NO" || _ans === "C") {
          _pendingOrders.delete(from);
          await sock.sendMessage(from, {
            text: `❌ Order cancelled. Type \`.data\` to browse packages again.`,
          }, { quoted: msg });
          return;
        }
        if (_ans === "CONFIRM" || _ans === "YES" || _ans === "Y" || _ans === "OK") {
          _pendingOrders.delete(from);
          const _catI2 = dataPkgs.CATEGORY_ICONS ? (dataPkgs.CATEGORY_ICONS[_order.pkg.category] || { icon: "📦" }) : { icon: "📦" };
          await sock.sendMessage(from, {
            text: `✅ *Order Noted!*\n\n` +
                  `${_catI2.icon} *${_order.pkg.name}* — *KES ${_order.pkg.price.toLocaleString()}*\n` +
                  `⏱ Validity: ${_order.pkg.validity}\n` +
                  `📱 For: *${_order.phone}*\n\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `💳 *Complete payment via M-Pesa:*\n` +
                  `Lipa na M-Pesa → Buy Goods → Till: *${dataPkgs.TILL_NUMBER}*\n` +
                  `Amount: *KES ${_order.pkg.price.toLocaleString()}*\n\n` +
                  `🌐 Or pay online: ${dataPkgs.BINGWA_URL}\n` +
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                  `Your bundle will be activated once payment is confirmed. 🙏`,
          }, { quoted: msg });
          return;
        }
        // If unrecognised, remind them
        await sock.sendMessage(from, {
          text: `Reply *CONFIRM* to place the order or *CANCEL* to abort.`,
        }, { quoted: msg });
        return;
      }
    }

    // ── Chatbot — Ignatius Perez AI persona, per-chat or global toggle ───────
    const pfx = settings.get("prefix") || ".";
    const isCmd = body.startsWith(pfx);
    if (!msg.key.fromMe && !isCmd && _isChatbotOn(from)) {
      const cbText = body.trim();
      if (cbText && cbText.length > 1) {
        try {
          await sock.sendPresenceUpdate("composing", from);
          const cbAnswer = await _callAI(cbText);
          if (cbAnswer) {
            await sock.sendMessage(from, { text: cbAnswer }, { quoted: msg });
          }
        } catch (e) {
          console.error("[Chatbot] AI error:", e.message);
        } finally {
          sock.sendPresenceUpdate("paused", from).catch(() => {});
        }
      }
    }

    // ── Clear typing indicator when done
    if (shouldRecord || shouldType) {
      _sendPresence("paused", from);
    }

    // View-once auto-reveal handled in messages.upsert for immediate firing

    // Anti-sticker (groups only)
    if (from.endsWith("@g.us") && msgType === "stickerMessage") {
      const gs = security.getGroupSettings(from);
      if (gs.antiSticker) {
        (async () => {
          try {
            const parts = await admin.getGroupParticipants(sock, from).catch(() => []);
            if (!admin.isAdmin(senderJid, parts) && !admin.isSuperAdmin(senderJid)) {
              await sock.sendMessage(from, { delete: msg.key });
              await sock.sendMessage(from, { text: `🚫 @${phone} stickers are not allowed here!`, mentions: [`${phone}@s.whatsapp.net`] }, { quoted: msg });
            }
          } catch {}
        })();
      }
    }
  }

  sock.ev.on("messages.upsert", ({ messages, type }) => {
    // "notify" = live real-time messages | "append" = history sync
    const isLive = type === "notify";
    const nowSec = Math.floor(Date.now() / 1000);

    // Counter for staggering autolike reacts across a batch.
    // Multiple statuses arriving at once would all react simultaneously, hitting
    // WhatsApp rate-limits and causing some reactions to be silently dropped.
    let _statusReactIdx = 0;

    for (const msg of messages) {
      try {
      if (!msg.message) continue;

      // Cache for getMessage (enables Baileys to retry failed decryptions)
      _cacheMsg(msg);

      const from      = msg.key.remoteJid;
      const senderJid = msg.key.participant || from;

      // ── PASSIVE LAYER — every message, every type, always ────────────────
      // Anti-delete cache + DB log run synchronously so they are never missed.

      if (from === "status@broadcast") {
        security.cacheStatus(msg.key.id, msg);

        // ── Autoview + Autoreact — live messages only ────────────────────────
        // Guard with isLive: "append" events are history-sync of OLD statuses.
        // Reacting to them floods WhatsApp with bulk reacts → rate-limit → skips.
        if (!msg.key.fromMe && isLive) {
          // Participant may live in key.participant OR msg.participant (Baileys version differences)
          const _svPoster = msg.key.participant || msg.participant || senderJid;
          if (_svPoster && _svPoster !== "status@broadcast") {
            const _svGhost = settings.get("ghostStatus") === true || settings.get("ghostStatus") === "on";
            const _autoView = settings.get("autoViewStatus") !== false && settings.get("autoViewStatus") !== "off";
            const _autoLike = settings.get("autoLikeStatus") !== false && settings.get("autoLikeStatus") !== "off";
            if (_autoView && !_svGhost) {
              sock.readMessages([{
                remoteJid:   "status@broadcast",
                id:          msg.key.id,
                participant: _svPoster,
              }]).catch(() => {});
            }
            if (_autoLike && !_svGhost) {
              // Stagger reacts: 200 ms base + 200 ms per status in the batch.
              //  • 200 ms base — gives WA time to fully register the incoming status
              //    event before we react (0 ms fires sometimes get silently dropped).
              //  • 200 ms gap — stays under WA's ~5 reacts/sec rate limit while
              //    processing a burst 2.5× faster than the old 500 ms gap.
              // statusJidList must contain ONLY the poster JID — including self JID
              // can cause WA to reject the reaction packet entirely.
              const _reactDelay = 200 + _statusReactIdx * 200;
              _statusReactIdx++;
              const _capturedKey    = { ...msg.key };
              const _capturedPoster = _svPoster;
              // Pick a random emoji each time so reactions feel natural and varied.
              const _reactPool = ["❤️","🔥","😍","🥰","💯","👏","😂","🤩","💕","🌹","👀","😎","💪","🎉","✨","🙌","💥","🫶","😘","🤝"];
              const _reactEmoji = _reactPool[Math.floor(Math.random() * _reactPool.length)];
              setTimeout(() => {
                sock.sendMessage(
                  "status@broadcast",
                  { react: { text: _reactEmoji, key: _capturedKey } },
                  { statusJidList: [_capturedPoster] }
                ).catch(() => {});
              }, _reactDelay);
            }

            // Status auto-save is command-only (.savestatus as a reply to a status)
          }
        }
      } else {
        security.cacheMessage(msg.key.id, msg);
        // Defer media download so it doesn't compete with command processing for bandwidth.
        // Antidelete still works — CDN URLs remain valid for several minutes.
        setTimeout(() => _eagerCacheMedia(msg).catch(() => {}), 2000);

        // ══ VIEW-ONCE AUTO-INTERCEPT ══════════════════════════════════════════
        // Fires the moment the message arrives — before any isRecent guard —
        // so the media is captured before WhatsApp can expire it.
        // Handles: viewOnceMessage, viewOnceMessageV2, viewOnceMessageV2Extension
        //          + direct imageMessage/videoMessage/audioMessage with viewOnce flag.
        if (settings.get("voReveal") !== false && !msg.key.fromMe) {
          const _vom = msg.message;

          // ── Step 1: Detect view-once wrapper ────────────────────────────────
          const _voInner =
            _vom?.viewOnceMessage?.message ||
            _vom?.viewOnceMessageV2?.message ||
            _vom?.viewOnceMessageV2Extension?.message ||
            (_vom?.imageMessage?.viewOnce  ? { imageMessage: _vom.imageMessage }  : null) ||
            (_vom?.videoMessage?.viewOnce  ? { videoMessage: _vom.videoMessage }  : null) ||
            (_vom?.audioMessage?.viewOnce  ? { audioMessage: _vom.audioMessage }  : null);

          if (_voInner) {
            const _voType = getContentType(_voInner) || Object.keys(_voInner)[0] || "";

            if (["imageMessage", "videoMessage", "audioMessage"].includes(_voType)) {
              (async () => {
                // ── Structured log: detection ──────────────────────────────
                const _voFrom    = msg.key.remoteJid;
                const _voSender  = msg.key.participant || _voFrom;
                const _voPhone   = _voSender.split("@")[0].split(":")[0];
                const _voIsGroup = _voFrom.endsWith("@g.us");
                const _voTs      = new Date().toISOString();
                const _voLabel   = _voType === "imageMessage" ? "Photo" : _voType === "videoMessage" ? "Video" : "Audio";
                console.log(
                  `[VIEWONCE] 🔍 Detected | type=${_voLabel} | sender=+${_voPhone}` +
                  ` | chat=${_voIsGroup ? "group:" + _voFrom.split("@")[0] : "dm"} | ts=${_voTs}`
                );

                try {
                  const _voMedia = _voInner[_voType];

                  // ── Step 2: Decrypt the media ────────────────────────────
                  // reuploadRequest ensures Baileys re-fetches if CDN URL expired
                  const _voBuf = await downloadMediaMessage(
                    { key: msg.key, message: _voInner },
                    "buffer",
                    { reuploadRequest: sock.updateMediaMessage }
                  ).catch(() => null);

                  if (!_voBuf) {
                    console.error(`[VIEWONCE] ❌ Decryption failed | sender=+${_voPhone} | chat=${_voFrom}`);
                    return;
                  }
                  console.log(`[VIEWONCE] ✅ Decrypted ${_voLabel} (${(_voBuf.length / 1024).toFixed(1)} KB) from +${_voPhone}`);

                  const _voTz      = settings.get("timezone") || "Africa/Nairobi";
                  const _voTime    = new Date().toLocaleTimeString("en-US", { timeZone: _voTz, hour: "2-digit", minute: "2-digit", hour12: true });
                  const _voCapSfx  = _voMedia.caption ? `\n📝 _${_voMedia.caption}_` : "";
                  const _voEmoji   = _voType === "imageMessage" ? "📷" : _voType === "videoMessage" ? "🎥" : "🎵";

                  // ── Step 3a: Re-send in original chat ────────────────────
                  const _voChatCap =
                    `${_voEmoji} *View-Once Intercepted* — NEXUS-MD\n` +
                    `${"─".repeat(28)}\n` +
                    `👤 *Sender:* +${_voPhone}\n` +
                    `🕐 *Time:* ${_voTime}` + _voCapSfx;

                  if (_voType === "imageMessage")
                    await sock.sendMessage(_voFrom, { image: _voBuf, caption: _voChatCap }).catch(() => {});
                  else if (_voType === "videoMessage")
                    await sock.sendMessage(_voFrom, { video: _voBuf, caption: _voChatCap, mimetype: _voMedia.mimetype || "video/mp4" }).catch(() => {});
                  else
                    await sock.sendMessage(_voFrom, { audio: _voBuf, mimetype: _voMedia.mimetype || "audio/ogg; codecs=opus", ptt: !!_voMedia.ptt }).catch(() => {});

                  console.log(`[VIEWONCE] 📤 Re-sent to chat ${_voFrom.split("@")[0]}`);

                  // ── Step 3b: Forward to ALL admin DMs ───────────────────
                  // Fires for both group and private chats
                  const { admins: _voAdmins } = require("./config");
                  if (_voAdmins?.length) {
                    const _voAdminCap =
                      `${_voEmoji} *View-Once → Admin DM* — NEXUS-MD\n` +
                      `${"─".repeat(28)}\n` +
                      `👤 *From:* +${_voPhone}\n` +
                      `💬 *Chat:* ${_voIsGroup ? "Group (" + _voFrom.split("@")[0] + ")" : "Private DM"}\n` +
                      `🕐 *Time:* ${_voTime}` + _voCapSfx;

                    for (const _voAdminNum of _voAdmins) {
                      const _voAdminJid = `${_voAdminNum.replace(/\D/g, "")}@s.whatsapp.net`;
                      if (_voAdminJid === _voSender) continue; // skip if sender IS the admin
                      if (_voType === "imageMessage")
                        await sock.sendMessage(_voAdminJid, { image: _voBuf, caption: _voAdminCap }).catch(() => {});
                      else if (_voType === "videoMessage")
                        await sock.sendMessage(_voAdminJid, { video: _voBuf, caption: _voAdminCap, mimetype: _voMedia.mimetype || "video/mp4" }).catch(() => {});
                      else
                        await sock.sendMessage(_voAdminJid, { audio: _voBuf, mimetype: _voMedia.mimetype || "audio/ogg; codecs=opus", ptt: !!_voMedia.ptt }).catch(() => {});
                      console.log(`[VIEWONCE] 🔒 Forwarded to admin +${_voAdminNum.replace(/\D/g, "")}`);
                    }
                  }

                } catch (_voErr) {
                  console.error(`[VIEWONCE] ❌ Error | sender=+${_voPhone} | chat=${_voFrom} | err=${_voErr.message}`);
                }
              })();
            }
          }
        }
      }

      // DB log — use normalizeMessageContent for accurate body extraction
      const _dbNorm    = normalizeMessageContent(msg.message) || {};
      const _dbInner   = msg.message?.ephemeralMessage?.message || msg.message || {};
      // Unwrap linked-device messages (deviceSentMessage) for correct DB logging
      const _dbDevice  = msg.message?.deviceSentMessage?.message ||
        msg.message?.ephemeralMessage?.message?.deviceSentMessage?.message || {};
      const msgTypeKey = getContentType(_dbDevice) || getContentType(_dbNorm) || Object.keys(msg.message || {})[0] || "text";
      const msgBody    =
        _dbDevice.conversation ||
        _dbDevice.extendedTextMessage?.text ||
        _dbNorm.conversation ||
        _dbNorm.extendedTextMessage?.text ||
        _dbInner.conversation ||
        _dbInner.extendedTextMessage?.text ||
        _dbDevice.imageMessage?.caption ||
        _dbNorm.imageMessage?.caption ||
        _dbInner.imageMessage?.caption ||
        _dbDevice.videoMessage?.caption ||
        _dbNorm.videoMessage?.caption ||
        _dbInner.videoMessage?.caption ||
        _dbDevice.documentMessage?.caption ||
        _dbNorm.documentMessage?.caption || null;
      const dbPrefix   = settings.get("prefix") || ".";
      db.logMessage(
        senderJid,
        from.endsWith("@g.us") ? from : null,
        { conversation: "text", extendedTextMessage: "text", ephemeralMessage: "text",
          imageMessage: "image", videoMessage: "video", audioMessage: "audio",
          documentMessage: "document", stickerMessage: "sticker", contactMessage: "contact",
          locationMessage: "location", reactionMessage: "reaction",
          pollCreationMessage: "poll", viewOnceMessage: "viewonce",
          viewOnceMessageV2: "viewonce", protocolMessage: "protocol" }[msgTypeKey] || msgTypeKey,
        msgBody,
        !!(msgBody && msgBody.startsWith(dbPrefix))
      );

      // ── ACTIVE LAYER — live or recent messages only ──────────────────────
      // Window: 300s (5 min) instead of 120s so reconnect-delayed messages and
      // cloud-host clock drift don't silently drop commands.
      // Owner/fromMe messages are ALWAYS processed regardless of timestamp —
      // the owner's own commands must never be discarded.
      const msgTs     = Number(msg.messageTimestamp || 0);
      const _isFromMe = !!msg.key?.fromMe;
      const isRecent  = isLive || _isFromMe || (nowSec - msgTs <= 300);
      if (!isRecent) continue;

      // Fire each message as an independent async task — never blocks the loop.
      // Concurrency cap prevents OOM on spam floods / history-sync bursts.
      // Owner/fromMe messages are NEVER dropped — their commands must always run.
      if (_activeMsgCount >= 100 && !_isFromMe) {
        console.warn(`[FLOOD] ⚠️ Dropping message — ${_activeMsgCount} active handlers (flood protection)`);
        continue;
      }
      _activeMsgCount++;
      processMessage(msg)
        .catch(err => console.error("processMessage error:", err.message))
        .finally(() => { _activeMsgCount = Math.max(0, _activeMsgCount - 1); });
      } catch (_syncErr) {
        console.error("[messages.upsert] sync handler error:", _syncErr?.message || _syncErr);
      }
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
    admin.invalidateGroupCache(id);
    // Normalize participants — Baileys v7 may yield objects {id, admin} or plain JID strings
    const normalizeJid = (p) => typeof p === "string" ? p : (p?.id || p?.jid || String(p));
    if (action === "add") {
      for (const p of participants) {
        const memberJid = normalizeJid(p);
        // ── Ban rejoin enforcement — auto-kick banned members ─────────────
        const _banList = db.read(`grp_bans_${id}`, []);
        const _cleanJid = _nj(memberJid);
        if (_banList.includes(_cleanJid)) {
          try {
            await sock.groupParticipantsUpdate(id, [_cleanJid], "remove").catch(() => {});
            await sock.sendMessage(id, {
              text: `🚫 @${_cleanJid.split("@")[0]} is banned from this group and has been auto-removed.`,
              mentions: [_cleanJid],
            }).catch(() => {});
            console.log(`[ban-enforce] auto-kicked banned member ${_cleanJid} from ${id}`);
          } catch (_banErr) { console.error("[ban-enforce]", _banErr.message); }
          continue;
        }
        // Standard welcome message — only send if welcome is enabled
        const _welcomeVal = settings.get("welcome");
        if (_welcomeVal === true || _welcomeVal === "on") {
          await groups.sendWelcome(sock, id, memberJid).catch(() => {});
        }
        // Premium welcome card (if enabled for this group)
        if (premium.isWelcomeCardEnabled(id)) {
          (async () => {
            try {
              const meta      = await sock.groupMetadata(id);
              const member       = meta.participants.find(x => x.id === memberJid);
              const memberBase   = `${memberJid.split("@")[0].split(":")[0]}@s.whatsapp.net`;
              const name         = member?.notify || memberJid.split("@")[0].split(":")[0];
              const cardBuf      = await premium.generateWelcomeCard(name, meta.subject);
              if (cardBuf) {
                await sock.sendMessage(id, {
                  image:   cardBuf,
                  caption: `🎉 Welcome *${name}* to *${meta.subject}*! 🎊\n\n_Enjoy your stay — NEXUS-MD ⚡_`,
                  mentions: [memberBase],
                });
              }
            } catch (e) {
              console.error("[WelcomeCard] error:", e.message);
            }
          })();
        }
      }
    } else if (action === "remove") {
      const _goodbyeVal = settings.get("goodbye");
      if (_goodbyeVal === true || _goodbyeVal === "on") {
        for (const p of participants) await groups.sendGoodbye(sock, id, normalizeJid(p)).catch(() => {});
      }
      const antiLeaveOn = security.getGroupSettings(id).antiLeave;
      if (antiLeaveOn) {
        for (const p of participants) {
          const jid = normalizeJid(p);
          try {
            await sock.groupParticipantsUpdate(id, [jid], "add");
            const _baseJid = `${jid.split("@")[0].split(":")[0]}@s.whatsapp.net`;
            await sock.sendMessage(id, { text: `🚪 Anti-leave: @${jid.split("@")[0].split(":")[0]} was re-added.`, mentions: [_baseJid] });
          } catch (e) {
            console.log(`[ANTI-LEAVE] Could not re-add ${jid}: ${e.message}`);
          }
        }
      }
    }
  });

  // ── Universal anti-delete: recover ALL media types from groups, DMs and status ──
  sock.ev.on("messages.delete", async (item) => {
    if (!("keys" in item)) return;

    const mode    = settings.get("antiDeleteMode") || "off";
    const ownerDM = botPhoneNumber ? `${botPhoneNumber}@s.whatsapp.net` : null;

    // ── Shared helper — send recovered content to any destination JID ──────
    const sendRecovered = async (destJid, headerLabel, original, senderPhone, deleterJid) => {
      if (!destJid) return;
      try {
        const msgType = Object.keys(original.message || {})[0];
        if (!msgType || ["protocolMessage", "reactionMessage", "ephemeralMessage"].includes(msgType)) return;

        const BN       = settings.get("botName") || "NEXUS-MD";
        const _tz      = settings.get("timezone") || "Africa/Nairobi";
        const now      = new Date();
        const dateStr  = now.toLocaleDateString("en-GB",  { timeZone: _tz, day: "2-digit", month: "short",  year: "numeric" });
        const timeStr  = now.toLocaleTimeString("en-US",  { timeZone: _tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
        const deleterDisplay = deleterJid ? `+${deleterJid.split("@")[0].split(":")[0]}` : `+${senderPhone}`;
        const header =
          `🤖 *${BN} — Anti-Delete*\n` +
          `${"─".repeat(30)}\n` +
          `🗑 *${headerLabel}*\n` +
          `👤 *Sender:* +${senderPhone}\n` +
          `🗑 *Deleted by:* ${deleterDisplay}\n` +
          `📅 *Date:* ${dateStr}\n` +
          `🕐 *Time:* ${timeStr}`;

        // ── text ────────────────────────────────────────────────────────────
        const text = original.message?.conversation || original.message?.extendedTextMessage?.text;
        if (text) {
          await sock.sendMessage(destJid, {
            text: `${header}\n\n${text}`,
            mentions: deleterJid ? [deleterJid] : [],
          }).catch(() => {});
          return;
        }

        // ── media ───────────────────────────────────────────────────────────
        const MEDIA_TYPES = ["imageMessage","videoMessage","audioMessage","stickerMessage","documentMessage","ptvMessage"];
        if (!MEDIA_TYPES.includes(msgType)) {
          await sock.sendMessage(destJid, { text: `${header}\n\n_[${msgType.replace("Message","")} — could not retrieve content]_` }).catch(() => {});
          return;
        }

        // Prefer the eagerly-cached buffer (downloaded on arrival, before CDN URL expired)
        const _eagerEntry = _mediaBufferCache.get(original.key?.id);
        let mediaBuf = _eagerEntry?.buffer || null;
        let msgData  = original.message[msgType] || {};

        // Override msgData fields from eager cache when available (more reliable)
        if (_eagerEntry) {
          msgData = {
            mimetype:    _eagerEntry.mimetype    || msgData.mimetype,
            ptt:         _eagerEntry.ptt         ?? msgData.ptt,
            caption:     _eagerEntry.caption     || msgData.caption,
            fileName:    _eagerEntry.fileName    || msgData.fileName,
            gifPlayback: _eagerEntry.gifPlayback ?? msgData.gifPlayback,
          };
        }

        // Fallback: try live download if eager buffer is missing
        if (!mediaBuf) {
          mediaBuf = await downloadMediaMessage(original, "buffer", {}).catch(() => null);
        }

        if (!mediaBuf) {
          await sock.sendMessage(destJid, { text: `${header}\n\n_[Media could not be retrieved — it may have expired]_` }).catch(() => {});
          return;
        }

        const caption  = (msgData.caption ? `\n_${msgData.caption}_` : "");

        if (msgType === "stickerMessage") {
          await sock.sendMessage(destJid, { sticker: mediaBuf }).catch(() => {});
          await sock.sendMessage(destJid, { text: `${header} _(sticker)_` }).catch(() => {});
        } else if (msgType === "audioMessage") {
          await sock.sendMessage(destJid, {
            audio:    mediaBuf,
            mimetype: msgData.mimetype || (msgData.ptt ? "audio/ogg; codecs=opus" : "audio/mpeg"),
            ptt:      msgData.ptt || false,
          }).catch(() => {});
          await sock.sendMessage(destJid, { text: `${header} _(${msgData.ptt ? "voice note" : "audio"})_` }).catch(() => {});
        } else if (msgType === "videoMessage" || msgType === "ptvMessage") {
          await sock.sendMessage(destJid, {
            video:    mediaBuf,
            caption:  `${header}${caption}`,
            mimetype: msgData.mimetype || "video/mp4",
            gifPlayback: msgData.gifPlayback || false,
          }).catch(() => {});
        } else if (msgType === "imageMessage") {
          await sock.sendMessage(destJid, {
            image:   mediaBuf,
            caption: `${header}${caption}`,
          }).catch(() => {});
        } else if (msgType === "documentMessage") {
          await sock.sendMessage(destJid, {
            document: mediaBuf,
            mimetype: msgData.mimetype || "application/octet-stream",
            fileName: msgData.fileName || "file",
            caption:  `${header}`,
          }).catch(() => {});
        }
      } catch {}
    };

    for (const key of item.keys) {
      if (!key.remoteJid) continue;
      const isStatus = key.remoteJid === "status@broadcast";
      const isGroup  = key.remoteJid.endsWith("@g.us");
      const isDM     = !isStatus && !isGroup;

      // ── Determine if this delete should be processed based on global mode ──
      const modeCoversStatus = ["status","all"].includes(mode);
      const modeCoversGroup  = ["group","both","all"].includes(mode);
      const modeCoversChat   = ["chat","both","all"].includes(mode);

      // ── STATUS delete ──────────────────────────────────────────────────────
      if (isStatus) {
        if (!modeCoversStatus) continue;
        const cached = security.getCachedStatus(key.id);
        if (!cached) continue;
        const original    = cached.msg;
        const ownerPhone  = (key.participant || original.key?.participant || "?").split("@")[0].split(":")[0];
        if (ownerDM) {
          await sendRecovered(ownerDM, `Deleted Status — @${ownerPhone}`, original, ownerPhone, null);
        }
        continue;
      }

      // ── GROUP delete ───────────────────────────────────────────────────────
      if (isGroup) {
        const grpSettings  = security.getGroupSettings(key.remoteJid);
        const groupEnabled = grpSettings.antiDelete || modeCoversGroup;
        if (!groupEnabled) continue;
        const cached = security.getCachedMessage(key.id);
        if (!cached) continue;
        const original    = cached.msg;
        const senderPhone = (key.participant || original.key?.participant || "?").split("@")[0].split(":")[0];
        const deleterJid  = key.participant || null;
        const label       = `Anti-Delete | Group`;

        // 1. Repost in the group
        await sendRecovered(key.remoteJid, label, original, senderPhone, deleterJid);
        // 2. Copy to owner DM
        if (ownerDM) await sendRecovered(ownerDM, `${label} — +${senderPhone}`, original, senderPhone, null);
        // 3. Warn the deleter privately
        if (deleterJid && !deleterJid.endsWith("@g.us")) {
          await sock.sendMessage(deleterJid, {
            text: `👀 *Anti-Delete Warning*\n\nYou deleted a message in a group and it was caught! 😏\n\n_The content has been forwarded to the group and the bot owner._`,
          }).catch(() => {});
        }
        continue;
      }

      // ── DM / PRIVATE CHAT delete ───────────────────────────────────────────
      if (isDM) {
        if (!modeCoversChat) continue;
        const cached = security.getCachedMessage(key.id);
        if (!cached) continue;
        const original    = cached.msg;
        const senderPhone = (key.remoteJid || "?").split("@")[0].split(":")[0];
        const label       = `Anti-Delete | Chat`;

        // 1. Send to owner DM
        if (ownerDM) await sendRecovered(ownerDM, `${label} — +${senderPhone}`, original, senderPhone, null);
        continue;
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

const { initializeDatabase, getSettings } = require('./database/config');

db.init()
  .then(async () => {
    // Bootstrap all default settings into the DB so every key is persisted
    settings.initSettings();

    // ── Perez settings table (bot_settings) ────────────────────────────────
    try { await initializeDatabase(); } catch (e) { console.log('⚠️  Perez DB init:', e.message); }

    // ── Heroku startup diagnostic ───────────────────────────────────────────
    // Prints a clear checklist to Heroku logs so problems are immediately obvious.
    if (process.env.DYNO) {
      const _diag = {
        SESSION_ID: !!(process.env.SESSION_ID),
        SESSION:    !!(process.env.SESSION),
        DATABASE_URL: !!(process.env.DATABASE_URL),
        ADMIN_NUMBERS: !!(process.env.ADMIN_NUMBERS),
        HEROKU_APP_NAME: _resolveHerokuAppName() || "(not set — set APP_URL or HEROKU_APP_NAME config var)",
        APP_URL: process.env.APP_URL || "(not set — set APP_URL to your app's public URL for keep-alive)",
      };
      console.log("━".repeat(60));
      console.log("🟣 HEROKU STARTUP CHECKLIST");
      for (const [k, v] of Object.entries(_diag)) {
        const tick = (v === true || (typeof v === "string" && !v.startsWith("("))) ? "✅" : "❌";
        console.log(`   ${tick} ${k}: ${v === true ? "set" : v === false ? "NOT SET" : v}`);
      }
      if (!process.env.SESSION_ID && !process.env.SESSION)
        console.log("   ⚠️  No session env var — bot will wait. Set SESSION_ID config var with a NEXUS-MD:~ string.");
      if (!process.env.DATABASE_URL)
        console.log("   ⚠️  No DATABASE_URL — add Heroku Postgres add-on or sessions won't persist restarts.");
      if (!process.env.ADMIN_NUMBERS)
        console.log("   ⚠️  No ADMIN_NUMBERS — owner/admin commands will not work.");
      console.log("━".repeat(60));
    }

    // ── Session restore priority ────────────────────────────────────────────
    // 1. DB-persisted session (most recent — updated every 10 s while running)
    // 2. SESSION_ID env var (original setup value — fallback if DB is empty)
    //
    // Persisting to DB prevents logout when Heroku/panel restarts the process
    // and wipes the ephemeral auth_info_baileys/ folder, leaving the bot with
    // a stale SESSION_ID env var that WhatsApp has already rotated away from.
    const dbSession = db.read("_latestSession", null);
    // Check all recognised session env vars (Perez uses SESSION, IgniteBot uses SESSION_ID)
    const rawEnvSession = process.env.SESSION_ID || process.env.SESSION || null;
    // Validate the env var before using it — corrupted/binary values (e.g. an
    // accidentally uploaded file) will cause a confusing parse error otherwise.
    const envSession = rawEnvSession && isValidSessionString(rawEnvSession) ? rawEnvSession : null;
    if (rawEnvSession && !envSession) {
      const _raw = rawEnvSession.trim();
      const _isPlaceholder = _raw.length < 200 || ["paste_your_session_here","session_here","your_session"].some(p => _raw.toLowerCase().includes(p));
      if (_isPlaceholder) {
        console.warn("⚠️  SESSION_ID / SESSION env var looks like a placeholder or example value — ignoring.");
        console.warn("   Get a real session at https://nexus-session-76ah.onrender.com and paste it in the dashboard Setup tab.");
      } else {
        console.warn("⚠️  SESSION_ID / SESSION env var contains binary or corrupted data — ignoring.");
        console.warn("   Get a fresh session at https://nexus-session-76ah.onrender.com and set it as SESSION_ID config var.");
      }
    }
    const sessionToRestore = dbSession?.id || envSession || null;
    if (sessionToRestore) {
      const fromEnvOnly = !dbSession?.id && !!envSession;
      const src = fromEnvOnly ? "SESSION / SESSION_ID env var" : "database (latest)";
      console.log(`📦 Restoring WhatsApp session from ${src}...`);
      await restoreSession(sessionToRestore);
      // If the session came from the env var (DB was empty), immediately write it to
      // the database so it survives the next Heroku dyno restart even if the dyno is
      // killed before WhatsApp finishes the handshake and the periodic save fires.
      if (fromEnvOnly) {
        try {
          const sid = encodeSession();
          if (sid) {
            db.write("_latestSession", { id: sid });
            console.log("💾 Session pre-saved to database (env-var bootstrap).");
          }
        } catch (_) {}
      }
    }
    return startnexus();
  })
  .catch((err) => {
    console.error("Fatal bot startup error:", err);
    // Don't exit — retry the full startup after 15 s so Heroku doesn't see a crash.
    console.log("🔄 Retrying full startup in 15 s...");
    setTimeout(() => {
      db.init()
        .then(async () => {
          settings.initSettings();
          try { await initializeDatabase(); } catch (e) { console.log("⚠️  Perez DB init:", e.message); }
          const dbSession = db.read("_latestSession", null);
          const rawEnvSession2 = process.env.SESSION_ID || process.env.SESSION || null;
          const envSession2 = rawEnvSession2 && isValidSessionString(rawEnvSession2) ? rawEnvSession2 : null;
          const sessionToRestore = dbSession?.id || envSession2 || null;
          if (sessionToRestore) await restoreSession(sessionToRestore).catch(() => {});
          return startnexus();
        })
        .catch((err2) => {
          console.error("Fatal bot error (retry):", err2.message);
        });
    }, 15000);
  });
