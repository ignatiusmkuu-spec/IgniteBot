#!/usr/bin/env node
// Replaces the built-in interceptors block (lines 2201-9786) in index.js
// with a thin plugin-dispatch block that delegates to plugins/*.js

"use strict";

const fs   = require("fs");
const path = require("path");

const INDEX = path.join(__dirname, "..", "index.js");
const raw   = fs.readFileSync(INDEX, "utf8");
const lines = raw.split("\n");

const total = lines.length;
console.log(`[patch] index.js has ${total} lines`);

// ── Locate the block boundaries ───────────────────────────────────────────────
// Start: first line containing "// ── Built-in command interceptors"
// End  : last line containing "// ── End built-in interceptors"
let startIdx = -1, endIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (startIdx === -1 && lines[i].includes("// ── Built-in command interceptors")) {
    startIdx = i;
  }
  if (lines[i].includes("// ── End built-in interceptors")) {
    endIdx = i;
  }
}

if (startIdx === -1 || endIdx === -1) {
  console.error(`[patch] ERROR: Could not locate interceptors block.`);
  console.error(`  startIdx=${startIdx}  endIdx=${endIdx}`);
  process.exit(1);
}

console.log(`[patch] Interceptors block: lines ${startIdx + 1}–${endIdx + 1} (${endIdx - startIdx + 1} lines)`);

// ── Build the replacement block ───────────────────────────────────────────────
const replacement = `    // ── Plugin-based command dispatch ──────────────────────────────────────────
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
        const _cmd  = _rest.split(/\\s+/)[0]?.toLowerCase() || "";
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
              text: \`⚠️ *\${label}* is already *\${wantOn ? "ON ✅" : "OFF ❌"}* — no changes made.\`,
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
    // ── End plugin dispatch ────────────────────────────────────────────────────`;

// ── Splice in the new block ───────────────────────────────────────────────────
const before  = lines.slice(0, startIdx);
const after   = lines.slice(endIdx + 1);
const newLines = [...before, ...replacement.split("\n"), ...after];

fs.writeFileSync(INDEX, newLines.join("\n"), "utf8");
console.log(`[patch] ✅ Done! index.js is now ${newLines.length} lines (was ${total}).`);
console.log(`[patch] Removed ${endIdx - startIdx + 1} lines, inserted ${replacement.split("\\n").length} lines.`);
