"use strict";
// ── Menu, tag-all, and late-block commands ────────────────────────────────────
// menu/menuv/help, tag/everyone/all, time/tz (world clock), sysinfo-v2,
// crypto-v2, joke-v2 (late-block versions — these do NOT override the
// earlier 06-fun / 08-system registrations since loader uses first-wins)

const fs   = require("fs");
const path = require("path");

module.exports = [

  // ── .menu / .menuv / .help ────────────────────────────────────────────────
  {
    cmd: "menu",
    aliases: ["menuv", "help"],
    async run(ctx) {
      const { sock, msg, from, pfx, settings, botStatus } = ctx;
      try {
        const _os         = require("os");
        const _mem        = process.memoryUsage();
        const _totalRam   = _os.totalmem();
        const _rssMB      = (_mem.rss / 1024 / 1024).toFixed(1);
        const _totalRamMB = (_totalRam / 1024 / 1024).toFixed(0);
        const _ramPct     = Math.min(100, Math.round((_mem.rss / _totalRam) * 100));
        const _barFilled  = Math.max(1, Math.round(_ramPct / 10));
        const _ramBar     = "▓".repeat(_barFilled) + "░".repeat(10 - _barFilled);
        const _uptimeSec  = Math.floor(process.uptime());
        const _uh = Math.floor(_uptimeSec / 3600);
        const _um = Math.floor((_uptimeSec % 3600) / 60);
        const _us = _uptimeSec % 60;
        const _uptimeStr  = _uh > 0 ? `${_uh}h ${_um}m ${_us}s` : `${_um}m ${_us}s`;
        const _botMode    = settings.get("mode") || "public";
        const _modeStr    = _botMode.charAt(0).toUpperCase() + _botMode.slice(1);
        const _botName    = settings.get("botName") || "NEXUS-MD";
        const _senderName = msg.pushName || (ctx.phone ? `+${ctx.phone}` : ctx.senderJid.split("@")[0]);
        const _statusStr  = (botStatus || "connected") === "connected" ? "Online ✅" : "Offline ❌";
        const _ownerRaw   = (process.env.ADMIN_NUMBERS || "").split(",")[0].trim();
        const _ownerDisp  = _ownerRaw ? `+${_ownerRaw}` : "Owner";
        let _platName = "Cloud", _platIcon = "☁️";
        try { const _platInfo = require("./lib/platform"); const _platDet = _platInfo?.detect?.(); _platName = _platDet?.name || (process.env.DYNO ? "Heroku" : "Replit"); _platIcon = _platDet?.icon || "☁️"; } catch {}
        const _sep = "─────────────────────────";
        const _fullMenu =
`╔══〔 ⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 𝗩𝟮 𝗖𝗢𝗥𝗘 ⚡ 〕══╗
   𝗔𝗱𝘃𝗮𝗻𝗰𝗲𝗱 𝗪𝗵𝗮𝘁𝘀𝗔𝗽𝗽 𝗔𝘂𝘁𝗼𝗺𝗮𝘁𝗶𝗼𝗻 𝗕𝗼𝘁
╚══════════════════════════════╝

◈ 𝗨𝗦𝗘𝗥  ⟫  ${_senderName}
◈ 𝗥𝗔𝗡𝗞  ⟫  𝗧𝗲𝗰𝗵 ★★☆

◆ 👑 𝗢𝘄𝗻𝗲𝗿     ⟫ ${_ownerDisp}
◆ 🌐 𝗠𝗼𝗱𝗲      ⟫ ${_modeStr}
◆ ⚡ 𝗣𝗿𝗲𝗳𝗶𝘅    ⟫ [${pfx}]
◆ 🔢 𝗩𝗲𝗿𝘀𝗶𝗼𝗻   ⟫ 2.0
◆ ${_platIcon}  𝗣𝗹𝗮𝘁𝗳𝗼𝗿𝗺  ⟫ ${_platName}
◆ 📶 𝗦𝘁𝗮𝘁𝘂𝘀   ⟫ ${_statusStr}
◆ ⏱ 𝗨𝗽𝘁𝗶𝗺𝗲   ⟫ ${_uptimeStr}
◆ 🖥 𝗥𝗔𝗠      ⟫ ${_ramBar} ${_ramPct}%
              (${_rssMB}MB / ${_totalRamMB}MB)

┌─〔 ⚙️ 𝗦𝗬𝗦𝗧𝗘𝗠 𝗖𝗢𝗥𝗘 〕──────────┐
│ ◇ ${pfx}menu      ◇ ${pfx}menuv
│ ◇ ${pfx}help      ◇ ${pfx}ping
│ ◇ ${pfx}alive     ◇ ${pfx}stats
│ ◇ ${pfx}uptime    ◇ ${pfx}time
│ ◇ ${pfx}date      ◇ ${pfx}info
└${_sep}┘

┌─〔 🧠 𝗔𝗜 𝗘𝗡𝗚𝗜𝗡𝗘 〕────────────┐
│ ◇ ${pfx}ai        ◇ ${pfx}chat
│ ◇ ${pfx}ask       ◇ ${pfx}hehe
│ ◇ ${pfx}vision    ◇ ${pfx}tts
│ ◇ ${pfx}chatbot   ◇ ${pfx}describe
└${_sep}┘

┌─〔 🔎 𝗦𝗘𝗔𝗥𝗖𝗛 & 𝗜𝗡𝗙𝗢 〕──────────┐
│ ◇ ${pfx}weather   ◇ ${pfx}wiki
│ ◇ ${pfx}translate ◇ ${pfx}define
│ ◇ ${pfx}country   ◇ ${pfx}github
│ ◇ ${pfx}google    ◇ ${pfx}crypto
└${_sep}┘

┌─〔 🎧 𝗠𝗘𝗗𝗜𝗔 & 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗦 〕──────┐
│ ◇ ${pfx}play      ◇ ${pfx}song
│ ◇ ${pfx}video     ◇ ${pfx}ytdl
│ ◇ ${pfx}tiktok    ◇ ${pfx}ig
│ ◇ ${pfx}sticker   ◇ ${pfx}apk
└${_sep}┘

┌─〔 🎮 𝗙𝗨𝗡 & 𝗚𝗔𝗠𝗘𝗦 〕──────────┐
│ ◇ ${pfx}joke      ◇ ${pfx}8ball
│ ◇ ${pfx}truth     ◇ ${pfx}dare
│ ◇ ${pfx}trivia    ◇ ${pfx}ship
│ ◇ ${pfx}rps       ◇ ${pfx}quote
└${_sep}┘

┌─〔 ✍️ 𝗧𝗘𝗫𝗧 & 𝗨𝗧𝗜𝗟𝗜𝗧𝗜𝗘𝗦 〕──────┐
│ ◇ ${pfx}morse     ◇ ${pfx}binary
│ ◇ ${pfx}qr        ◇ ${pfx}short
│ ◇ ${pfx}currency  ◇ ${pfx}calc
│ ◇ ${pfx}hash      ◇ ${pfx}uuid
└${_sep}┘

┌─〔 👥 𝗚𝗥𝗢𝗨𝗣𝗦 & 𝗠𝗢𝗗𝗘𝗥𝗔𝗧𝗜𝗢𝗡 〕──┐
│ ◇ ${pfx}add       ◇ ${pfx}kick
│ ◇ ${pfx}promote   ◇ ${pfx}demote
│ ◇ ${pfx}warn      ◇ ${pfx}antilink
│ ◇ ${pfx}tagall    ◇ ${pfx}welcome
└${_sep}┘

┌─〔 🛡 𝗢𝗪𝗡𝗘𝗥 & 𝗦𝗘𝗧𝗧𝗜𝗡𝗚𝗦 〕──────┐
│ ◇ ${pfx}mode      ◇ ${pfx}feature
│ ◇ ${pfx}setvar    ◇ ${pfx}list
│ ◇ ${pfx}anticall  ◇ ${pfx}antidelete
│ ◇ ${pfx}data      ◇ ${pfx}repo
└${_sep}┘

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 v2.0  •  Prefix: [${pfx}]  •  ${_modeStr} Mode_`;

        // Send song first
        const _menuSongBuf = settings.getMenuSong ? settings.getMenuSong() : null;
        if (_menuSongBuf) {
          await sock.sendMessage(from, { audio: _menuSongBuf, mimetype: "audio/mpeg", ptt: false }, { quoted: msg }).catch(() => {});
        }

        // Send menu with video or text
        const _menuVidBuf   = settings.getMenuVideo ? settings.getMenuVideo() : null;
        const _menuMp4Path  = path.join(process.cwd(), "assets", "menu.mp4");
        const _bannerGifPath = path.join(process.cwd(), "assets", "banner.gif");
        if (_menuVidBuf) {
          await sock.sendMessage(from, { video: _menuVidBuf, gifPlayback: true, mimetype: "video/mp4", caption: _fullMenu }, { quoted: msg }).catch(() => {});
        } else if (fs.existsSync(_menuMp4Path)) {
          await sock.sendMessage(from, { video: fs.readFileSync(_menuMp4Path), gifPlayback: true, mimetype: "video/mp4", caption: _fullMenu }, { quoted: msg }).catch(() => {});
        } else if (fs.existsSync(_bannerGifPath)) {
          await sock.sendMessage(from, { video: fs.readFileSync(_bannerGifPath), gifPlayback: true, caption: _fullMenu }, { quoted: msg }).catch(() => {});
        } else {
          await sock.sendMessage(from, { text: _fullMenu }, { quoted: msg }).catch(() => {});
        }
      } catch (_menuErr) {
        console.error("[menu] error:", _menuErr.message);
      }
    },
  },

  // ── .tag / .everyone / .all (batch mention) ───────────────────────────────
  {
    cmd: "tag",
    aliases: ["everyone", "all"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      try {
        const _tagMeta    = await sock.groupMetadata(from);
        const _tagMsg     = args.trim() || "📢 Attention!";
        const _tagGroupName = _tagMeta.subject || "Group";
        const _tagParts   = _tagMeta.participants.map(p => p.id);
        const _tagTotal   = _tagParts.length;
        const BATCH_SIZE  = 20;
        const _tagBatches = [];
        for (let i = 0; i < _tagParts.length; i += BATCH_SIZE) {
          _tagBatches.push(_tagParts.slice(i, i + BATCH_SIZE));
        }
        const _tagHeader =
          `📢 *${_tagGroupName}*\n${"─".repeat(30)}\n${_tagMsg}\n${"─".repeat(30)}\n` +
          `👥 Tagging *${_tagTotal}* member${_tagTotal !== 1 ? "s" : ""}…`;
        await sock.sendMessage(from, { text: _tagHeader }, { quoted: msg });
        for (let b = 0; b < _tagBatches.length; b++) {
          const batch = _tagBatches[b];
          const lines = batch.map(j => `@${j.split("@")[0].split(":")[0]}`).join(" ");
          await sock.sendMessage(from, { text: lines, mentions: batch });
          if (b < _tagBatches.length - 1) await new Promise(r => setTimeout(r, 1000));
        }
        console.log(`[tag] tagged ${_tagTotal} members in ${from}`);
      } catch (_tagErr) {
        console.error("[tag] error:", _tagErr.message);
        await sock.sendMessage(from, { text: `❌ Tag failed: ${_tagErr.message}` }, { quoted: msg });
      }
    },
  },

  // ── .time / .tz (world clock — late block version) ────────────────────────
  // Note: 'time' and 'tz' are NOT registered in 08-system.js so this wins.
  {
    cmd: "time",
    aliases: ["tz", "timezone"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _tzInput = (args || "").trim();
      const _tzAliases = {
        "nairobi":"Africa/Nairobi","lagos":"Africa/Lagos","accra":"Africa/Accra","cairo":"Africa/Cairo",
        "johannesburg":"Africa/Johannesburg","kampala":"Africa/Kampala","dar":"Africa/Dar_es_Salaam",
        "london":"Europe/London","paris":"Europe/Paris","berlin":"Europe/Berlin","rome":"Europe/Rome",
        "moscow":"Europe/Moscow","dubai":"Asia/Dubai","riyadh":"Asia/Riyadh",
        "karachi":"Asia/Karachi","delhi":"Asia/Kolkata","kolkata":"Asia/Kolkata","india":"Asia/Kolkata",
        "dhaka":"Asia/Dhaka","bangkok":"Asia/Bangkok","jakarta":"Asia/Jakarta",
        "singapore":"Asia/Singapore","manila":"Asia/Manila","tokyo":"Asia/Tokyo","seoul":"Asia/Seoul",
        "beijing":"Asia/Shanghai","shanghai":"Asia/Shanghai","china":"Asia/Shanghai",
        "sydney":"Australia/Sydney","auckland":"Pacific/Auckland",
        "nyc":"America/New_York","newyork":"America/New_York","new_york":"America/New_York",
        "chicago":"America/Chicago","denver":"America/Denver","la":"America/Los_Angeles",
        "los_angeles":"America/Los_Angeles","toronto":"America/Toronto","sao_paulo":"America/Sao_Paulo",
        "utc":"UTC","gmt":"GMT",
      };
      const _tzId = _tzAliases[_tzInput.toLowerCase().replace(/\s+/g,"_")] || (_tzInput || "UTC");
      try {
        const _now   = new Date();
        const _fmtOpts = { timeZone: _tzId, weekday:"long", year:"numeric", month:"long", day:"numeric" };
        const _timOpts = { timeZone: _tzId, hour:"2-digit", minute:"2-digit", second:"2-digit", hour12: true };
        const _dateStr = new Intl.DateTimeFormat("en-US", _fmtOpts).format(_now);
        const _timeStr = new Intl.DateTimeFormat("en-US", _timOpts).format(_now);
        const _tzFmt   = new Intl.DateTimeFormat("en-US", { timeZone: _tzId, timeZoneName:"shortOffset" });
        const _tzParts = _tzFmt.formatToParts(_now);
        const _offset  = _tzParts.find(p => p.type === "timeZoneName")?.value || _tzId;
        await sock.sendMessage(from, {
          text:
`╔══〔 🕐 𝗪𝗢𝗥𝗟𝗗 𝗖𝗟𝗢𝗖𝗞 〕══════════╗
╚═══════════════════════════════╝

🌍 *Timezone:*  ${_tzId}
⏰ *Time:*      *${_timeStr}*
📅 *Date:*      ${_dateStr}
🌐 *Offset:*    ${_offset}

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 World Clock_`,
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(from, {
          text: `❌ Invalid timezone: *${_tzInput}*\n\nExamples: \`${pfx}time nairobi\`, \`${pfx}time tokyo\`, \`${pfx}time UTC\``,
        }, { quoted: msg });
      }
    },
  },

];
