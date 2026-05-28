"use strict";
// ── Download commands ─────────────────────────────────────────────────────────
// play, song/music, play2, video/ytmp4, y2mate/ytdl, facebook/fb,
// instagram/ig, anime, apk, trending, lyrics, tiktok, pinterest
//
// NOTE: _xwolfSearch(query) returns { url, title } — a single object, NOT an array.

module.exports = [

  // ── .play ──────────────────────────────────────────────────────────────────
  {
    cmd: "play",
    aliases: ["yt", "ytaudio"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, _xwolfSearch, _xwolfAudio } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🎵 Usage: \`${pfx}play <song name>\`\nExample: \`${pfx}play Wakadinali Kiboko\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `🔍 Searching for *${query}*...` }, { quoted: msg });
      try {
        if (!_xwolfSearch) throw new Error("Search helper not available");
        const result = await _xwolfSearch(query);
        const title  = result.title || query;
        const url    = result.url;
        await sock.sendMessage(from, { text: `🎵 *${title}*\n\n⏳ Downloading audio...` }, { quoted: msg });
        if (!_xwolfAudio) throw new Error("Audio download helper not available");
        const dlData = await _xwolfAudio(url, title);
        if (!dlData?.downloadUrl) throw new Error("Download failed — no URL returned");
        const dlUrl = dlData.proxyUrl || dlData.downloadUrl;
        await sock.sendMessage(from, {
          audio: { url: dlUrl }, mimetype: "audio/mpeg", ptt: false,
          fileName: `${title}.mp3`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Play failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .song / .music ─────────────────────────────────────────────────────────
  {
    cmd: "song",
    aliases: ["music", "audio", "mp3"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, _xwolfSearch, _xwolfAudio } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🎵 Usage: \`${pfx}song <song name>\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `🔍 Searching for *${query}*...` }, { quoted: msg });
      try {
        if (!_xwolfSearch) throw new Error("Search helper not available");
        const result = await _xwolfSearch(query);
        const title  = result.title || query;
        const url    = result.url;
        await sock.sendMessage(from, { text: `⏳ Downloading *${title}*...` }, { quoted: msg });
        if (!_xwolfAudio) throw new Error("Audio download helper not available");
        const dlData = await _xwolfAudio(url, title);
        if (!dlData?.downloadUrl) throw new Error("Download failed — no URL returned");
        const dlUrl = dlData.proxyUrl || dlData.downloadUrl;
        await sock.sendMessage(from, {
          document: { url: dlUrl }, mimetype: "audio/mpeg",
          fileName: `${title}.mp3`, caption: `🎵 *${title}*\n\n_𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗱 𝗯𝘆 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗_`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Song download failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .play2 ─────────────────────────────────────────────────────────────────
  {
    cmd: "play2",
    aliases: ["yta2"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, _xwolfSearch, _xwolfAudio } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🎵 Usage: \`${pfx}play2 <song name>\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `🔍 Searching...` }, { quoted: msg });
      try {
        if (!_xwolfSearch) throw new Error("Search helper not available");
        const result = await _xwolfSearch(query);
        const title  = result.title || query;
        const url    = result.url;
        if (!_xwolfAudio) throw new Error("Audio download helper not available");
        const dlData = await _xwolfAudio(url, title);
        if (!dlData?.downloadUrl) throw new Error("Download failed");
        const dlUrl = dlData.proxyUrl || dlData.downloadUrl;
        await sock.sendMessage(from, {
          audio: { url: dlUrl }, mimetype: "audio/mpeg", ptt: false,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ play2 failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .video / .ytmp4 ────────────────────────────────────────────────────────
  {
    cmd: "video",
    aliases: ["ytmp4", "ytv", "ytvid"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, _xwolfSearch, _xwolfVideo } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🎬 Usage: \`${pfx}video <title>\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `🔍 Searching for *${query}*...` }, { quoted: msg });
      try {
        if (!_xwolfSearch) throw new Error("Search helper not available");
        const result = await _xwolfSearch(query);
        const title  = result.title || query;
        const url    = result.url;
        await sock.sendMessage(from, { text: `⏳ Downloading video *${title}*...` }, { quoted: msg });
        if (!_xwolfVideo) throw new Error("Video download helper not available");
        const dlData = await _xwolfVideo(url, title);
        if (!dlData?.downloadUrl) throw new Error("Download failed — no URL returned");
        const dlUrl = dlData.proxyUrl || dlData.downloadUrl;
        await sock.sendMessage(from, {
          document: { url: dlUrl }, mimetype: "video/mp4",
          fileName: `${title}.mp4`, caption: `🎬 *${title}*\n\n_𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗱 𝗯𝘆 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗_`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Video download failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .y2mate / .ytdl ────────────────────────────────────────────────────────
  {
    cmd: "y2mate",
    aliases: ["ytdl", "ytdown", "ydl"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, _xwolfSearch, _xwolfVideo, _xwolfAudio } = ctx;
      const parts      = args.trim().split(/\s+/);
      const urlOrQuery = parts[0];
      const format     = (parts[1] || "audio").toLowerCase();
      if (!urlOrQuery) { await sock.sendMessage(from, { text: `⬇️ *Y2Mate Downloader*\n\nUsage: \`${pfx}y2mate <url or title> [audio|video]\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `⏳ Downloading...` }, { quoted: msg });
      try {
        const isUrl  = /^https?:\/\//i.test(urlOrQuery);
        let   dlUrl2 = urlOrQuery;
        let   title2 = urlOrQuery;
        if (!isUrl && _xwolfSearch) {
          const result = await _xwolfSearch(urlOrQuery);
          dlUrl2 = result.url;
          title2 = result.title || urlOrQuery;
        }
        const dlData = format === "video"
          ? (_xwolfVideo ? await _xwolfVideo(dlUrl2, title2) : null)
          : (_xwolfAudio ? await _xwolfAudio(dlUrl2, title2) : null);
        if (!dlData?.downloadUrl) throw new Error("Download failed");
        const dlUrl3 = dlData.proxyUrl || dlData.downloadUrl;
        if (format === "video") {
          await sock.sendMessage(from, { document: { url: dlUrl3 }, mimetype: "video/mp4", fileName: `${title2}.mp4`, caption: "🎬 Downloaded by NEXUS-MD" }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { document: { url: dlUrl3 }, mimetype: "audio/mpeg", fileName: `${title2}.mp3`, caption: "🎵 Downloaded by NEXUS-MD" }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Download failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .facebook / .fb ────────────────────────────────────────────────────────
  {
    cmd: "facebook",
    aliases: ["fb", "fbdl"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const url = args.trim();
      if (!url || !/facebook\.com|fb\.com|fb\.watch/i.test(url)) {
        await sock.sendMessage(from, { text: `📘 Usage: \`${pfx}facebook <facebook-video-url>\`` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "⏳ Fetching Facebook video..." }, { quoted: msg });
      try {
        const ax   = axios || require("axios");
        const res  = await ax.get(`https://api.xteam.xyz/fb?url=${encodeURIComponent(url)}`, { timeout: 20000 });
        const dlUrl = res.data?.sd || res.data?.hd || res.data?.video;
        if (!dlUrl) throw new Error("No download URL found");
        await sock.sendMessage(from, {
          document: { url: dlUrl }, mimetype: "video/mp4",
          fileName: "facebook_video.mp4", caption: "📘 *Downloaded by NEXUS-MD*",
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Facebook download failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .instagram / .ig ───────────────────────────────────────────────────────
  {
    cmd: "instagram",
    aliases: ["ig", "igdl", "insta"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const url = args.trim();
      if (!url || !/instagram\.com/i.test(url)) {
        await sock.sendMessage(from, { text: `📸 Usage: \`${pfx}instagram <instagram-url>\`` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "⏳ Fetching Instagram media..." }, { quoted: msg });
      try {
        const ax   = axios || require("axios");
        const res  = await ax.get(`https://api.xteam.xyz/ig?url=${encodeURIComponent(url)}`, { timeout: 20000 });
        const dlUrl = res.data?.url || res.data?.video || res.data?.image;
        if (!dlUrl) throw new Error("No download URL found");
        const isVid = /video/i.test(res.data?.type || "");
        if (isVid) {
          await sock.sendMessage(from, { document: { url: dlUrl }, mimetype: "video/mp4", fileName: "instagram.mp4", caption: "📸 *Downloaded by NEXUS-MD*" }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { image: { url: dlUrl }, caption: "📸 *Downloaded by NEXUS-MD*" }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Instagram download failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .anime ─────────────────────────────────────────────────────────────────
  {
    cmd: "anime",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🍥 Usage: \`${pfx}anime <anime name>\`` }, { quoted: msg }); return; }
      try {
        const ax    = axios || require("axios");
        const res   = await ax.get(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=1`, { timeout: 15000 });
        const anime = res.data?.data?.[0];
        if (!anime) { await sock.sendMessage(from, { text: `❌ Anime *${query}* not found.` }, { quoted: msg }); return; }
        const synopsis = (anime.synopsis || "No synopsis available.").slice(0, 500);
        const txt =
          `🍥 *${anime.title}* (${anime.title_japanese || ""})\n\n` +
          `📊 *Score:* ${anime.score || "N/A"}\n🎬 *Episodes:* ${anime.episodes || "N/A"}\n` +
          `📅 *Aired:* ${anime.aired?.string || "N/A"}\n🏆 *Status:* ${anime.status || "N/A"}\n` +
          `🎭 *Genres:* ${(anime.genres || []).map(g => g.name).join(", ") || "N/A"}\n\n` +
          `📖 ${synopsis}${synopsis.length >= 500 ? "..." : ""}\n\n🔗 ${anime.url || ""}`;
        const imgUrl = anime.images?.jpg?.large_image_url;
        if (imgUrl) {
          await sock.sendMessage(from, { image: { url: imgUrl }, caption: txt }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { text: txt }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Anime lookup failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .apk ───────────────────────────────────────────────────────────────────
  {
    cmd: "apk",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `📦 Usage: \`${pfx}apk <app name>\`\nExample: \`${pfx}apk WhatsApp\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `📦 *APK: ${query}*\n\n🔗 https://apkpure.com/search?q=${encodeURIComponent(query)}\n\n_Visit the link above to download the APK._` }, { quoted: msg });
    },
  },

  // ── .trending ──────────────────────────────────────────────────────────────
  {
    cmd: "trending",
    aliases: ["trends", "chart"],
    async run(ctx) {
      const { sock, msg, from, axios } = ctx;
      await sock.sendMessage(from, { text: "📈 Fetching trending music..." }, { quoted: msg });
      try {
        const ax   = axios || require("axios");
        const XWOLF_BASE = process.env.XWOLF_BASE || "https://apis.xwolf.space";
        const res  = await ax.get(`${XWOLF_BASE}/api/trending`, { timeout: 15000 }).catch(() => null);
        const list = res?.data?.data || res?.data?.results || res?.data || [];
        if (!Array.isArray(list) || !list.length) throw new Error("No trending data");
        let txt = `📈 *Trending Music*\n\n`;
        list.slice(0, 10).forEach((t, i) => {
          txt += `${i + 1}. *${t.title || t.name || "Unknown"}* — ${t.artist || t.channel || "Unknown"}\n`;
        });
        await sock.sendMessage(from, { text: txt.trim() }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(from, { text: `❌ Could not fetch trending: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .lyrics ────────────────────────────────────────────────────────────────
  {
    cmd: "lyrics",
    aliases: ["lyric"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `🎼 Usage: \`${pfx}lyrics <song name or artist - song>\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `🔍 Fetching lyrics for *${query}*...` }, { quoted: msg });
      try {
        const ax   = axios || require("axios");
        const XWOLF_BASE = process.env.XWOLF_BASE || "https://apis.xwolf.space";
        const res  = await ax.get(`${XWOLF_BASE}/api/lyrics?q=${encodeURIComponent(query)}`, { timeout: 20000 });
        const data = res.data;
        const lyrics = data?.lyrics || data?.result?.lyrics || data?.data?.lyrics;
        if (!lyrics) throw new Error("No lyrics found");
        const title  = data?.title  || data?.result?.title  || query;
        const artist = data?.artist || data?.result?.artist || "Unknown";
        const full   = `🎼 *${title}* — ${artist}\n\n${lyrics}`;
        const chunks = [];
        for (let i = 0; i < full.length; i += 3000) chunks.push(full.slice(i, i + 3000));
        for (const c of chunks) await sock.sendMessage(from, { text: c }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Lyrics not found: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .tiktok ────────────────────────────────────────────────────────────────
  {
    cmd: "tiktok",
    aliases: ["tt", "tikdl"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const url = args.trim();
      if (!url || !/tiktok\.com/i.test(url)) {
        await sock.sendMessage(from, { text: `🎵 Usage: \`${pfx}tiktok <tiktok-url>\`` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "⏳ Fetching TikTok video..." }, { quoted: msg });
      try {
        const ax   = axios || require("axios");
        const res  = await ax.get(`https://api.xteam.xyz/tiktok?url=${encodeURIComponent(url)}`, { timeout: 20000 });
        const dlUrl = res.data?.url || res.data?.video || res.data?.nowm;
        if (!dlUrl) throw new Error("No download URL");
        await sock.sendMessage(from, {
          document: { url: dlUrl }, mimetype: "video/mp4",
          fileName: "tiktok.mp4", caption: "🎵 *Downloaded by NEXUS-MD*",
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ TikTok download failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .pinterest ─────────────────────────────────────────────────────────────
  {
    cmd: "pinterest",
    aliases: ["pin", "pindl"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const query = args.trim();
      if (!query) { await sock.sendMessage(from, { text: `📌 Usage: \`${pfx}pinterest <search term>\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: `🔍 Searching Pinterest for *${query}*...` }, { quoted: msg });
      try {
        const ax   = axios || require("axios");
        const res  = await ax.get(`https://api.xteam.xyz/pinterest?q=${encodeURIComponent(query)}`, { timeout: 15000 });
        const imgUrl = res.data?.url || res.data?.image || (Array.isArray(res.data) && res.data[0]);
        if (!imgUrl) throw new Error("No image URL");
        await sock.sendMessage(from, { image: { url: imgUrl }, caption: `📌 *${query}* — via Pinterest` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Pinterest search failed: ${e.message}` }, { quoted: msg }); }
    },
  },

];
