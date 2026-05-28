"use strict";
// ── Core / owner-toggle commands ─────────────────────────────────────────────
// mode, antidelete, deleted, antiedit, takeover, selfadmin,
// antistatusmention, antimentiongroup

module.exports = [

  // ── .mode ──────────────────────────────────────────────────────────────────
  {
    cmd: "mode",
    aliases: ["botmode"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const _modeVal = (args || "").trim().toLowerCase();
      const _modeMap = { public:"public", pub:"public", open:"public", private:"private", priv:"private", closed:"private" };
      const _modeNew = _modeMap[_modeVal];
      if (!_modeNew) {
        const _curMode = settings.get("mode") || "public";
        const _curIcon = _curMode === "public" ? "🌍" : "🔒";
        await sock.sendMessage(from, {
          text:
`╔══〔 ⚙️ 𝗕𝗢𝗧 𝗠𝗢𝗗𝗘 〕═══════════════╗
╚═══════════════════════════════╝

${_curIcon} Current mode: *${_curMode.toUpperCase()}*

📖 *Modes:*
• 🌍 \`${pfx}mode public\`  — everyone can use commands
• 🔒 \`${pfx}mode private\` — only you (owner) can use commands

_Aliases: pub · open · priv · closed_`,
        }, { quoted: msg });
        return;
      }
      const _prevMode = settings.get("mode") || "public";
      if (_prevMode === _modeNew) {
        await sock.sendMessage(from, { text: `⚠️ Mode is already *${_modeNew.toUpperCase()}* — no change made.` }, { quoted: msg });
        return;
      }
      settings.set("mode", _modeNew);
      const _newIcon = _modeNew === "public" ? "🌍" : "🔒";
      await sock.sendMessage(from, {
        text:
`${_newIcon} *Bot mode changed!*

${_prevMode.toUpperCase()} → *${_modeNew.toUpperCase()}*

${_modeNew === "public"
  ? "✅ All users can now send commands to the bot."
  : "🔒 Only you (owner) can now send commands. All other users are silently ignored."}`,
      }, { quoted: msg });
    },
  },

  // ── .antidelete ────────────────────────────────────────────────────────────
  {
    cmd: "antidelete",
    aliases: ["antidel"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiDelete", wantOn, "Anti-Delete")) return;
        settings.set("antiDelete", wantOn);
        await sock.sendMessage(from, {
          text: `🗑️ *Anti-Delete* is now *${sub.toUpperCase()}*\n\n${wantOn ? "Deleted messages will be forwarded to you." : "Anti-delete is disabled."}`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("antiDelete") === true || settings.get("antiDelete") === "on";
        await sock.sendMessage(from, {
          text: `🗑️ *Anti-Delete*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antidelete on\`\n\`${pfx}antidelete off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .deleted ───────────────────────────────────────────────────────────────
  {
    cmd: "deleted",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiDelete", wantOn, "Anti-Delete")) return;
        settings.set("antiDelete", wantOn);
        await sock.sendMessage(from, {
          text: `🗑️ *Anti-Delete* is now *${sub.toUpperCase()}*`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("antiDelete") === true || settings.get("antiDelete") === "on";
        await sock.sendMessage(from, {
          text: `🗑️ *Anti-Delete* is currently *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage: \`${pfx}deleted on\` / \`${pfx}deleted off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .antiedit ──────────────────────────────────────────────────────────────
  {
    cmd: "antiedit",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiEdit", wantOn, "Anti-Edit")) return;
        settings.set("antiEdit", wantOn);
        await sock.sendMessage(from, {
          text: `✏️ *Anti-Edit* is now *${sub.toUpperCase()}*\n\n${wantOn ? "Edited messages will be forwarded to you." : "Anti-edit is disabled."}`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("antiEdit") === true || settings.get("antiEdit") === "on";
        await sock.sendMessage(from, {
          text: `✏️ *Anti-Edit*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antiedit on\`\n\`${pfx}antiedit off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .takeover ──────────────────────────────────────────────────────────────
  {
    cmd: "takeover",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("takeover", wantOn, "Takeover")) return;
        settings.set("takeover", wantOn);
        await sock.sendMessage(from, {
          text: `👑 *Takeover* is now *${sub.toUpperCase()}*\n\n${wantOn ? "Bot will attempt to become admin if demoted." : "Takeover is disabled."}`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("takeover") === true || settings.get("takeover") === "on";
        await sock.sendMessage(from, {
          text: `👑 *Takeover*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}takeover on\`\n\`${pfx}takeover off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .selfadmin ─────────────────────────────────────────────────────────────
  {
    cmd: "selfadmin",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("selfAdmin", wantOn, "Self-Admin")) return;
        settings.set("selfAdmin", wantOn);
        await sock.sendMessage(from, {
          text: `🛡️ *Self-Admin* is now *${sub.toUpperCase()}*`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("selfAdmin") === true || settings.get("selfAdmin") === "on";
        await sock.sendMessage(from, {
          text: `🛡️ *Self-Admin*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}selfadmin on\`\n\`${pfx}selfadmin off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .antistatusmention ─────────────────────────────────────────────────────
  {
    cmd: "antistatusmention",
    aliases: ["antistatusmention"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiStatusMention", wantOn, "Anti-Status-Mention")) return;
        settings.set("antiStatusMention", wantOn);
        await sock.sendMessage(from, {
          text: `👁️ *Anti-Status-Mention* is now *${sub.toUpperCase()}*`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("antiStatusMention") === true || settings.get("antiStatusMention") === "on";
        await sock.sendMessage(from, {
          text: `👁️ *Anti-Status-Mention*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antistatusmention on\`\n\`${pfx}antistatusmention off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .antimentiongroup ──────────────────────────────────────────────────────
  {
    cmd: "antimentiongroup",
    aliases: ["antimentiongrp"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiMentionGroup", wantOn, "Anti-Mention-Group")) return;
        settings.set("antiMentionGroup", wantOn);
        await sock.sendMessage(from, {
          text: `🔇 *Anti-Mention-Group* is now *${sub.toUpperCase()}*`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("antiMentionGroup") === true || settings.get("antiMentionGroup") === "on";
        await sock.sendMessage(from, {
          text: `🔇 *Anti-Mention-Group*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antimentiongroup on\`\n\`${pfx}antimentiongroup off\``,
        }, { quoted: msg });
      }
    },
  },

];
