"use strict";
// ── Bot-feature settings commands ─────────────────────────────────────────────
// setaddgroup, setmenusong, setmenuvideo, welcome, goodbye, autoview,
// ghost, ghoststatus, viewonce, autoreact, areact, feature,
// autotyping, autorecording, anticall, prefixless, repo, crt

module.exports = [

  // ── .setaddgroup ───────────────────────────────────────────────────────────
  {
    cmd: "setaddgroup",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const grpJid = (args || "").trim();
      if (!grpJid) {
        const cur = settings.get("addGroup") || "Not set";
        await sock.sendMessage(from, {
          text: `👥 *Auto-Add Group*\n\nCurrent: *${cur}*\n\nUsage: \`${pfx}setaddgroup <group-jid>\`\nExample: \`${pfx}setaddgroup 1234567890-1234567@g.us\``,
        }, { quoted: msg });
        return;
      }
      settings.set("addGroup", grpJid);
      await sock.sendMessage(from, { text: `✅ Auto-add group set to:\n${grpJid}` }, { quoted: msg });
    },
  },

  // ── .setmenusong ───────────────────────────────────────────────────────────
  {
    cmd: "setmenusong",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, pfx, isOwner, settings, downloadMediaMessage } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const quotedMsg = msg.quoted?.message || null;
      const isAudio   = quotedMsg?.audioMessage || quotedMsg?.documentMessage;
      if (!isAudio) {
        await sock.sendMessage(from, {
          text: `🎵 *Set Menu Song*\n\nReply to an audio/voice message with \`${pfx}setmenusong\` to set it as the menu song.\n\nCurrent: ${settings.getMenuSong() ? "✅ Set" : "❌ Not set"}`,
        }, { quoted: msg });
        return;
      }
      try {
        const buf = await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {});
        settings.setMenuSong(buf);
        await sock.sendMessage(from, { text: "✅ Menu song updated!" }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(from, { text: `❌ Failed: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .setmenuvideo ──────────────────────────────────────────────────────────
  {
    cmd: "setmenuvideo",
    aliases: ["setmenugif"],
    async run(ctx) {
      const { sock, msg, from, pfx, isOwner, settings, downloadMediaMessage } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const quotedMsg = msg.quoted?.message || null;
      const isVideo   = quotedMsg?.videoMessage;
      if (!isVideo) {
        await sock.sendMessage(from, {
          text: `🎬 *Set Menu Video/GIF*\n\nReply to a video or GIF with \`${pfx}setmenuvideo\` to set it as the menu banner.\n\nCurrent: ${settings.getMenuVideo ? (settings.getMenuVideo() ? "✅ Set" : "❌ Not set") : "N/A"}`,
        }, { quoted: msg });
        return;
      }
      try {
        const buf = await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {});
        if (settings.setMenuVideo) settings.setMenuVideo(buf);
        await sock.sendMessage(from, { text: "✅ Menu video updated!" }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(from, { text: `❌ Failed: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .welcome ───────────────────────────────────────────────────────────────
  {
    cmd: "welcome",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("welcome", wantOn, "Welcome Messages")) return;
        settings.set("welcome", wantOn);
        await sock.sendMessage(from, { text: `👋 *Welcome Messages* are now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("welcome") === true || settings.get("welcome") === "on";
        await sock.sendMessage(from, {
          text: `👋 *Welcome Messages*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}welcome on\`\n\`${pfx}welcome off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .goodbye ───────────────────────────────────────────────────────────────
  {
    cmd: "goodbye",
    aliases: ["bye", "farewell"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("goodbye", wantOn, "Goodbye Messages")) return;
        settings.set("goodbye", wantOn);
        await sock.sendMessage(from, { text: `👋 *Goodbye Messages* are now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("goodbye") === true || settings.get("goodbye") === "on";
        await sock.sendMessage(from, {
          text: `👋 *Goodbye Messages*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}goodbye on\`\n\`${pfx}goodbye off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .autoview ──────────────────────────────────────────────────────────────
  {
    cmd: "autoview",
    aliases: ["autoread"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("autoView", wantOn, "Auto View Status")) return;
        settings.set("autoView", wantOn);
        await sock.sendMessage(from, { text: `👁️ *Auto View Status* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("autoView") === true || settings.get("autoView") === "on";
        await sock.sendMessage(from, {
          text: `👁️ *Auto View Status*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}autoview on\`\n\`${pfx}autoview off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .ghost ─────────────────────────────────────────────────────────────────
  {
    cmd: "ghost",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("ghost", wantOn, "Ghost Mode")) return;
        settings.set("ghost", wantOn);
        await sock.sendMessage(from, { text: `👻 *Ghost Mode* is now *${sub.toUpperCase()}*\n\n${wantOn ? "Read receipts are disabled." : "Read receipts are enabled."}` }, { quoted: msg });
      } else {
        const cur = settings.get("ghost") === true || settings.get("ghost") === "on";
        await sock.sendMessage(from, {
          text: `👻 *Ghost Mode*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}ghost on\`\n\`${pfx}ghost off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .ghoststatus ───────────────────────────────────────────────────────────
  {
    cmd: "ghoststatus",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("ghostStatus", wantOn, "Ghost Status")) return;
        settings.set("ghostStatus", wantOn);
        await sock.sendMessage(from, { text: `👻 *Ghost Status* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("ghostStatus") === true || settings.get("ghostStatus") === "on";
        await sock.sendMessage(from, {
          text: `👻 *Ghost Status*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}ghoststatus on\`\n\`${pfx}ghoststatus off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .viewonce ──────────────────────────────────────────────────────────────
  {
    cmd: "viewonce",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("viewOnce", wantOn, "View-Once Auto-Reveal")) return;
        settings.set("viewOnce", wantOn);
        await sock.sendMessage(from, { text: `👁️ *View-Once Auto-Reveal* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("viewOnce") === true || settings.get("viewOnce") === "on";
        await sock.sendMessage(from, {
          text: `👁️ *View-Once Auto-Reveal*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}viewonce on\`\n\`${pfx}viewonce off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .autoreact ─────────────────────────────────────────────────────────────
  {
    cmd: "autoreact",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("autoReact", wantOn, "Auto React")) return;
        settings.set("autoReact", wantOn);
        await sock.sendMessage(from, { text: `⚡ *Auto React* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("autoReact") === true || settings.get("autoReact") === "on";
        await sock.sendMessage(from, {
          text: `⚡ *Auto React*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}autoreact on\`\n\`${pfx}autoreact off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .areact ────────────────────────────────────────────────────────────────
  {
    cmd: "areact",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const emoji = (args || "").trim();
      if (!emoji) {
        const cur = settings.get("reactEmoji") || "Not set";
        await sock.sendMessage(from, {
          text: `⚡ *Auto React Emoji*\n\nCurrent: *${cur}*\n\nUsage: \`${pfx}areact ❤️\``,
        }, { quoted: msg });
        return;
      }
      settings.set("reactEmoji", emoji);
      await sock.sendMessage(from, { text: `✅ Auto-react emoji set to: ${emoji}` }, { quoted: msg });
    },
  },

  // ── .feature ───────────────────────────────────────────────────────────────
  {
    cmd: "feature",
    aliases: ["features"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const featureList = [
        ["antiDelete","Anti-Delete","🗑️"],
        ["antiEdit","Anti-Edit","✏️"],
        ["welcome","Welcome Messages","👋"],
        ["goodbye","Goodbye Messages","👋"],
        ["autoView","Auto View Status","👁️"],
        ["ghost","Ghost Mode","👻"],
        ["ghostStatus","Ghost Status","👻"],
        ["viewOnce","View-Once Reveal","👁️"],
        ["autoReact","Auto React","⚡"],
        ["antiLink","Anti-Link","🔗"],
        ["antiSpam","Anti-Spam","🛡️"],
        ["antiCall","Anti-Call","📵"],
        ["autoTyping","Auto Typing","⌨️"],
        ["autoRecording","Auto Recording","🎤"],
        ["chatbot","AI Chatbot","🤖"],
        ["takeover","Takeover","👑"],
        ["selfAdmin","Self-Admin","🛡️"],
      ];
      const sub = (args || "").trim().toLowerCase();
      const parts = sub.split(/\s+/);
      if (parts.length >= 2 && (parts[1] === "on" || parts[1] === "off")) {
        const feature = featureList.find(f => f[0].toLowerCase() === parts[0]);
        if (!feature) {
          await sock.sendMessage(from, { text: `❌ Unknown feature: *${parts[0]}*` }, { quoted: msg });
          return;
        }
        const wantOn = parts[1] === "on";
        settings.set(feature[0], wantOn);
        await sock.sendMessage(from, { text: `${feature[2]} *${feature[1]}* is now *${wantOn ? "ON ✅" : "OFF ❌"}*` }, { quoted: msg });
        return;
      }
      let featureText = `╔══〔 ⚙️ 𝗕𝗢𝗧 𝗙𝗘𝗔𝗧𝗨𝗥𝗘𝗦 〕══╗\n\n`;
      for (const [key, label, icon] of featureList) {
        const cur = settings.get(key) === true || settings.get(key) === "on";
        featureText += `${icon} *${label}*: ${cur ? "ON ✅" : "OFF ❌"}\n`;
      }
      featureText += `\n_Usage: \`${pfx}feature <name> on/off\`_`;
      await sock.sendMessage(from, { text: featureText }, { quoted: msg });
    },
  },

  // ── .autotyping ────────────────────────────────────────────────────────────
  {
    cmd: "autotyping",
    aliases: ["typing"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().split(/\s+/)[0].toLowerCase();
      if (sub === "on" || sub === "off") {
        settings.set("autoTyping", sub === "on");
        await sock.sendMessage(from, { text: `⌨️ *Auto Typing* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("autoTyping") === true || settings.get("autoTyping") === "on";
        await sock.sendMessage(from, {
          text: `⌨️ *Auto Typing*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}autotyping on\`\n\`${pfx}autotyping off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .autorecording ─────────────────────────────────────────────────────────
  {
    cmd: "autorecording",
    aliases: ["recording"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().split(/\s+/)[0].toLowerCase();
      if (sub === "on" || sub === "off") {
        if (_guardAlready && await _guardAlready("autoRecording", sub === "on", "Auto Recording")) return;
        settings.set("autoRecording", sub === "on");
        await sock.sendMessage(from, { text: `🎤 *Auto Recording* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("autoRecording") === true || settings.get("autoRecording") === "on";
        await sock.sendMessage(from, {
          text: `🎤 *Auto Recording*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}autorecording on\`\n\`${pfx}autorecording off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .anticall ──────────────────────────────────────────────────────────────
  {
    cmd: "anticall",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().split(/\s+/)[0].toLowerCase();
      if (sub === "on" || sub === "off") {
        if (_guardAlready && await _guardAlready("antiCall", sub === "on", "Anti-Call")) return;
        settings.set("antiCall", sub === "on");
        await sock.sendMessage(from, {
          text: `📵 *Anti-Call* is now *${sub.toUpperCase()}*\n\n${sub === "on" ? "All incoming calls will be auto-rejected." : "Calls will no longer be auto-rejected."}`,
        }, { quoted: msg });
      } else {
        const cur = settings.get("antiCall") === true;
        await sock.sendMessage(from, {
          text: `📵 *Anti-Call*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}anticall on\`\n\`${pfx}anticall off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .prefixless ────────────────────────────────────────────────────────────
  {
    cmd: "prefixless",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, phone } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub     = args.toLowerCase().trim();
      const _curPfx = !!settings.get("prefixless");
      if (!sub) {
        await sock.sendMessage(from, {
          text:
            `⚙️ *Prefixless Mode*\n\n` +
            `Current: *${_curPfx ? "ON ✅" : "OFF ❌"}*\n\n` +
            `🔓 *on*  — other users can send commands without the \`${pfx}\` prefix\n` +
            `🔒 *off* — all users must include the \`${pfx}\` prefix\n\n` +
            `⚠️ _Note: even when ON, the bot itself always requires the prefix to avoid echo loops._\n\n` +
            `Usage: \`${pfx}prefixless [on|off]\``,
        }, { quoted: msg });
        return;
      }
      if (sub !== "on" && sub !== "off") {
        await sock.sendMessage(from, {
          text: `❌ Unknown option *"${sub}"*. Use \`${pfx}prefixless on\` or \`${pfx}prefixless off\`.`,
        }, { quoted: msg });
        return;
      }
      const wantOn = sub === "on";
      if (wantOn === _curPfx) {
        await sock.sendMessage(from, {
          text: `⚠️ *Prefixless Mode* is already *${_curPfx ? "ON ✅" : "OFF ❌"}* — no changes made.`,
        }, { quoted: msg });
        return;
      }
      settings.set("prefixless", wantOn);
      console.log(`[prefixless] set to ${wantOn} by ${phone}`);
      if (wantOn) {
        await sock.sendMessage(from, {
          text:
            `✅ *Prefixless Mode ON*\n\n` +
            `Other users can now send commands without the \`${pfx}\` prefix.\n` +
            `Example: type \`menu\` instead of \`${pfx}menu\`\n\n` +
            `⚠️ _The bot's own messages still require the prefix (prevents echo loops)._`,
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text:
            `✅ *Prefixless Mode OFF*\n\n` +
            `All users must now include the \`${pfx}\` prefix before commands.\n` +
            `Example: \`${pfx}menu\`, \`${pfx}play song\`, etc.`,
        }, { quoted: msg });
      }
    },
  },

];
