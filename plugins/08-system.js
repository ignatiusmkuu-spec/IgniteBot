"use strict";
// ── System / status commands ──────────────────────────────────────────────────
// ping, alive, uptime, time/date, memory, cpu, network, stats, users,
// groups, sysinfo, whatsong, loc/locate, list/vars, setvar

module.exports = [

  // ── .ping ──────────────────────────────────────────────────────────────────
  {
    cmd: "ping",
    aliases: ["speed"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const start = Date.now();
      await sock.sendMessage(from, { text: "🏓 *Pong!*" }, { quoted: msg });
      const ms = Date.now() - start;
      await sock.sendMessage(from, { text: `🏓 *Pong!* Response time: *${ms}ms*` }, { quoted: msg });
    },
  },

  // ── .alive ─────────────────────────────────────────────────────────────────
  {
    cmd: "alive",
    aliases: ["status", "botinfo"],
    async run(ctx) {
      const { sock, msg, from, settings, botStatus } = ctx;
      const _mem      = process.memoryUsage();
      const _uptimeSec = Math.floor(process.uptime());
      const _uh = Math.floor(_uptimeSec / 3600);
      const _um = Math.floor((_uptimeSec % 3600) / 60);
      const _us = _uptimeSec % 60;
      const _uptimeStr = _uh > 0 ? `${_uh}h ${_um}m ${_us}s` : `${_um}m ${_us}s`;
      const _botName   = settings.get("botName") || "NEXUS-MD";
      const _mode      = settings.get("mode") || "public";
      const _statusStr = (botStatus || "connected") === "connected" ? "Online ✅" : "Offline ❌";
      await sock.sendMessage(from, {
        text:
          `╔══〔 ⚡ *${_botName}* 〕══════════╗\n` +
          `║  Status:  ${_statusStr}\n` +
          `║  Mode:    ${_mode.charAt(0).toUpperCase() + _mode.slice(1)}\n` +
          `║  Uptime:  ${_uptimeStr}\n` +
          `║  Memory:  ${Math.round(_mem.rss / 1024 / 1024)}MB\n` +
          `║  Node.js: ${process.version}\n` +
          `╚══════════════════════════════╝\n\n_⚡ NEXUS-MD is alive and running!_`,
      }, { quoted: msg });
    },
  },

  // ── .uptime ────────────────────────────────────────────────────────────────
  {
    cmd: "uptime",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _uptimeSec = Math.floor(process.uptime());
      const _uh = Math.floor(_uptimeSec / 3600);
      const _um = Math.floor((_uptimeSec % 3600) / 60);
      const _us = _uptimeSec % 60;
      const _uptimeStr = _uh > 0 ? `${_uh}h ${_um}m ${_us}s` : `${_um}m ${_us}s`;
      await sock.sendMessage(from, { text: `⏱️ *Bot Uptime:* ${_uptimeStr}` }, { quoted: msg });
    },
  },

  // ── .time / .date ──────────────────────────────────────────────────────────
  {
    cmd: "date",
    aliases: ["datetime", "now"],
    async run(ctx) {
      const { sock, msg, from, settings } = ctx;
      const _tz  = settings.get("timezone") || "Africa/Nairobi";
      const _now = new Date();
      const _time = new Intl.DateTimeFormat("en-US", { timeZone: _tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(_now);
      const _date = new Intl.DateTimeFormat("en-US", { timeZone: _tz, weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(_now);
      await sock.sendMessage(from, {
        text: `🕐 *Current Time & Date*\n\n📅 *Date:* ${_date}\n⏰ *Time:* ${_time}\n🌍 *Timezone:* ${_tz}`,
      }, { quoted: msg });
    },
  },

  // ── .memory ────────────────────────────────────────────────────────────────
  {
    cmd: "memory",
    aliases: ["ram"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const os     = require("os");
      const _mem   = process.memoryUsage();
      const _total = os.totalmem();
      const _free  = os.freemem();
      const _used  = _total - _free;
      const _pct   = Math.round((_used / _total) * 100);
      const _bar   = "█".repeat(Math.round(_pct / 10)) + "░".repeat(10 - Math.round(_pct / 10));
      await sock.sendMessage(from, {
        text:
          `🖥️ *Memory Usage*\n\n` +
          `System RAM: ${_bar} ${_pct}%\n` +
          `Used: ${Math.round(_used / 1024 / 1024)}MB / ${Math.round(_total / 1024 / 1024)}MB\n\n` +
          `Bot RSS: ${Math.round(_mem.rss / 1024 / 1024)}MB\n` +
          `Bot Heap Used: ${Math.round(_mem.heapUsed / 1024 / 1024)}MB\n` +
          `Bot Heap Total: ${Math.round(_mem.heapTotal / 1024 / 1024)}MB`,
      }, { quoted: msg });
    },
  },

  // ── .cpu ───────────────────────────────────────────────────────────────────
  {
    cmd: "cpu",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const os   = require("os");
      const cpus = os.cpus();
      const load = os.loadavg();
      await sock.sendMessage(from, {
        text:
          `🔧 *CPU Info*\n\n` +
          `Model: ${cpus[0]?.model?.trim() || "Unknown"}\n` +
          `Cores: ${cpus.length}\n` +
          `Load Avg: ${load[0].toFixed(2)} (1m) · ${load[1].toFixed(2)} (5m) · ${load[2].toFixed(2)} (15m)`,
      }, { quoted: msg });
    },
  },

  // ── .network ───────────────────────────────────────────────────────────────
  {
    cmd: "network",
    aliases: ["net"],
    async run(ctx) {
      const { sock, msg, from, axios } = ctx;
      try {
        const start = Date.now();
        await axios.get("https://www.google.com", { timeout: 5000 });
        const latency = Date.now() - start;
        await sock.sendMessage(from, {
          text:
            `🌐 *Network Status*\n\n` +
            `✅ Internet: Connected\n` +
            `📡 Latency: ${latency}ms\n` +
            `🌍 Status: Online`,
        }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(from, { text: `🌐 *Network Status*\n\n❌ Internet check failed: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .stats ─────────────────────────────────────────────────────────────────
  {
    cmd: "stats",
    aliases: ["statistics"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      try {
        const analytics = require("./lib/analytics");
        const _stats    = analytics ? analytics.getStats() : {};
        await sock.sendMessage(from, {
          text:
            `📊 *Bot Statistics*\n\n` +
            `📨 Total Commands: ${_stats.commands || 0}\n` +
            `👥 Users Seen: ${_stats.users || 0}\n` +
            `💬 Messages Handled: ${_stats.messages || 0}\n` +
            `⏱️ Uptime: ${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m\n` +
            `🖥️ Memory: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Stats error: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .users ─────────────────────────────────────────────────────────────────
  {
    cmd: "users",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, isOwner, db } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      try {
        const count = db.get("user_count") || "0";
        await sock.sendMessage(from, { text: `👥 *Total users interacted:* ${count}` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .groups ────────────────────────────────────────────────────────────────
  {
    cmd: "groups",
    aliases: ["listgroups"],
    async run(ctx) {
      const { sock, msg, from, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      try {
        const all = await sock.groupFetchAllParticipating();
        const keys = Object.keys(all);
        let txt = `👥 *Bot is in ${keys.length} group(s)*\n\n`;
        keys.slice(0, 20).forEach((k, i) => { txt += `${i + 1}. *${all[k].subject || k}*\n`; });
        if (keys.length > 20) txt += `\n_... and ${keys.length - 20} more_`;
        await sock.sendMessage(from, { text: txt }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .sysinfo ───────────────────────────────────────────────────────────────
  {
    cmd: "sysinfo",
    aliases: ["sys", "system"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        const _os    = require("os");
        const _cpu   = _os.cpus()[0];
        const _cores = _os.cpus().length;
        const _totMB = Math.round(_os.totalmem()  / 1024 / 1024);
        const _freMB = Math.round(_os.freemem()   / 1024 / 1024);
        const _useMB = _totMB - _freMB;
        const _usePct= Math.round((_useMB / _totMB) * 100);
        const _ramBar= "█".repeat(Math.round(_usePct / 10)) + "░".repeat(10 - Math.round(_usePct / 10));
        const _load  = _os.loadavg();
        const _uptS  = Math.floor(process.uptime());
        const _uptH  = Math.floor(_uptS / 3600);
        const _uptM  = Math.floor((_uptS % 3600) / 60);
        const _uptSc = _uptS % 60;
        const _uptStr= `${_uptH}h ${_uptM}m ${_uptSc}s`;
        const _pRss  = Math.round(process.memoryUsage().rss / 1024 / 1024);
        const _pHeap = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
        await sock.sendMessage(from, {
          text:
`╔══〔 🖥️ 𝗦𝗬𝗦𝗧𝗘𝗠 𝗗𝗜𝗔𝗚𝗡𝗢𝗦𝗧𝗜𝗖𝗦 〕══╗
   ⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 𝗦𝘆𝘀𝘁𝗲𝗺 𝗦𝗻𝗮𝗽𝘀𝗵𝗼𝘁
╚═══════════════════════════════╝

◆ 💻 𝗢𝗦        ⟫ ${_os.type()} ${_os.release()}
◆ 🏗️ 𝗔𝗿𝗰𝗵      ⟫ ${_os.arch()}
◆ 🔷 𝗡𝗼𝗱𝗲.𝗷𝘀   ⟫ ${process.version}
◆ 🧠 𝗖𝗣𝗨       ⟫ ${_cpu?.model?.trim() || "Unknown"} (${_cores} cores)

┌─〔 📊 𝗥𝗘𝗦𝗢𝗨𝗥𝗖𝗘𝗦 〕──────────────┐
│
│  🗄️ RAM   ${_ramBar} ${_usePct}%
│     Used: ${_useMB} MB / ${_totMB} MB
│
│  ⚙️ Load  ${_load[0].toFixed(2)} (1m) · ${_load[1].toFixed(2)} (5m) · ${_load[2].toFixed(2)} (15m)
│
│  📦 Bot Heap   : ${_pHeap} MB
│  📦 Bot RSS    : ${_pRss} MB
│  ⏱️ Bot Uptime : ${_uptStr}
│
└───────────────────────────────┘

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 is wired and running hot._`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ sysinfo error: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .whatsong ──────────────────────────────────────────────────────────────
  {
    cmd: "whatsong",
    aliases: ["identify", "songid"],
    async run(ctx) {
      const { sock, msg, from, pfx, downloadMediaMessage, getContentType, normalizeMessageContent, _xwolfSearch, _xwolfAudio, axios } = ctx;
      if (!msg.quoted) { await sock.sendMessage(from, { text: `🎵 Reply to an audio message with \`${pfx}whatsong\` to identify the song.` }, { quoted: msg }); return; }
      const qMsg  = msg.quoted?.message || {};
      const qNorm = normalizeMessageContent(qMsg) || qMsg;
      const qType = getContentType(qNorm) || getContentType(qMsg) || "";
      const isAudio = qType === "audioMessage" || !!qNorm.audioMessage || !!qMsg.audioMessage;
      if (!isAudio) { await sock.sendMessage(from, { text: "❌ Please reply to an audio/voice message to identify the song." }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: "🎵 Identifying song... ⏳" }, { quoted: msg });
      try {
        const _audioBuf = await downloadMediaMessage({ key: msg.quoted.key, message: qMsg }, "buffer", { reuploadRequest: sock.updateMediaMessage });
        const FormData  = require("form-data");
        const _form     = new FormData();
        _form.append("file", _audioBuf, { filename: "audio.ogg", contentType: "audio/ogg" });
        const _acrRes = await axios.post("https://identify-eu-west-1.acrcloud.com/v1/identify", _form, {
          headers: { ..._form.getHeaders(), "access-key": process.env.ACR_KEY || "" }, timeout: 30000,
        }).catch(() => null);
        const _title   = _acrRes?.data?.metadata?.music?.[0]?.title;
        const _artists = _acrRes?.data?.metadata?.music?.[0]?.artists?.map(a => a.name)?.join(", ");
        if (!_title) throw new Error("Song not identified. Try a clearer audio.");
        await sock.sendMessage(from, { text: `🎵 *Song Identified!*\n\n🎤 *Title:* ${_title}\n👤 *Artist:* ${_artists || "Unknown"}` }, { quoted: msg });
        // Offer download
        if (_xwolfSearch) {
          const _ysVids = await _xwolfSearch(`${_title} ${_artists}`).catch(() => null);
          if (_ysVids?.length && _xwolfAudio) {
            await sock.sendMessage(from, { text: `⬇️ Fetching audio for *${_title}*...` }, { quoted: msg });
            const _xwd  = await _xwolfAudio(_ysVids[0].url, _title).catch(() => null);
            if (_xwd) {
              const _dlUrl = _xwd.proxyUrl || _xwd.downloadUrl;
              await sock.sendMessage(from, {
                document: { url: _dlUrl }, mimetype: "audio/mpeg", fileName: `${_title}.mp3`,
                caption: `🎵 *${_title}* — ${_artists}\n\n_𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗱 𝗯𝘆 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗_`,
              }, { quoted: msg });
            }
          }
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Song identification failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .loc / .locate ─────────────────────────────────────────────────────────
  {
    cmd: "loc",
    aliases: ["locate"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const place = args.trim();
      if (!place) { await sock.sendMessage(from, { text: `📍 Usage: \`${pfx}loc <place name>\`\nExample: \`${pfx}loc Nairobi Kenya\`` }, { quoted: msg }); return; }
      try {
        const geoRes = await axios.get(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`, {
          timeout: 10000, headers: { "User-Agent": "NEXUS-MD/1.0" },
        });
        const loc = geoRes.data?.[0];
        if (!loc) { await sock.sendMessage(from, { text: `❌ Location *${place}* not found.` }, { quoted: msg }); return; }
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);
        await sock.sendMessage(from, {
          location: { degreesLatitude: lat, degreesLongitude: lon, name: loc.display_name },
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Location lookup failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .list / .vars ──────────────────────────────────────────────────────────
  {
    cmd: "list",
    aliases: ["vars", "listvars"],
    async run(ctx) {
      const { sock, msg, from, isOwner, settings } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const keys = ["mode","prefix","botName","timezone","welcome","goodbye","antiDelete","antiEdit","autoView","ghost","viewOnce","autoReact","antiLink","antiSpam","antiCall","autoTyping","autoRecording","aiChatGlobal"];
      let txt = `⚙️ *Bot Settings*\n\n`;
      for (const k of keys) {
        const v = settings.get(k);
        txt += `• *${k}:* ${v === undefined ? "_not set_" : String(v)}\n`;
      }
      await sock.sendMessage(from, { text: txt }, { quoted: msg });
    },
  },

  // ── .setvar ────────────────────────────────────────────────────────────────
  {
    cmd: "setvar",
    aliases: ["setenv"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings, axios } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const parts = args.trim().split(/\s+/);
      const key   = parts[0];
      const value = parts.slice(1).join(" ");
      if (!key) {
        await sock.sendMessage(from, {
          text:
            `⚙️ *Set Variable*\n\nUsage: \`${pfx}setvar <key> <value>\`\n\nExamples:\n` +
            `\`${pfx}setvar botName NEXUS-MD\`\n\`${pfx}setvar prefix .\`\n\`${pfx}setvar timezone Africa/Nairobi\``,
        }, { quoted: msg });
        return;
      }
      settings.set(key, value || true);
      await sock.sendMessage(from, { text: `✅ *${key}* set to: \`${value || "true"}\`` }, { quoted: msg });
    },
  },

];
