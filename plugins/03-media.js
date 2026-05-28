"use strict";
// ── Media commands ─────────────────────────────────────────────────────────────
// sticker, save, dp, dps, status, fullpp, screenshot, vv/retrieve,
// toimage/photo, toimg, remini, enc, icon, carbon

module.exports = [

  // ── .sticker ───────────────────────────────────────────────────────────────
  {
    cmd: "sticker",
    aliases: ["s", "stiker"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, downloadMediaMessage, normalizeMessageContent } = ctx;
      const quotedMsg  = msg.quoted?.message || null;
      const quotedNorm = quotedMsg ? (normalizeMessageContent(quotedMsg) || quotedMsg) : null;
      const hasImg     = quotedNorm?.imageMessage || quotedMsg?.imageMessage;
      const hasVid     = quotedNorm?.videoMessage || quotedMsg?.videoMessage;
      if (!hasImg && !hasVid) {
        await sock.sendMessage(from, {
          text: `🎭 *Sticker Maker*\n\nReply to an image or video with \`${pfx}sticker\` to convert it.\n\nOptional: \`${pfx}sticker <pack name> | <author>\``,
        }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "⏳ Creating sticker..." }, { quoted: msg });
      try {
        const buf = await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {});
        const ffmpeg  = require("fluent-ffmpeg");
        const ffPath  = require("@ffmpeg-installer/ffmpeg").path;
        const os      = require("os");
        const fs      = require("fs");
        const path    = require("path");
        ffmpeg.setFfmpegPath(ffPath);
        const tmpIn  = path.join(os.tmpdir(), `stk_in_${Date.now()}.${hasImg ? "jpg" : "mp4"}`);
        const tmpOut = path.join(os.tmpdir(), `stk_out_${Date.now()}.webp`);
        fs.writeFileSync(tmpIn, buf);
        await new Promise((resolve, reject) => {
          const cmd = ffmpeg(tmpIn);
          if (hasImg) {
            cmd.outputOptions(["-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2"])
               .output(tmpOut).on("end", resolve).on("error", reject).run();
          } else {
            cmd.outputOptions(["-vf","scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2","-t","7","-loop","0","-an"])
               .output(tmpOut).on("end", resolve).on("error", reject).run();
          }
        });
        const stkBuf = fs.readFileSync(tmpOut);
        try { fs.unlinkSync(tmpIn); } catch {}
        try { fs.unlinkSync(tmpOut); } catch {}
        await sock.sendMessage(from, { sticker: stkBuf }, { quoted: msg });
      } catch (e) {
        await sock.sendMessage(from, { text: `❌ Sticker creation failed: ${e.message}` }, { quoted: msg });
      }
    },
  },

  // ── .save ──────────────────────────────────────────────────────────────────
  {
    cmd: "save",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, pfx, isOwner, downloadMediaMessage, getContentType, normalizeMessageContent, senderJid } = ctx;
      if (!msg.quoted) { await sock.sendMessage(from, { text: `💾 Reply to any media with \`${pfx}save\` to save it to your DM.` }, { quoted: msg }); return; }
      try {
        const qMsg   = msg.quoted.message || {};
        const qNorm  = normalizeMessageContent(qMsg) || qMsg;
        const qType  = getContentType(qNorm) || getContentType(qMsg) || Object.keys(qMsg)[0];
        const qMedia = qNorm[qType] || qMsg[qType];
        if (!qMedia) { await sock.sendMessage(from, { text: "❌ No downloadable media found in the quoted message." }, { quoted: msg }); return; }
        const buf    = await downloadMediaMessage({ key: msg.quoted.key, message: qMsg }, "buffer", { reuploadRequest: sock.updateMediaMessage });
        const ownerJid = senderJid;
        const caption = `💾 *Saved by NEXUS-MD*\n${qMedia.caption || ""}`;
        if (qType === "imageMessage") await sock.sendMessage(ownerJid, { image: buf, caption });
        else if (qType === "videoMessage") await sock.sendMessage(ownerJid, { video: buf, caption, mimetype: qMedia.mimetype || "video/mp4" });
        else if (qType === "audioMessage") await sock.sendMessage(ownerJid, { audio: buf, mimetype: qMedia.mimetype || "audio/ogg; codecs=opus", ptt: !!qMedia.ptt });
        else if (qType === "stickerMessage") await sock.sendMessage(ownerJid, { sticker: buf });
        else if (qType === "documentMessage") await sock.sendMessage(ownerJid, { document: buf, mimetype: qMedia.mimetype, fileName: qMedia.fileName || "file" });
        else { await sock.sendMessage(from, { text: "❌ Unsupported media type." }, { quoted: msg }); return; }
        await sock.sendMessage(from, { text: "✅ Media saved to your DM!" }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Save failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .dp ────────────────────────────────────────────────────────────────────
  {
    cmd: "dp",
    aliases: ["getdp", "pfp"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : ctx.senderJid);
      try {
        const url = await sock.profilePictureUrl(target, "image").catch(() => null);
        if (!url) { await sock.sendMessage(from, { text: `❌ No profile picture found for @${target.split("@")[0]}.`, mentions: [target] }, { quoted: msg }); return; }
        const buf = Buffer.from((await axios.get(url, { responseType: "arraybuffer", timeout: 15000 })).data);
        await sock.sendMessage(from, { image: buf, caption: `🖼️ *Profile Picture of @${target.split("@")[0]}*`, mentions: [target] }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Could not fetch DP: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .dps ───────────────────────────────────────────────────────────────────
  {
    cmd: "dps",
    aliases: ["setdp", "setpp"],
    async run(ctx) {
      const { sock, msg, from, pfx, isOwner, downloadMediaMessage } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const quotedMsg = msg.quoted?.message || null;
      const hasImg = quotedMsg?.imageMessage;
      if (!hasImg) { await sock.sendMessage(from, { text: `📸 Reply to an image with \`${pfx}dps\` to set it as the bot profile picture.` }, { quoted: msg }); return; }
      try {
        const buf = await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {});
        await sock.updateProfilePicture(sock.user?.id || from, buf);
        await sock.sendMessage(from, { text: "✅ Profile picture updated!" }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .status ────────────────────────────────────────────────────────────────
  {
    cmd: "status",
    aliases: ["setstatus"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      const text = args.trim();
      if (!text) { await sock.sendMessage(from, { text: `Usage: \`${pfx}status <your new status>\`` }, { quoted: msg }); return; }
      try {
        await sock.updateProfileStatus(text);
        await sock.sendMessage(from, { text: `✅ Status updated to:\n_${text}_` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .fullpp ────────────────────────────────────────────────────────────────
  {
    cmd: "fullpp",
    aliases: ["fullpfp", "fulldp"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const target = msg.mentionedJids?.[0] || msg.quoted?.sender
        || (args ? args.replace(/[^0-9]/g, "") + "@s.whatsapp.net" : ctx.senderJid);
      try {
        const url = await sock.profilePictureUrl(target, "image").catch(() => null);
        if (!url) { await sock.sendMessage(from, { text: `❌ No profile picture available for @${target.split("@")[0]}.`, mentions: [target] }, { quoted: msg }); return; }
        await sock.sendMessage(from, {
          document: { url },
          mimetype: "image/jpeg",
          fileName: `${target.split("@")[0]}_fullpp.jpg`,
          caption: `🖼️ Full profile picture of @${target.split("@")[0]}`,
          mentions: [target],
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Could not fetch full DP: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .screenshot ────────────────────────────────────────────────────────────
  {
    cmd: "screenshot",
    aliases: ["ss", "web"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, axios } = ctx;
      const url = args.trim();
      if (!url || !/^https?:\/\//i.test(url)) {
        await sock.sendMessage(from, { text: `📸 *Screenshot*\n\nUsage: \`${pfx}screenshot https://example.com\`` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "📸 Taking screenshot... please wait ⏳" }, { quoted: msg });
      try {
        const ssRes = await axios.get(`https://api.screenshotone.com/take?url=${encodeURIComponent(url)}&format=jpg&viewport_width=1280&viewport_height=720&image_quality=80`, {
          responseType: "arraybuffer", timeout: 30000,
        }).catch(() => null);
        if (ssRes?.data) {
          await sock.sendMessage(from, { image: Buffer.from(ssRes.data), caption: `📸 Screenshot of ${url}` }, { quoted: msg });
          return;
        }
        // Fallback
        const fallRes = await axios.get(`https://image.thum.io/get/width/1280/crop/900/png/${encodeURIComponent(url)}`, { responseType: "arraybuffer", timeout: 30000 });
        await sock.sendMessage(from, { image: Buffer.from(fallRes.data), caption: `📸 Screenshot of ${url}` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Screenshot failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .vv / .retrieve ────────────────────────────────────────────────────────
  {
    cmd: "vv",
    aliases: ["retrieve"],
    async run(ctx) {
      const { sock, msg, from, pfx, cmd, downloadMediaMessage } = ctx;
      if (!msg.quoted) {
        await sock.sendMessage(from, { text: `👁️ Usage: \`${pfx}${cmd}\` while replying to a view-once message.` }, { quoted: msg });
        return;
      }
      try {
        const _voMsg   = msg.quoted.message || {};
        const _voInner = _voMsg.viewOnceMessage?.message
          || _voMsg.viewOnceMessageV2?.message
          || _voMsg.viewOnceMessageV2Extension?.message
          || _voMsg;
        const _voType  = Object.keys(_voInner)[0] || "";
        const _voMedia = _voInner[_voType];
        if (!_voMedia) { await sock.sendMessage(from, { text: "❌ Could not find media in the quoted message." }, { quoted: msg }); return; }
        const _voBuf = await downloadMediaMessage({ key: msg.quoted.key, message: _voInner }, "buffer", { reuploadRequest: sock.updateMediaMessage });
        const _voCaption = `👁️ *Retrieved by NEXUS-MD!*\n${_voMedia.caption || ""}`;
        if (_voType === "imageMessage") await sock.sendMessage(from, { image: _voBuf, caption: _voCaption }, { quoted: msg });
        else if (_voType === "videoMessage") await sock.sendMessage(from, { video: _voBuf, caption: _voCaption }, { quoted: msg });
        else if (_voType === "audioMessage") await sock.sendMessage(from, { audio: _voBuf, mimetype: _voMedia.mimetype || "audio/ogg; codecs=opus", ptt: !!_voMedia.ptt }, { quoted: msg });
        else { await sock.sendMessage(from, { text: "❌ Quoted message doesn't contain viewable image or video." }, { quoted: msg }); return; }
        // Forward to all admins
        const { admins: _vvAdmins } = require("./config");
        const _vvSenderPh = (msg.quoted?.key?.participant || msg.quoted?.key?.remoteJid || "").split("@")[0].split(":")[0];
        const _vvTz    = ctx.settings.get("timezone") || "Africa/Nairobi";
        const _vvTime  = new Date().toLocaleTimeString("en-US", { timeZone: _vvTz, hour: "2-digit", minute: "2-digit", hour12: true });
        const _vvLabel = _voType === "imageMessage" ? "📷 Photo" : _voType === "videoMessage" ? "🎥 Video" : "🎵 Audio";
        const _vvHeader = `👁 *View-Once Forwarded* — NEXUS-MD\n${"─".repeat(28)}\n${_vvLabel}\n👤 *From:* +${_vvSenderPh || "unknown"}\n🕐 *Time:* ${_vvTime}${_voMedia.caption ? `\n📝 _${_voMedia.caption}_` : ""}`;
        for (const _vvNum of (_vvAdmins || [])) {
          const _vvOwnerJid = `${_vvNum.replace(/\D/g, "")}@s.whatsapp.net`;
          if (_vvOwnerJid === ctx.senderJid) continue;
          if (_voType === "imageMessage") await sock.sendMessage(_vvOwnerJid, { image: _voBuf, caption: _vvHeader }).catch(() => {});
          else if (_voType === "videoMessage") await sock.sendMessage(_vvOwnerJid, { video: _voBuf, caption: _vvHeader, mimetype: _voMedia.mimetype || "video/mp4" }).catch(() => {});
          else await sock.sendMessage(_vvOwnerJid, { audio: _voBuf, mimetype: _voMedia.mimetype || "audio/ogg; codecs=opus", ptt: !!_voMedia.ptt }).catch(() => {});
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Retrieve failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .toimage / .photo ──────────────────────────────────────────────────────
  {
    cmd: "toimage",
    aliases: ["photo"],
    async run(ctx) {
      const { sock, msg, from, pfx, downloadMediaMessage } = ctx;
      if (!msg.quoted) { await sock.sendMessage(from, { text: `🖼️ Usage: \`${pfx}toimage\` while replying to a sticker.` }, { quoted: msg }); return; }
      const _tiMsg  = msg.quoted.message || {};
      const _tiType = Object.keys(_tiMsg)[0] || "";
      if (_tiType !== "stickerMessage") { await sock.sendMessage(from, { text: "❌ Please reply to a sticker message." }, { quoted: msg }); return; }
      try {
        const ffmpeg  = require("fluent-ffmpeg");
        const ffPath  = require("@ffmpeg-installer/ffmpeg").path;
        const os2     = require("os");
        const fs      = require("fs");
        const path    = require("path");
        ffmpeg.setFfmpegPath(ffPath);
        const _stkBuf  = await downloadMediaMessage({ key: msg.quoted.key, message: _tiMsg }, "buffer", {});
        const _tmpWebp = path.join(os2.tmpdir(), `stk_${Date.now()}.webp`);
        const _tmpPng  = path.join(os2.tmpdir(), `stk_${Date.now()}.png`);
        fs.writeFileSync(_tmpWebp, _stkBuf);
        await new Promise((resolve, reject) => {
          ffmpeg(_tmpWebp).outputOptions(["-frames:v","1"]).output(_tmpPng).on("end", resolve).on("error", reject).run();
        });
        const _pngBuf = fs.readFileSync(_tmpPng);
        try { fs.unlinkSync(_tmpWebp); } catch {}
        try { fs.unlinkSync(_tmpPng);  } catch {}
        await sock.sendMessage(from, { image: _pngBuf, caption: "𝗖𝗼𝗻𝘃𝗲𝗿𝘁𝗲𝗱 𝗯𝘆 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗" }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Sticker to image conversion failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .toimg / .sticker2img ──────────────────────────────────────────────────
  {
    cmd: "toimg",
    aliases: ["sticker2img", "stickertoimg"],
    async run(ctx) {
      const { sock, msg, from, pfx, downloadMediaMessage, normalizeMessageContent } = ctx;
      const quotedMsg  = msg.quoted?.message || null;
      const quotedNorm = quotedMsg ? (normalizeMessageContent(quotedMsg) || quotedMsg) : null;
      const isStic     = quotedNorm && (quotedNorm.stickerMessage || quotedMsg?.stickerMessage);
      if (!isStic) { await sock.sendMessage(from, { text: `❌ Reply to a sticker with \`${pfx}toimg\` to convert it to an image.` }, { quoted: msg }); return; }
      try {
        const sticBuf = Buffer.from(await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {}));
        const sharp   = require("sharp");
        const pngBuf  = await sharp(sticBuf).toFormat("png").toBuffer();
        await sock.sendMessage(from, { image: pngBuf, caption: "🖼️ Here is your sticker as an image!" }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Conversion failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .remini / .enhance ────────────────────────────────────────────────────
  {
    cmd: "remini",
    aliases: ["enhance", "hd"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, downloadMediaMessage, normalizeMessageContent } = ctx;
      const quotedMsg  = msg.quoted?.message || null;
      const quotedNorm = quotedMsg ? (normalizeMessageContent(quotedMsg) || quotedMsg) : null;
      const _hasImg    = quotedNorm?.imageMessage || quotedMsg?.imageMessage;
      if (!_hasImg) { await sock.sendMessage(from, { text: `✨ *AI Image Enhancer*\n\nReply to an image with \`${pfx}remini\` to enhance it using AI.\n\nOptional: \`${pfx}remini recolor\` or \`${pfx}remini dehaze\`` }, { quoted: msg }); return; }
      await sock.sendMessage(from, { text: "✨ Enhancing your image with AI... please wait ⏳" }, { quoted: msg });
      try {
        const imgBuf   = Buffer.from(await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {}));
        const reminiLib = require("./lib/remini");
        const _mode    = (args || "enhance").toLowerCase().trim();
        const enhanced = await reminiLib(imgBuf, ["enhance","recolor","dehaze"].includes(_mode) ? _mode : "enhance");
        await sock.sendMessage(from, { image: enhanced, caption: "✨ *AI Enhanced Image*" }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Enhancement failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .enc ───────────────────────────────────────────────────────────────────
  {
    cmd: "enc",
    aliases: ["encrypt"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      if (!msg.quoted) { await sock.sendMessage(from, { text: `🔐 Reply to a media message with \`${pfx}enc\` to get its raw encrypted info.` }, { quoted: msg }); return; }
      try {
        const keyStr = JSON.stringify(msg.quoted.key || {}, null, 2);
        const msgStr = JSON.stringify(msg.quoted.message || {}, null, 2);
        await sock.sendMessage(from, { text: `🔐 *Encrypted Message Info*\n\n*Key:*\n\`\`\`${keyStr.slice(0,500)}\`\`\`\n\n*Message type info:*\n\`\`\`${msgStr.slice(0,500)}\`\`\`` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ enc error: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .icon / .groupicon ─────────────────────────────────────────────────────
  {
    cmd: "icon",
    aliases: ["groupicon", "setgicon"],
    async run(ctx) {
      const { sock, msg, from, pfx, isOwner, downloadMediaMessage } = ctx;
      if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
      if (!from.endsWith("@g.us")) { await sock.sendMessage(from, { text: "❌ Only works in groups." }, { quoted: msg }); return; }
      const quotedMsg = msg.quoted?.message || null;
      const hasImg    = quotedMsg?.imageMessage;
      if (!hasImg) { await sock.sendMessage(from, { text: `🖼️ Reply to an image with \`${pfx}icon\` to set it as the group icon.` }, { quoted: msg }); return; }
      try {
        const buf = await downloadMediaMessage({ key: msg.quoted.key, message: quotedMsg }, "buffer", {});
        await sock.updateProfilePicture(from, buf);
        await sock.sendMessage(from, { text: "✅ Group icon updated!" }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Failed to update icon: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .carbon ────────────────────────────────────────────────────────────────
  {
    cmd: "carbon",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, pfx, settings, axios } = ctx;
      if (!msg.quoted?.body && !msg.quoted?.text) { await sock.sendMessage(from, { text: `💻 Usage: Quote a code message and send \`${pfx}carbon\`\n\nConverts code to a beautiful image.` }, { quoted: msg }); return; }
      const _codeText = msg.quoted.body || msg.quoted.text || "";
      const _botNm    = settings.get("botName") || "NEXUS-MD";
      try {
        const _cRes = await axios.post("https://carbonara.solopov.dev/api/cook", {
          code: _codeText, backgroundColor: "#1F816D",
        }, { responseType: "arraybuffer", timeout: 30000, headers: { "Content-Type": "application/json" } });
        await sock.sendMessage(from, { image: Buffer.from(_cRes.data), caption: `𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗗 𝗕𝗬 ${_botNm}` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Carbon failed: ${e.message}` }, { quoted: msg }); }
    },
  },

];
