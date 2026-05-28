"use strict";
// ── Info / search commands ────────────────────────────────────────────────────
// repo, crt, github, wikipedia/wiki, epl, bundesliga, velma,
// detect, ipinfo, country, google, weather, quotes, laliga, whatsong, pair

const axios = require("axios");

module.exports = [

  // ── .repo ──────────────────────────────────────────────────────────────────
  {
    cmd: "repo",
    aliases: ["github-repo", "source"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      await sock.sendMessage(from, {
        text: `🐙 *NEXUS-MD Repository*\n\n📌 GitHub: https://github.com/NEXUS-MD/nexus-md\n\n_Star the repo if you love NEXUS-MD!_ ⭐`,
      }, { quoted: msg });
    },
  },

  // ── .crt ───────────────────────────────────────────────────────────────────
  {
    cmd: "crt",
    aliases: ["creator", "owner-info"],
    async run(ctx) {
      const { sock, msg, from, settings } = ctx;
      const _ownerRaw = (process.env.ADMIN_NUMBERS || "").split(",")[0].trim();
      const _ownerDisp = _ownerRaw ? `+${_ownerRaw}` : "Owner";
      const _botName   = settings.get("botName") || "NEXUS-MD";
      await sock.sendMessage(from, {
        text:
          `╔══〔 👑 𝗖𝗥𝗘𝗔𝗧𝗢𝗥 𝗜𝗡𝗙𝗢 〕══╗\n\n` +
          `🤖 *Bot:* ${_botName}\n` +
          `👤 *Owner:* ${_ownerDisp}\n` +
          `🐙 *Repo:* https://github.com/NEXUS-MD/nexus-md\n` +
          `📌 *Version:* 2.0\n\n` +
          `_⚡ Powered by NEXUS-MD_`,
      }, { quoted: msg });
    },
  },

  // ── .github ────────────────────────────────────────────────────────────────
  {
    cmd: "github",
    aliases: ["git", "ghuser"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _ghUser = args.trim();
      if (!_ghUser) { await sock.sendMessage(from, { text: `🐙 Usage: \`${pfx}github <username>\`\n\nFetches a GitHub user's public profile.` }, { quoted: msg }); return; }
      try {
        const _ghRes = await axios.get(`https://api.github.com/users/${encodeURIComponent(_ghUser)}`, {
          timeout: 15000, headers: { "User-Agent": "NEXUS-MD-Bot/1.0" },
        });
        const _gh = _ghRes.data;
        const _ghCaption =
          `🐙 *GitHub Profile*\n\n` +
          `*Username:* ${_gh.login}\n*Name:* ${_gh.name || "N/A"}\n*Bio:* ${_gh.bio || "N/A"}\n` +
          `*Location:* ${_gh.location || "N/A"}\n*Company:* ${_gh.company || "N/A"}\n` +
          `*Blog:* ${_gh.blog || "N/A"}\n*Followers:* ${_gh.followers}\n*Following:* ${_gh.following}\n` +
          `*Public Repos:* ${_gh.public_repos}\n*Public Gists:* ${_gh.public_gists}\n` +
          `*Account Type:* ${_gh.type}\n` +
          `*Created:* ${_gh.created_at ? new Date(_gh.created_at).toDateString() : "N/A"}\n` +
          `*Link:* ${_gh.html_url}`;
        if (_gh.avatar_url) {
          try {
            const _avRes = await axios.get(_gh.avatar_url, { responseType: "arraybuffer", timeout: 15000 });
            await sock.sendMessage(from, { image: Buffer.from(_avRes.data), caption: _ghCaption }, { quoted: msg });
          } catch { await sock.sendMessage(from, { text: _ghCaption }, { quoted: msg }); }
        } else { await sock.sendMessage(from, { text: _ghCaption }, { quoted: msg }); }
      } catch (e) {
        if (e.response?.status === 404) await sock.sendMessage(from, { text: `❌ GitHub user *${_ghUser}* not found.` }, { quoted: msg });
        else await sock.sendMessage(from, { text: `❌ Unable to fetch GitHub data: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .wikipedia / .wiki ─────────────────────────────────────────────────────
  {
    cmd: "wikipedia",
    aliases: ["wiki"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _wQuery = args.trim();
      if (!_wQuery) { await sock.sendMessage(from, { text: `📚 Usage: \`${pfx}wiki <search term>\`\nExample: \`${pfx}wiki Albert Einstein\`` }, { quoted: msg }); return; }
      try {
        const _cheerio = require("cheerio");
        const _wRes    = await axios.get(`https://en.wikipedia.org/wiki/${encodeURIComponent(_wQuery)}`, { timeout: 15000 });
        const _$   = _cheerio.load(_wRes.data);
        const _wTitle  = _$("#firstHeading").text().trim();
        const _wBody   = _$("#mw-content-text > div.mw-parser-output").find("p").text().trim();
        const _wSnip   = _wBody.slice(0, 1500) + (_wBody.length > 1500 ? "..." : "");
        const _wMsg    =
          `▢ *Wikipedia Search Result* 🧐\n\n` +
          `‣ *Title:* ${_wTitle} 📚\n\n` +
          `${_wSnip} 📖\n\n` +
          `🔗 https://en.wikipedia.org/wiki/${encodeURIComponent(_wQuery)}`;
        await sock.sendMessage(from, { text: _wMsg }, { quoted: msg });
      } catch (e) {
        if (e.response?.status === 404) await sock.sendMessage(from, { text: `❌ No Wikipedia article found for *"${_wQuery}"*.` }, { quoted: msg });
        else await sock.sendMessage(from, { text: `⚠️ Failed to fetch Wikipedia data: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .epl ───────────────────────────────────────────────────────────────────
  {
    cmd: "epl",
    aliases: ["premierleague", "pl"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      await sock.sendMessage(from, { text: "⏳ Fetching EPL standings..." }, { quoted: msg });
      try {
        const res = await axios.get("https://api.football-data.org/v4/competitions/PL/standings", {
          headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY || "" }, timeout: 15000,
        });
        const standings = res.data?.standings?.[0]?.table?.slice(0, 10) || [];
        if (!standings.length) throw new Error("No data");
        let txt = `⚽ *Premier League Standings* (Top 10)\n\n`;
        for (const t of standings) {
          txt += `${t.position}. *${t.team.shortName}* — ${t.points} pts (${t.won}W ${t.draw}D ${t.lost}L)\n`;
        }
        await sock.sendMessage(from, { text: txt }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ EPL data unavailable: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .bundesliga ────────────────────────────────────────────────────────────
  {
    cmd: "bundesliga",
    aliases: ["bl", "buli"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      await sock.sendMessage(from, { text: "⏳ Fetching Bundesliga standings..." }, { quoted: msg });
      try {
        const res = await axios.get("https://api.football-data.org/v4/competitions/BL1/standings", {
          headers: { "X-Auth-Token": process.env.FOOTBALL_API_KEY || "" }, timeout: 15000,
        });
        const standings = res.data?.standings?.[0]?.table?.slice(0, 10) || [];
        if (!standings.length) throw new Error("No data");
        let txt = `🇩🇪 *Bundesliga Standings* (Top 10)\n\n`;
        for (const t of standings) {
          txt += `${t.position}. *${t.team.shortName}* — ${t.points} pts (${t.won}W ${t.draw}D ${t.lost}L)\n`;
        }
        await sock.sendMessage(from, { text: txt }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Bundesliga data unavailable: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .velma ─────────────────────────────────────────────────────────────────
  {
    cmd: "velma",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🔍 Usage: \`${pfx}velma <search term>\`` }, { quoted: msg }); return; }
      try {
        const res = await axios.get(`https://velmaapi.vercel.app/search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
        const data = res.data?.data || res.data?.results || res.data;
        if (!data) throw new Error("No results");
        const item = Array.isArray(data) ? data[0] : data;
        await sock.sendMessage(from, {
          text: `🔍 *Velma Search: ${query}*\n\n${JSON.stringify(item, null, 2).slice(0, 1500)}`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Velma search failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .detect ────────────────────────────────────────────────────────────────
  {
    cmd: "detect",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _detMentioned = msg.mentionedJids?.[0] || (msg.quoted ? msg.quoted.sender : null);
      const _detNumArg    = args.trim().replace(/[^0-9]/g, "");
      const _detJid       = _detMentioned || (_detNumArg ? _detNumArg + "@s.whatsapp.net" : null);
      if (!_detJid) { await sock.sendMessage(from, { text: `🔍 *Usage:* \`${pfx}detect @user\` or \`${pfx}detect <phone number>\`\n*Example:* \`${pfx}detect 254700000000\`` }, { quoted: msg }); return; }
      try {
        const _detResults = await sock.onWhatsApp(_detJid).catch(() => []);
        if (!_detResults?.[0]?.exists) { await sock.sendMessage(from, { text: `❌ That number is not registered on WhatsApp.` }, { quoted: msg }); return; }
        const _detPhone = _detJid.split("@")[0];
        let   _detName  = `+${_detPhone}`;
        try {
          const _detMeta = await sock.profilePictureUrl(_detJid, "image").catch(() => null);
          const _detMsg  = `🔍 *User Found!*\n\n📱 *Number:* +${_detPhone}\n👤 *Name:* ${_detName}\n✅ *On WhatsApp:* Yes`;
          if (_detMeta) await sock.sendMessage(from, { image: { url: _detMeta }, caption: _detMsg }, { quoted: msg });
          else          await sock.sendMessage(from, { text: _detMsg }, { quoted: msg });
        } catch { await sock.sendMessage(from, { text: `🔍 *User Found!*\n\n📱 *Number:* +${_detPhone}\n✅ *On WhatsApp:* Yes` }, { quoted: msg }); }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Detect failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .ipinfo ────────────────────────────────────────────────────────────────
  {
    cmd: "ipinfo",
    aliases: ["ip", "geoip"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      try {
        const _ipTarget = args.trim() || "check";
        let _ipRes;
        if (_ipTarget === "check" || _ipTarget === "me") {
          _ipRes = await axios.get("http://ip-api.com/json/?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query", { timeout: 10000 });
        } else {
          const _cleanIp = _ipTarget.replace(/[^0-9a-fA-F.:]/g, "");
          _ipRes = await axios.get(`http://ip-api.com/json/${_cleanIp}?fields=status,message,country,countryCode,regionName,city,zip,lat,lon,timezone,isp,org,as,query`, { timeout: 10000 });
        }
        const _ip = _ipRes.data;
        if (_ip.status !== "success") throw new Error(_ip.message || "Lookup failed");
        await sock.sendMessage(from, {
          text:
`╭━━━〔 🌐 *IP INTEL* 〕━━━━━━⬣
┃
┃ 🔌 *IP Address:*  ${_ip.query}
┃ 🌍 *Country:*    ${_ip.country} (${_ip.countryCode})
┃ 📌 *Region:*      ${_ip.regionName}
┃ 🏙️ *City:*        ${_ip.city}
┃ 🗺️ *Coords:*      ${_ip.lat}, ${_ip.lon}
┃ 🕐 *Timezone:*    ${_ip.timezone}
┃ 📡 *ISP:*         ${_ip.isp}
┃ 🏢 *Org:*         ${_ip.org || "—"}
┃ 🔢 *AS:*          ${_ip.as || "—"}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━⬣

_⚠️ Results based on IP registration, not real-time GPS._`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ IP lookup failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .country ───────────────────────────────────────────────────────────────
  {
    cmd: "country",
    aliases: ["countryinfo", "nation"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _cName = args.trim();
      if (!_cName) { await sock.sendMessage(from, { text: `🌍 *Country Info*\n\nUsage: \`${pfx}country Kenya\`` }, { quoted: msg }); return; }
      try {
        const _cRes = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(_cName)}?fullText=false&fields=name,capital,population,area,currencies,languages,flags,region,subregion,timezones,cca2,idd`, { timeout: 8000 });
        const _c   = _cRes.data[0];
        const _currencies = Object.values(_c.currencies || {}).map(cu => `${cu.name} (${cu.symbol || "?"})`).join(", ");
        const _languages  = Object.values(_c.languages || {}).join(", ");
        const _capital    = (_c.capital || ["N/A"])[0];
        const _dialCode   = _c.idd?.root ? `${_c.idd.root}${(_c.idd.suffixes || [])[0] || ""}` : "N/A";
        const _text =
          `🌍 *${_c.name.common}* (${_c.cca2})\n${"─".repeat(32)}\n` +
          `🗺 Region: ${_c.region}${_c.subregion ? ` / ${_c.subregion}` : ""}\n` +
          `🏛 Capital: ${_capital}\n👥 Population: ${(_c.population || 0).toLocaleString()}\n` +
          `📐 Area: ${(_c.area || 0).toLocaleString()} km²\n💰 Currency: ${_currencies || "N/A"}\n` +
          `🗣 Language(s): ${_languages || "N/A"}\n📞 Dial Code: ${_dialCode}\n` +
          `🕐 Timezone: ${(_c.timezones || [])[0] || "N/A"}`;
        const _flagUrl = _c.flags?.png;
        if (_flagUrl) {
          const _flagBuf = Buffer.from((await axios.get(_flagUrl, { responseType: "arraybuffer", timeout: 10000 })).data);
          await sock.sendMessage(from, { image: _flagBuf, caption: _text }, { quoted: msg });
        } else { await sock.sendMessage(from, { text: _text }, { quoted: msg }); }
      } catch { await sock.sendMessage(from, { text: `❌ Country not found: *${args.trim()}*. Try the full country name.` }, { quoted: msg }); }
    },
  },

  // ── .google ────────────────────────────────────────────────────────────────
  {
    cmd: "google",
    aliases: ["search"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _gQuery = args.trim();
      if (!_gQuery) { await sock.sendMessage(from, { text: `🔍 Usage: \`${pfx}google <search term>\`\nExample: \`${pfx}google What is treason\`` }, { quoted: msg }); return; }
      try {
        const _gRes = await axios.get(
          `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(_gQuery)}&key=AIzaSyDMbI3nvmQUrfjoCJYLS69Lej1hSXQjnWI&cx=baf9bdb0c631236e5`,
          { timeout: 15000 }
        );
        const _gItems = _gRes.data?.items || [];
        if (!_gItems.length) { await sock.sendMessage(from, { text: "❌ No results found for that query." }, { quoted: msg }); return; }
        let _gTxt = `🔍 *GOOGLE SEARCH*\n📌 *Term:* ${_gQuery}\n\n`;
        for (let i = 0; i < Math.min(5, _gItems.length); i++) {
          const _gi = _gItems[i];
          _gTxt += `🪧 *${i + 1}. ${_gi.title}*\n🖥 ${_gi.snippet}\n🌐 ${_gi.link}\n\n`;
        }
        await sock.sendMessage(from, { text: _gTxt.trim() }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Google search failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .weather ───────────────────────────────────────────────────────────────
  {
    cmd: "weather",
    aliases: ["wx"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _city = args.trim();
      if (!_city) { await sock.sendMessage(from, { text: `🌤️ *Usage:* \`${pfx}weather <city>\`\n*Example:* \`${pfx}weather Nairobi\`` }, { quoted: msg }); return; }
      try {
        const _wRes = await axios.get(`https://wttr.in/${encodeURIComponent(_city)}?format=j1`, { timeout: 15000 });
        const _w    = _wRes.data;
        const _cur  = _w.current_condition[0];
        const _area = _w.nearest_area[0];
        await sock.sendMessage(from, {
          text:
            `🌤️ *WEATHER REPORT*\n━━━━━━━━━━━━━━━━\n` +
            `📍 *Location:* ${_area.areaName[0].value}, ${_area.country[0].value}\n` +
            `🌡️ *Temperature:* ${_cur.temp_C}°C (Feels like ${_cur.FeelsLikeC}°C)\n` +
            `🌥️ *Condition:* ${_cur.weatherDesc[0].value}\n` +
            `💧 *Humidity:* ${_cur.humidity}%\n` +
            `💨 *Wind Speed:* ${_cur.windspeedKmph} km/h\n` +
            `━━━━━━━━━━━━━━━━\n⚡ _Powered by NEXUS-MD_`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Couldn't get weather for *${_city}*. Check the city name and try again.` }, { quoted: msg }); }
    },
  },

  // ── .quotes / .quote ───────────────────────────────────────────────────────
  {
    cmd: "quotes",
    aliases: ["quote"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        const _qotdRes = await axios.get("https://favqs.com/api/qotd", { timeout: 15000 });
        const _qt = _qotdRes.data?.quote;
        if (!_qt) throw new Error("Empty response");
        await sock.sendMessage(from, { text: `💬 *"${_qt.body}"*\n\n— *${_qt.author}*\n\n𝗤𝘂𝗼𝘁𝗲 𝗕𝘆 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Failed to fetch quote: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .pair / .rent ──────────────────────────────────────────────────────────
  {
    cmd: "pair",
    aliases: ["rent"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _pairNum = args.trim();
      if (!_pairNum) {
        await sock.sendMessage(from, {
          text: `📱 Usage: \`${pfx}pair <number>\`\nExample: \`${pfx}pair 254114280000\`\nProvide a valid WhatsApp number without + sign.`,
        }, { quoted: msg });
        return;
      }
      try {
        const _nums = _pairNum.split(",").map(v => v.replace(/[^0-9]/g, "")).filter(v => v.length > 5 && v.length < 20);
        if (!_nums.length) { await sock.sendMessage(from, { text: "❌ Invalid number format. Use digits only." }, { quoted: msg }); return; }
        for (const _n of _nums) {
          const _jid    = _n + "@s.whatsapp.net";
          const _exists = await sock.onWhatsApp(_jid).catch(() => []);
          if (!_exists?.[0]?.exists) { await sock.sendMessage(from, { text: `❌ +${_n} is not registered on WhatsApp.` }, { quoted: msg }); continue; }
          await sock.sendMessage(from, { text: "⏳ Wait a moment for the pairing code..." }, { quoted: msg });
          const _pRes  = await axios.get(`https://nexus-session-76ah.onrender.com/code?number=${_n}`, { timeout: 30000 });
          const _code  = _pRes.data?.code;
          if (!_code) { await sock.sendMessage(from, { text: "❌ Failed to retrieve a pairing code. Try again later." }, { quoted: msg }); continue; }
          await new Promise(r => setTimeout(r, 5000));
          await sock.sendMessage(from, { text: `🔑 *Pairing Code*\n\n${_code}` }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ An error occurred: ${e.message}` }, { quoted: msg }); }
    },
  },

];
