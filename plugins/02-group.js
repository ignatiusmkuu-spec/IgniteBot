"use strict";
// ── Group moderation commands ─────────────────────────────────────────────────
// approve, reject, admin, disp-1/7, promote, demote, warn, warnings,
// clearwarn, setwarnlimit, muteuser, unmuteuser, remove/kick, ban, unban,
// inbox, close/mute, lock, unlock, unmute, add, antichat, antilink, antispam,
// tagall, hidetag, delete/del, leave, block, unblock, foreigners, faker

const path = require("path");

module.exports = [

  // ── .approve ───────────────────────────────────────────────────────────────
  {
    cmd: "approve",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender;
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}approve @user\` or reply to a user.` }, { quoted: msg }); return; }
      try {
        await sock.groupParticipantsUpdate(from, [target], "promote");
        await sock.sendMessage(from, { text: `✅ @${target.split("@")[0]} has been approved (promoted).`, mentions: [target] }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .reject ────────────────────────────────────────────────────────────────
  {
    cmd: "reject",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender;
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}reject @user\` or reply to a user.` }, { quoted: msg }); return; }
      try {
        await sock.groupParticipantsUpdate(from, [target], "remove");
        await sock.sendMessage(from, { text: `✅ @${target.split("@")[0]} has been rejected (removed).`, mentions: [target] }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .admin ─────────────────────────────────────────────────────────────────
  {
    cmd: "admin",
    aliases: ["admins"],
    async run(ctx) {
      const { sock, msg, from, isOwner, admin } = ctx;
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        const meta  = await sock.groupMetadata(from);
        const parts = meta.participants || [];
        const admins = parts.filter(p => p.admin === "admin" || p.admin === "superadmin");
        const mentions = admins.map(p => p.id);
        let txt = `👑 *Group Admins* (${admins.length})\n\n`;
        for (const a of admins) {
          txt += `◆ @${a.id.split("@")[0]}${a.admin === "superadmin" ? " 👑" : ""}\n`;
        }
        await sock.sendMessage(from, { text: txt, mentions }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .disp-1 / .disp-7 ─────────────────────────────────────────────────────
  {
    cmd: "disp-1",
    aliases: ["disp1"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        await sock.groupSettingUpdate(from, "announcement");
        await sock.sendMessage(from, { text: "✅ Group set to: Only admins can send messages." }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },
  {
    cmd: "disp-7",
    aliases: ["disp7"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        await sock.groupSettingUpdate(from, "not_announcement");
        await sock.sendMessage(from, { text: "✅ Group set to: All members can send messages." }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .promote ───────────────────────────────────────────────────────────────
  {
    cmd: "promote",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}promote @user\`` }, { quoted: msg }); return; }
      try {
        const meta  = await sock.groupMetadata(from);
        const botAdm = admin.getBotAdminStatus(sock.user?.id, meta.participants);
        if (!botAdm) { await sock.sendMessage(from, { text: "❌ I need to be a group admin for this." }, { quoted: msg }); return; }
        await sock.groupParticipantsUpdate(from, [target], "promote");
        await sock.sendMessage(from, { text: `✅ @${target.split("@")[0]} has been promoted to admin! 👑`, mentions: [target] }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .demote ────────────────────────────────────────────────────────────────
  {
    cmd: "demote",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}demote @user\`` }, { quoted: msg }); return; }
      try {
        const meta  = await sock.groupMetadata(from);
        const botAdm = admin.getBotAdminStatus(sock.user?.id, meta.participants);
        if (!botAdm) { await sock.sendMessage(from, { text: "❌ I need to be a group admin for this." }, { quoted: msg }); return; }
        await sock.groupParticipantsUpdate(from, [target], "demote");
        await sock.sendMessage(from, { text: `✅ @${target.split("@")[0]} has been demoted.`, mentions: [target] }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .warn ──────────────────────────────────────────────────────────────────
  {
    cmd: "warn",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender;
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}warn @user [reason]\`` }, { quoted: msg }); return; }
      const reason = args.replace(/@\d+/g, "").trim() || "No reason given";
      try {
        const warnKey = `warn_${from}_${target.split("@")[0]}`;
        const limitKey = `warnlimit_${from}`;
        const current = parseInt(db.get(warnKey) || "0", 10) + 1;
        const limit   = parseInt(db.get(limitKey) || "3", 10);
        db.set(warnKey, String(current));
        await sock.sendMessage(from, {
          text: `⚠️ *Warning ${current}/${limit}*\n\n@${target.split("@")[0]} has been warned.\n📝 *Reason:* ${reason}${current >= limit ? "\n\n🚫 Warn limit reached! Taking action..." : ""}`,
          mentions: [target],
        }, { quoted: msg });
        if (current >= limit) {
          await sock.groupParticipantsUpdate(from, [target], "remove").catch(() => {});
          db.set(warnKey, "0");
          await sock.sendMessage(from, { text: `🚫 @${target.split("@")[0]} has been removed for reaching the warn limit.`, mentions: [target] });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .warnings ──────────────────────────────────────────────────────────────
  {
    cmd: "warnings",
    aliases: ["checkwarn"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, db } = ctx;
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender || ctx.senderJid;
      const warnKey  = `warn_${from}_${target.split("@")[0]}`;
      const limitKey = `warnlimit_${from}`;
      const current  = parseInt(db.get(warnKey) || "0", 10);
      const limit    = parseInt(db.get(limitKey) || "3", 10);
      await sock.sendMessage(from, {
        text: `⚠️ *Warnings for @${target.split("@")[0]}*\n\n${current}/${limit} warns`,
        mentions: [target],
      }, { quoted: msg });
    },
  },

  // ── .clearwarn ─────────────────────────────────────────────────────────────
  {
    cmd: "clearwarn",
    aliases: ["resetwarn"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender;
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}clearwarn @user\`` }, { quoted: msg }); return; }
      db.set(`warn_${from}_${target.split("@")[0]}`, "0");
      await sock.sendMessage(from, { text: `✅ Warnings cleared for @${target.split("@")[0]}.`, mentions: [target] }, { quoted: msg });
    },
  },

  // ── .setwarnlimit ──────────────────────────────────────────────────────────
  {
    cmd: "setwarnlimit",
    aliases: ["warnlimit"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const n = parseInt(args.trim(), 10);
      if (isNaN(n) || n < 1 || n > 20) { await sock.sendMessage(from, { text: `Usage: \`${pfx}setwarnlimit <1-20>\`` }, { quoted: msg }); return; }
      db.set(`warnlimit_${from}`, String(n));
      await sock.sendMessage(from, { text: `✅ Warn limit set to *${n}*.` }, { quoted: msg });
    },
  },

  // ── .muteuser ──────────────────────────────────────────────────────────────
  {
    cmd: "muteuser",
    aliases: ["mute"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender;
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}muteuser @user\`` }, { quoted: msg }); return; }
      db.set(`muted_${from}_${target.split("@")[0]}`, "true");
      await sock.sendMessage(from, { text: `🔇 @${target.split("@")[0]} has been muted. Their messages will be deleted.`, mentions: [target] }, { quoted: msg });
    },
  },

  // ── .unmuteuser ────────────────────────────────────────────────────────────
  {
    cmd: "unmuteuser",
    aliases: ["unmute"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender;
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}unmuteuser @user\`` }, { quoted: msg }); return; }
      db.set(`muted_${from}_${target.split("@")[0]}`, "false");
      await sock.sendMessage(from, { text: `🔊 @${target.split("@")[0]} has been unmuted.`, mentions: [target] }, { quoted: msg });
    },
  },

  // ── .remove / .kick ────────────────────────────────────────────────────────
  {
    cmd: "remove",
    aliases: ["kick"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}remove @user\`` }, { quoted: msg }); return; }
      if (admin.isSuperAdmin(target)) { await sock.sendMessage(from, { text: "❌ I cannot remove the owner!" }, { quoted: msg }); return; }
      try {
        const meta   = await sock.groupMetadata(from);
        const botAdm = admin.getBotAdminStatus(sock.user?.id, meta.participants);
        if (!botAdm) { await sock.sendMessage(from, { text: "❌ I need to be a group admin for this." }, { quoted: msg }); return; }
        await sock.groupParticipantsUpdate(from, [target], "remove");
        await sock.sendMessage(from, { text: `✅ @${target.split("@")[0]} has been removed from the group.`, mentions: [target] }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .ban ───────────────────────────────────────────────────────────────────
  {
    cmd: "ban",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}ban @user\`` }, { quoted: msg }); return; }
      if (admin.isSuperAdmin(target)) { await sock.sendMessage(from, { text: "❌ I cannot ban the owner!" }, { quoted: msg }); return; }
      db.set(`banned_${target.split("@")[0]}`, "true");
      if (from.endsWith("@g.us")) {
        try { await sock.groupParticipantsUpdate(from, [target], "remove"); } catch {}
      }
      await sock.sendMessage(from, { text: `🚫 @${target.split("@")[0]} has been *BANNED* from using the bot.`, mentions: [target] }, { quoted: msg });
    },
  },

  // ── .unban ─────────────────────────────────────────────────────────────────
  {
    cmd: "unban",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `Usage: \`${pfx}unban @user\`` }, { quoted: msg }); return; }
      db.set(`banned_${target.split("@")[0]}`, "false");
      await sock.sendMessage(from, { text: `✅ @${target.split("@")[0]} has been *UNBANNED*.`, mentions: [target] }, { quoted: msg });
    },
  },

  // ── .inbox ─────────────────────────────────────────────────────────────────
  {
    cmd: "inbox",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, senderJid } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const text = args.trim();
      if (!text) { await sock.sendMessage(from, { text: `Usage: \`${pfx}inbox <message>\`\nSends a message to your own inbox/saved messages.` }, { quoted: msg }); return; }
      const selfJid = sock.user?.id ? sock.user.id.split(":")[0] + "@s.whatsapp.net" : senderJid;
      await sock.sendMessage(selfJid, { text });
      await sock.sendMessage(from, { text: "✅ Message sent to your inbox." }, { quoted: msg });
    },
  },

  // ── .close / .mute (group-level) ───────────────────────────────────────────
  {
    cmd: "close",
    aliases: ["groupmute"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        await sock.groupSettingUpdate(from, "announcement");
        await sock.sendMessage(from, { text: "🔒 *Group closed!* Only admins can send messages now." }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .lock ──────────────────────────────────────────────────────────────────
  {
    cmd: "lock",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        await sock.groupSettingUpdate(from, "locked");
        await sock.sendMessage(from, { text: "🔒 *Group locked!* Only admins can change group info." }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .unlock ────────────────────────────────────────────────────────────────
  {
    cmd: "unlock",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        await sock.groupSettingUpdate(from, "unlocked");
        await sock.sendMessage(from, { text: "🔓 *Group unlocked!* All members can change group info." }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .open (alias for unmute/open group) ───────────────────────────────────
  {
    cmd: "open",
    aliases: ["groupopen"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        await sock.groupSettingUpdate(from, "not_announcement");
        await sock.sendMessage(from, { text: "🔓 *Group opened!* All members can send messages now." }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .add ───────────────────────────────────────────────────────────────────
  {
    cmd: "add",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const nums = args.trim().split(/[\s,]+/).map(n => n.replace(/[^0-9]/g, "")).filter(n => n.length > 4);
      if (!nums.length) { await sock.sendMessage(from, { text: `Usage: \`${pfx}add 254700000000\`` }, { quoted: msg }); return; }
      try {
        const meta   = await sock.groupMetadata(from);
        const botAdm = admin.getBotAdminStatus(sock.user?.id, meta.participants);
        if (!botAdm) { await sock.sendMessage(from, { text: "❌ I need to be a group admin for this." }, { quoted: msg }); return; }
        const jids = nums.map(n => n + "@s.whatsapp.net");
        await sock.groupParticipantsUpdate(from, jids, "add");
        await sock.sendMessage(from, { text: `✅ Added ${jids.length} member(s) to the group.` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .antichat ──────────────────────────────────────────────────────────────
  {
    cmd: "antichat",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiChat", wantOn, "Anti-Chat")) return;
        settings.set("antiChat", wantOn);
        await sock.sendMessage(from, { text: `🛡️ *Anti-Chat* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("antiChat") === true || settings.get("antiChat") === "on";
        await sock.sendMessage(from, {
          text: `🛡️ *Anti-Chat*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antichat on\`\n\`${pfx}antichat off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .antilink ──────────────────────────────────────────────────────────────
  {
    cmd: "antilink",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiLink", wantOn, "Anti-Link")) return;
        settings.set("antiLink", wantOn);
        await sock.sendMessage(from, { text: `🔗 *Anti-Link* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("antiLink") === true || settings.get("antiLink") === "on";
        await sock.sendMessage(from, {
          text: `🔗 *Anti-Link*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antilink on\`\n\`${pfx}antilink off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .antispam ──────────────────────────────────────────────────────────────
  {
    cmd: "antispam",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, _guardAlready } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const sub = (args || "").trim().toLowerCase();
      if (sub === "on" || sub === "off") {
        const wantOn = sub === "on";
        if (_guardAlready && await _guardAlready("antiSpam", wantOn, "Anti-Spam")) return;
        settings.set("antiSpam", wantOn);
        await sock.sendMessage(from, { text: `🛡️ *Anti-Spam* is now *${sub.toUpperCase()}*` }, { quoted: msg });
      } else {
        const cur = settings.get("antiSpam") === true || settings.get("antiSpam") === "on";
        await sock.sendMessage(from, {
          text: `🛡️ *Anti-Spam*\n\nCurrent: *${cur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}antispam on\`\n\`${pfx}antispam off\``,
        }, { quoted: msg });
      }
    },
  },

  // ── .tagall ────────────────────────────────────────────────────────────────
  {
    cmd: "tagall",
    aliases: ["hidetag"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        const meta    = await sock.groupMetadata(from);
        const members = meta.participants.map(p => p.id);
        const text    = args.trim() || "📢 Attention everyone!";
        let   mention = "";
        for (const m of members) mention += `@${m.split("@")[0]} `;
        await sock.sendMessage(from, { text: `${text}\n\n${mention.trim()}`, mentions: members }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .delete / .del ─────────────────────────────────────────────────────────
  {
    cmd: "delete",
    aliases: ["del"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!msg.quoted) { await sock.sendMessage(from, { text: "❌ Reply to a message to delete it." }, { quoted: msg }); return; }
      try {
        await sock.sendMessage(from, { delete: msg.quoted.key });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .leave ─────────────────────────────────────────────────────────────────
  {
    cmd: "leave",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: "👋 Goodbye! Leaving this group..." }, { quoted: msg });
      await new Promise(r => setTimeout(r, 1500));
      await sock.groupLeave(from).catch(() => {});
    },
  },

  // ── .block ─────────────────────────────────────────────────────────────────
  {
    cmd: "block",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin, botPhoneNumber } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      let target = msg.mentionedJids?.[0] || (msg.quoted ? msg.quoted.sender : null)
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `⚙️ *Block*\n\nUsage: \`${pfx}block\` while replying to or mentioning a user.` }, { quoted: msg }); return; }
      const _botPhone2 = (botPhoneNumber || (sock.user?.id || "")).split(":")[0].split("@")[0];
      if (target.split(":")[0].split("@")[0] === _botPhone2) { await sock.sendMessage(from, { text: "❌ I cannot block myself!" }, { quoted: msg }); return; }
      if (admin.isSuperAdmin(target)) { await sock.sendMessage(from, { text: "❌ I cannot block my Owner! 😡" }, { quoted: msg }); return; }
      try {
        await sock.updateBlockStatus(target, "block");
        await sock.sendMessage(from, { text: `✅ *Blocked* +${target.split("@")[0]} successfully!` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Failed to block: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .unblock ───────────────────────────────────────────────────────────────
  {
    cmd: "unblock",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      let target = msg.mentionedJids?.[0] || (msg.quoted ? msg.quoted.sender : null)
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
      if (!target) { await sock.sendMessage(from, { text: `⚙️ *Unblock*\n\nUsage: \`${pfx}unblock\` while replying to or mentioning a user.` }, { quoted: msg }); return; }
      try {
        await sock.updateBlockStatus(target, "unblock");
        await sock.sendMessage(from, { text: `✅ *Unblocked* +${target.split("@")[0]} successfully! ✅` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Failed to unblock: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .foreigners ────────────────────────────────────────────────────────────
  {
    cmd: "foreigners",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ This command only works in groups." }, { quoted: msg }); return; }
      try {
        const _fMeta  = await sock.groupMetadata(from).catch(() => null);
        const _fParts = _fMeta?.participants || [];
        const _fBotAdm = admin.getBotAdminStatus(sock.user?.id, _fParts);
        const _fSndAdm = admin.getSenderAdminStatus(ctx.senderJid, _fParts);
        if (!_fBotAdm && !isOwner) { await sock.sendMessage(from, { text: "❌ I need to be a group admin to use this command." }, { quoted: msg }); return; }
        if (!_fSndAdm && !isOwner) { await sock.sendMessage(from, { text: "❌ Only group admins can use this command." }, { quoted: msg }); return; }
        const _ownerNums = (process.env.ADMIN_NUMBERS || "").split(",").map(s => s.trim()).filter(Boolean);
        const _localCode = _ownerNums.length ? (_ownerNums[0].replace(/[^0-9]/g, "").slice(0, 3)) : "";
        const _botPhone  = (sock.user?.id || "").split(":")[0].split("@")[0];
        const _foreigners = _fParts.filter(p => !p.admin).map(p => p.id).filter(jid => {
          const num = jid.split("@")[0];
          return jid.split(":")[0].split("@")[0] !== _botPhone && (_localCode ? !num.startsWith(_localCode) : false);
        });
        const _fSub = args.trim().toLowerCase();
        if (_fSub !== "-x") {
          if (!_foreigners.length) { await sock.sendMessage(from, { text: "✅ No foreigners detected in this group." }, { quoted: msg }); return; }
          let txt = `🌍 Foreigners are members whose country code is not *${_localCode}*.\nFound *${_foreigners.length}* foreigners:\n\n`;
          for (const jid of _foreigners) txt += `𓅂 @${jid.split("@")[0]}\n`;
          txt += `\nTo remove them, send \`${pfx}foreigners -x\``;
          await sock.sendMessage(from, { text: txt, mentions: _foreigners }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { text: `🗑️ Removing *${_foreigners.length}* foreigners from this group. Goodbye! 😔` }, { quoted: msg });
          await new Promise(r => setTimeout(r, 1000));
          await sock.groupParticipantsUpdate(from, _foreigners, "remove").catch(() => {});
          await new Promise(r => setTimeout(r, 1000));
          await sock.sendMessage(from, { text: "✅ Done. All foreigners removed successfully." }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Foreigners command failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .faker ─────────────────────────────────────────────────────────────────
  {
    cmd: "faker",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, admin } = ctx;
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ This command only works in groups." }, { quoted: msg }); return; }
      try {
        const _fakeMeta  = await sock.groupMetadata(from).catch(() => null);
        const _fakeParts = _fakeMeta?.participants || [];
        const _fkBotAdm  = admin.getBotAdminStatus(sock.user?.id, _fakeParts);
        const _fkSndAdm  = admin.getSenderAdminStatus(ctx.senderJid, _fakeParts);
        if (!_fkBotAdm && !isOwner) { await sock.sendMessage(from, { text: "❌ I need to be a group admin to use this command." }, { quoted: msg }); return; }
        if (!_fkSndAdm && !isOwner) { await sock.sendMessage(from, { text: "❌ Only group admins can use this command." }, { quoted: msg }); return; }
        const _botPhone  = (sock.user?.id || "").split(":")[0].split("@")[0];
        const _fakeAccs  = _fakeParts.filter(p => !p.admin).map(p => p.id).filter(jid => jid.split("@")[0].startsWith("1") && !jid.includes(_botPhone));
        const _fkSub = args.trim().toLowerCase();
        if (_fkSub !== "-x") {
          if (!_fakeAccs.length) { await sock.sendMessage(from, { text: "𝙽𝚘 𝚏𝚊𝚔𝚎 𝙰𝚌𝚌𝚘𝚞𝚗𝚝𝚜 𝚍𝚎𝚝𝚎𝚌𝚝𝚎𝚍." }, { quoted: msg }); return; }
          let txt = `🚮 Nexus 𝚑𝚊𝚜 𝚍𝚎𝚝𝚎𝚌𝚝𝚎𝚍 𝚝𝚑𝚎 𝚏𝚘𝚕𝚕𝚘𝚠𝚒𝚗𝚐 *${_fakeAccs.length}* 𝙵𝚊𝚔𝚎 𝚊𝚌𝚌𝚘𝚞𝚗𝚝𝚜 𝚒𝚗 𝚝𝚑𝚒𝚜 𝚐𝚛𝚘𝚞𝚙:\n\n`;
          for (const jid of _fakeAccs) txt += `🚮 @${jid.split("@")[0]}\n`;
          txt += `\n𝚃𝚘 𝚛𝚎𝚖𝚘𝚟𝚎 𝚝𝚑𝚎𝚖 𝚜𝚎𝚗𝚍 \`${pfx}faker -x\``;
          await sock.sendMessage(from, { text: txt, mentions: _fakeAccs }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { text: `🗑️ Now removing *${_fakeAccs.length}* 𝙵𝚊𝚔𝚎 𝙰𝚌𝚌𝚘𝚞𝚗𝚝𝚜 from this group.\n\n𝙶𝚘𝚘𝚍𝚋𝚢𝚎👋 𝙵𝚊𝚔𝚎 𝚙𝚎𝚘𝚙𝚕𝚎.` }, { quoted: msg });
          await new Promise(r => setTimeout(r, 1000));
          await sock.groupParticipantsUpdate(from, _fakeAccs, "remove").catch(() => {});
          await new Promise(r => setTimeout(r, 1000));
          await sock.sendMessage(from, { text: "𝚂𝚞𝚌𝚌𝚎𝚜𝚜𝚏𝚞𝚕𝚕𝚢 𝚛𝚎𝚖𝚘𝚟𝚎𝚍 𝚊𝚕𝚕 𝚏𝚊𝚔𝚎 𝚊𝚌𝚌𝚘𝚞𝚗𝚝𝚜✅." }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Faker command failed: ${e.message}` }, { quoted: msg }); }
    },
  },

];
