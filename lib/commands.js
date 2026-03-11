const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");

const ai = require("./ai");
const sticker = require("./sticker");
const downloader = require("./downloader");
const translator = require("./translator");
const analytics = require("./analytics");
const store = require("./store");
const booking = require("./booking");
const broadcast = require("./broadcast");
const security = require("./security");
const groups = require("./groups");
const converter = require("./converter");
const lang = require("./language");
const keywords = require("./keywords");
const admin = require("./admin");
const { prefix, botName } = require("../config");

async function reply(sock, msg, text) {
  return sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
}

async function getMediaBuffer(sock, msg, msgType) {
  try {
    const { downloadMediaMessage } = require("@whiskeysockets/baileys");
    return Buffer.from(await downloadMediaMessage(msg, "buffer", {}));
  } catch {
    return null;
  }
}

function getMentioned(msg) {
  const mentioned =
    msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
  return mentioned;
}

function getQuotedMsg(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
}

function getQuotedJid(msg) {
  return msg.message?.extendedTextMessage?.contextInfo?.participant;
}

const MENU = `╔══════════════════╗
║    ⚡ *${botName}*    ║
╚══════════════════╝

🤖 *AI Features*
• \`!ai [text]\` — Smart AI chat
• \`!ask [question]\` — Get answers
• \`!imagine [prompt]\` — Generate AI image
• \`!tts [text]\` — Text to speech
• \`!summarize [text]\` — Summarize text
• \`!clearchat\` — Clear AI history

🌍 *Tools*
• \`!tr [lang] [text]\` — Translate text
• \`!langs\` — List languages
• \`!dl [url]\` — Download media
• \`!yt [url]\` — Download YouTube audio
• \`!music [query]\` — Search music
• \`!convert\` — Convert file (reply to file)
• \`!sticker\` — Make sticker (reply to image/video)

🛒 *Shopping*
• \`!shop\` — View product catalog
• \`!order [id]\` — Place an order
• \`!myorders\` — View your orders

📅 *Booking*
• \`!services\` — View available services
• \`!book [#] [date] [time]\` — Book appointment
• \`!mybookings\` — View your bookings
• \`!cancel [id]\` — Cancel a booking

📊 *Info & Settings*
• \`!stats\` — Bot analytics
• \`!groupinfo\` — Group information
• \`!lang [code]\` — Set language
• \`!menu\` / \`!help\` — This menu

🔒 *Admin Commands*
• \`!kick @user\` — Kick member
• \`!promote @user\` — Promote to admin
• \`!demote @user\` — Remove admin
• \`!mute\` / \`!unmute\` — Toggle group chat
• \`!tagall [msg]\` — Tag everyone
• \`!antilink on/off\` — Toggle anti-link
• \`!antispam on/off\` — Toggle anti-spam
• \`!broadcast [msg]\` — Send to all
• \`!setkeyword [trigger]|[reply]\` — Add keyword
• \`!delkeyword [trigger]\` — Remove keyword
• \`!keywords\` — List keywords
• \`!setwelcome [msg]\` — Set welcome message
• \`!ban @user\` — Ban user
• \`!unban @user\` — Unban user
• \`!warn @user\` — Warn user

_Commands marked with *!prefix* use \`${prefix}\` as trigger_`;

async function handle(sock, msg) {
  const from = msg.key.remoteJid;
  const isGroup = from.endsWith("@g.us");
  const senderJid = isGroup
    ? msg.key.participant || msg.key.remoteJid
    : msg.key.remoteJid;
  const senderPhone = senderJid.split("@")[0].split(":")[0];

  const msgType = Object.keys(msg.message || {})[0];
  const body =
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    "";

  analytics.trackMessage(senderJid);

  const groupParticipants = isGroup
    ? await admin.getGroupParticipants(sock, from).catch(() => [])
    : [];
  const isAdminUser = admin.isAdmin(senderJid, groupParticipants);

  if (isGroup) {
    const settings = security.getGroupSettings(from);

    if (settings.antiLink && !isAdminUser && body && security.hasLink(body)) {
      try {
        await sock.sendMessage(from, {
          delete: msg.key,
        });
        await sock.sendMessage(
          from,
          { text: `⚠️ @${senderPhone} links are not allowed in this group!`, mentions: [senderJid] },
          { quoted: msg }
        );
      } catch {}
      return;
    }

    if (settings.antiSpam && !isAdminUser && security.isSpam(senderJid)) {
      try {
        await sock.sendMessage(from, {
          text: `⚠️ @${senderPhone} please slow down! You're sending too many messages.`,
          mentions: [senderJid],
        });
      } catch {}
      return;
    }

    if (settings.antiDelete) {
      security.cacheMessage(msg.key.id, msg);
    }
  }

  if (!body.startsWith(prefix)) {
    if (body) {
      const kwResponse = keywords.match(body);
      if (kwResponse) {
        await sock.sendMessage(from, { text: kwResponse }, { quoted: msg });
      }
    }
    return;
  }

  const [rawCmd, ...args] = body.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase();
  const text = args.join(" ");

  analytics.trackMessage(senderJid, cmd);
  console.log(`[CMD] ${senderPhone} → ${cmd}${text ? " " + text.slice(0, 40) : ""}`);

  try {
    switch (cmd) {
      case `${prefix}menu`:
      case `${prefix}help`:
        await reply(sock, msg, MENU);
        break;

      case `${prefix}ping`:
        await reply(sock, msg, `🏓 Pong! Bot is alive.\n⚡ *${botName}* is running.`);
        break;

      case `${prefix}ai`:
      case `${prefix}chat`: {
        if (!text) { await reply(sock, msg, `💬 Usage: *${prefix}ai [message]*`); break; }
        await sock.sendPresenceUpdate("composing", from);
        const aiReply = await ai.chat(senderJid, text);
        await reply(sock, msg, aiReply);
        break;
      }

      case `${prefix}ask`: {
        if (!text) { await reply(sock, msg, `❓ Usage: *${prefix}ask [question]*`); break; }
        await sock.sendPresenceUpdate("composing", from);
        const answer = await ai.ask(text);
        await reply(sock, msg, answer);
        break;
      }

      case `${prefix}summarize`:
      case `${prefix}summary`: {
        const toSummarize = text || getQuotedMsg(msg)?.conversation || getQuotedMsg(msg)?.extendedTextMessage?.text;
        if (!toSummarize) { await reply(sock, msg, `📝 Reply to a message or provide text: *${prefix}summarize [text]*`); break; }
        await sock.sendPresenceUpdate("composing", from);
        const summary = await ai.summarize(toSummarize);
        await reply(sock, msg, `📝 *Summary:*\n\n${summary}`);
        break;
      }

      case `${prefix}clearchat`: {
        ai.clearHistory(senderJid);
        await reply(sock, msg, "🗑️ Your AI chat history has been cleared.");
        break;
      }

      case `${prefix}imagine`:
      case `${prefix}image`: {
        if (!text) { await reply(sock, msg, `🎨 Usage: *${prefix}imagine [prompt]*`); break; }
        await reply(sock, msg, "🎨 Generating image, please wait...");
        const imgResult = await ai.generateImage(text);
        if (imgResult.error) { await reply(sock, msg, imgResult.error); break; }
        try {
          const res = await axios.get(imgResult.url, { responseType: "arraybuffer", timeout: 30000 });
          await sock.sendMessage(from, {
            image: Buffer.from(res.data),
            caption: `🎨 *Generated Image*\n_Prompt: ${text.slice(0, 100)}_`,
          }, { quoted: msg });
        } catch {
          await reply(sock, msg, `🎨 Image ready: ${imgResult.url}`);
        }
        break;
      }

      case `${prefix}tts`: {
        if (!text) { await reply(sock, msg, `🔊 Usage: *${prefix}tts [text]*`); break; }
        await reply(sock, msg, "🔊 Converting text to speech...");
        const outPath = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
        const ttsResult = await ai.textToSpeech(text, outPath);
        if (ttsResult.error) { await reply(sock, msg, ttsResult.error); break; }
        await sock.sendMessage(from, {
          audio: fs.readFileSync(ttsResult.path),
          mimetype: "audio/mpeg",
          ptt: true,
        }, { quoted: msg });
        try { fs.unlinkSync(ttsResult.path); } catch {}
        break;
      }

      case `${prefix}sticker`:
      case `${prefix}s`: {
        const imgMsg = msg.message?.imageMessage;
        const vidMsg = msg.message?.videoMessage;
        const quotedImg = getQuotedMsg(msg)?.imageMessage;
        const quotedVid = getQuotedMsg(msg)?.videoMessage;

        if (!imgMsg && !vidMsg && !quotedImg && !quotedVid) {
          await reply(sock, msg, `🎨 Reply to an image or video with *${prefix}sticker* to create a sticker.`);
          break;
        }

        await reply(sock, msg, "⏳ Creating sticker...");
        const targetMsg = (imgMsg || vidMsg) ? msg : {
          key: msg.key,
          message: getQuotedMsg(msg),
        };

        const buf = await getMediaBuffer(sock, targetMsg, Object.keys(targetMsg.message || {})[0]);
        if (!buf) { await reply(sock, msg, "❌ Could not download media."); break; }

        let stickerBuf;
        if (imgMsg || quotedImg) {
          stickerBuf = await sticker.imageToSticker(buf);
        } else {
          stickerBuf = await sticker.videoToSticker(buf);
        }
        await sock.sendMessage(from, { sticker: stickerBuf }, { quoted: msg });
        break;
      }

      case `${prefix}tr`:
      case `${prefix}translate`: {
        const parts = text.split(" ");
        const targetLang = parts[0];
        const textToTranslate = parts.slice(1).join(" ");
        if (!targetLang || !textToTranslate) {
          await reply(sock, msg, `🌍 Usage: *${prefix}tr [lang] [text]*\nExample: *${prefix}tr es Hello world*\nUse *${prefix}langs* to see language codes.`);
          break;
        }
        if (!translator.isValidLang(targetLang)) {
          await reply(sock, msg, `❌ Unknown language code: *${targetLang}*\nUse *${prefix}langs* to see valid codes.`);
          break;
        }
        await sock.sendPresenceUpdate("composing", from);
        const result = await translator.translate(textToTranslate, targetLang);
        await reply(sock, msg, `🌍 *Translation (${targetLang}):*\n\n${result.text}`);
        break;
      }

      case `${prefix}langs`:
        await reply(sock, msg, `🌍 *Supported Languages:*\n\n${lang.getLangList()}`);
        break;

      case `${prefix}lang`: {
        if (!text) { await reply(sock, msg, `🌍 Usage: *${prefix}lang [code]*\nExample: *${prefix}lang es*`); break; }
        const set = lang.setUserLang(senderJid, text.toLowerCase());
        if (set) await reply(sock, msg, `✅ Language set to *${lang.supportedLanguages[text.toLowerCase()]}*`);
        else await reply(sock, msg, `❌ Unknown language. Use *${prefix}langs* to see options.`);
        break;
      }

      case `${prefix}dl`:
      case `${prefix}download`: {
        if (!text) { await reply(sock, msg, `📥 Usage: *${prefix}dl [url]*`); break; }
        await reply(sock, msg, "📥 Downloading media, please wait...");
        try {
          const info = await downloader.getVideoInfo(text);
          const durationMin = Math.floor(info.duration / 60);
          if (durationMin > 10) {
            await reply(sock, msg, `⚠️ Video too long (${durationMin} min). Max 10 minutes allowed.`);
            break;
          }
          const dlResult = await downloader.downloadVideo(text);
          await sock.sendMessage(from, {
            video: fs.readFileSync(dlResult.path),
            caption: `🎬 *${dlResult.title}*`,
            mimetype: "video/mp4",
          }, { quoted: msg });
          fs.unlinkSync(dlResult.path);
        } catch (e) {
          await reply(sock, msg, `❌ Download failed: ${e.message}`);
        }
        break;
      }

      case `${prefix}yt`:
      case `${prefix}ytdl`:
      case `${prefix}audio`: {
        if (!text) { await reply(sock, msg, `🎵 Usage: *${prefix}yt [url]*`); break; }
        await reply(sock, msg, "🎵 Downloading audio, please wait...");
        try {
          const dlResult = await downloader.downloadAudio(text);
          await sock.sendMessage(from, {
            audio: fs.readFileSync(dlResult.path),
            mimetype: "audio/mpeg",
            ptt: false,
          }, { quoted: msg });
          await sock.sendMessage(from, { text: `🎵 *${dlResult.title}*` }, { quoted: msg });
          fs.unlinkSync(dlResult.path);
        } catch (e) {
          await reply(sock, msg, `❌ Audio download failed: ${e.message}`);
        }
        break;
      }

      case `${prefix}music`: {
        if (!text) { await reply(sock, msg, `🎵 Usage: *${prefix}music [query]*`); break; }
        await reply(sock, msg, `🔍 Searching for: _${text}_...`);
        const results = await downloader.searchYouTube(text);
        if (!results.length) {
          await reply(sock, msg, "❌ No results found. Try a different search.");
          break;
        }
        let resultText = `🎵 *Music Search Results:*\n\n`;
        results.forEach((r, i) => {
          resultText += `${i + 1}. *${r.title}*\n`;
          resultText += `   👤 ${r.channel || "Unknown"} | ⏱ ${r.duration || "?"}\n`;
          resultText += `   🔗 ${r.url}\n\n`;
        });
        resultText += `_Use *${prefix}yt [url]* to download audio_`;
        await reply(sock, msg, resultText);
        break;
      }

      case `${prefix}convert`: {
        const quotedMsg = getQuotedMsg(msg);
        if (!quotedMsg) {
          await reply(sock, msg, `📁 *File Converter*\n\nReply to a file with *${prefix}convert*\n\n${converter.getSupportedFormats()}`);
          break;
        }
        await reply(sock, msg, "🔄 Converting file...");
        const quotedType = Object.keys(quotedMsg)[0];
        const targetMsgForConvert = { key: msg.key, message: quotedMsg };
        const mediaBuf = await getMediaBuffer(sock, targetMsgForConvert, quotedType);
        if (!mediaBuf) { await reply(sock, msg, "❌ Could not read the file."); break; }

        if (quotedType === "videoMessage") {
          const audioBuf = await converter.videoToAudio(mediaBuf);
          await sock.sendMessage(from, {
            audio: audioBuf,
            mimetype: "audio/mpeg",
          }, { quoted: msg });
        } else if (quotedType === "imageMessage") {
          const format = (text || "pdf").toLowerCase();
          if (format === "pdf") {
            const pdfBuf = await converter.imageToPdf(mediaBuf);
            await sock.sendMessage(from, {
              document: pdfBuf,
              mimetype: "application/pdf",
              fileName: "converted.pdf",
            }, { quoted: msg });
          } else {
            const convertedBuf = await converter.convertImage(mediaBuf, format);
            await sock.sendMessage(from, {
              image: convertedBuf,
              caption: `✅ Converted to ${format.toUpperCase()}`,
            }, { quoted: msg });
          }
        } else if (quotedType === "audioMessage") {
          const oggBuf = await converter.audioToOgg(mediaBuf);
          await sock.sendMessage(from, {
            audio: oggBuf,
            mimetype: "audio/ogg; codecs=opus",
            ptt: true,
          }, { quoted: msg });
        } else {
          await reply(sock, msg, "❌ Unsupported file type for conversion.");
        }
        break;
      }

      case `${prefix}shop`:
      case `${prefix}catalog`: {
        await reply(sock, msg, store.formatCatalog());
        break;
      }

      case `${prefix}order`: {
        if (!text) { await reply(sock, msg, `🛒 Usage: *${prefix}order [product-id]*\nSee products with *${prefix}shop*`); break; }
        const order = store.placeOrder(senderJid, parseInt(text), 1);
        if (!order) { await reply(sock, msg, "❌ Product not found. Use *!shop* to see available products."); break; }
        if (order.error) { await reply(sock, msg, `❌ ${order.error}`); break; }
        await reply(sock, msg,
          `✅ *Order Placed Successfully!*\n\n` +
          `📦 Product: *${order.productName}*\n` +
          `🔢 Order ID: *#${order.id}*\n` +
          `💰 Total: *$${order.total}*\n` +
          `📋 Status: *${order.status}*\n\n` +
          `_Our team will contact you shortly to complete your order._`
        );
        break;
      }

      case `${prefix}myorders`: {
        const orders = store.getUserOrders(senderJid);
        if (!orders.length) { await reply(sock, msg, "🛒 You have no orders yet. Use *!shop* to browse products."); break; }
        let orderText = `🛒 *Your Orders:*\n\n`;
        for (const o of orders) {
          orderText += `📦 *#${o.id}* — ${o.productName}\n`;
          orderText += `   💰 $${o.total} | 📋 ${o.status}\n`;
          orderText += `   🕐 ${new Date(o.time).toLocaleDateString()}\n\n`;
        }
        await reply(sock, msg, orderText);
        break;
      }

      case `${prefix}services`: {
        await reply(sock, msg, booking.formatServiceList());
        break;
      }

      case `${prefix}book`: {
        const [serviceNum, date, time] = args;
        if (!serviceNum || !date || !time) {
          await reply(sock, msg, `📅 Usage: *${prefix}book [service#] [date] [time]*\nExample: *${prefix}book 1 2024-12-25 14:00*\n\n${booking.formatServiceList()}`);
          break;
        }
        const b = booking.book(senderJid, serviceNum, date, time);
        await reply(sock, msg,
          `✅ *Booking Confirmed!*\n\n` +
          `📋 Booking ID: *#${b.id}*\n` +
          `🗂 Service: *${b.service}*\n` +
          `📆 Date: *${b.date}*\n` +
          `🕐 Time: *${b.time}*\n\n` +
          `_You will receive a reminder before your appointment._\n` +
          `_Use *${prefix}cancel ${b.id}* to cancel._`
        );
        break;
      }

      case `${prefix}mybookings`: {
        await reply(sock, msg, booking.formatUserBookings(senderJid));
        break;
      }

      case `${prefix}cancel`: {
        if (!text) { await reply(sock, msg, `❌ Usage: *${prefix}cancel [booking-id]*`); break; }
        const cancelled = booking.cancelBooking(senderJid, parseInt(text));
        if (cancelled) await reply(sock, msg, `✅ Booking *#${text}* has been cancelled.`);
        else await reply(sock, msg, `❌ Booking not found or does not belong to you.`);
        break;
      }

      case `${prefix}stats`: {
        await reply(sock, msg, analytics.formatStatsMessage());
        break;
      }

      case `${prefix}groupinfo`: {
        if (!isGroup) { await reply(sock, msg, "❌ This command only works in groups."); break; }
        const info = await groups.getGroupInfo(sock, from);
        if (!info) { await reply(sock, msg, "❌ Could not fetch group info."); break; }
        let infoText = `📋 *Group Information*\n\n`;
        infoText += `📛 Name: *${info.name}*\n`;
        if (info.description) infoText += `📝 Description: ${info.description}\n`;
        infoText += `👥 Members: *${info.memberCount}*\n`;
        infoText += `👑 Admins: *${info.admins}*\n`;
        infoText += `📅 Created: *${info.creation}*`;
        await reply(sock, msg, infoText);
        break;
      }

      case `${prefix}keywords`: {
        const kws = keywords.getAll();
        if (!kws.length) { await reply(sock, msg, "🔑 No keyword triggers set."); break; }
        let kwText = `🔑 *Keyword Triggers:*\n\n`;
        for (const kw of kws) {
          kwText += `• *${kw.keyword}* → ${kw.response.slice(0, 50)}${kw.response.length > 50 ? "..." : ""}\n`;
        }
        await reply(sock, msg, kwText);
        break;
      }

      case `${prefix}setkeyword`: {
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only command."); break; }
        const parts = text.split("|");
        if (parts.length < 2) {
          await reply(sock, msg, `🔑 Usage: *${prefix}setkeyword [trigger]|[response]*\nExample: *${prefix}setkeyword hi|Hello there!*`);
          break;
        }
        keywords.add(parts[0].trim(), parts.slice(1).join("|").trim());
        await reply(sock, msg, `✅ Keyword trigger set: *${parts[0].trim()}*`);
        break;
      }

      case `${prefix}delkeyword`: {
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only command."); break; }
        if (!text) { await reply(sock, msg, `Usage: *${prefix}delkeyword [trigger]*`); break; }
        keywords.remove(text.trim());
        await reply(sock, msg, `✅ Keyword removed: *${text.trim()}*`);
        break;
      }

      case `${prefix}broadcast`: {
        if (!admin.isSuperAdmin(senderJid)) { await reply(sock, msg, "🔒 Super admin only."); break; }
        if (!text) { await reply(sock, msg, `📢 Usage: *${prefix}broadcast [message]*`); break; }
        const recipients = broadcast.getRecipients();
        if (!recipients.length) {
          await reply(sock, msg, "📢 No recipients. Users who message the bot are added automatically.");
          break;
        }
        await reply(sock, msg, `📢 Sending to ${recipients.length} recipients...`);
        const results = await broadcast.broadcast(sock, text, recipients);
        await reply(sock, msg, `✅ Broadcast complete!\n📤 Sent: ${results.sent}\n❌ Failed: ${results.failed}`);
        break;
      }

      case `${prefix}antilink`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const val = args[0]?.toLowerCase();
        if (val !== "on" && val !== "off") { await reply(sock, msg, `Usage: *${prefix}antilink on/off*`); break; }
        security.setGroupSetting(from, "antiLink", val === "on");
        await reply(sock, msg, `🔐 Anti-link ${val === "on" ? "✅ *enabled*" : "❌ *disabled*"}`);
        break;
      }

      case `${prefix}antispam`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const val = args[0]?.toLowerCase();
        if (val !== "on" && val !== "off") { await reply(sock, msg, `Usage: *${prefix}antispam on/off*`); break; }
        security.setGroupSetting(from, "antiSpam", val === "on");
        await reply(sock, msg, `🛡 Anti-spam ${val === "on" ? "✅ *enabled*" : "❌ *disabled*"}`);
        break;
      }

      case `${prefix}antidelete`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const val = args[0]?.toLowerCase();
        if (val !== "on" && val !== "off") { await reply(sock, msg, `Usage: *${prefix}antidelete on/off*`); break; }
        security.setGroupSetting(from, "antiDelete", val === "on");
        await reply(sock, msg, `🗑 Anti-delete ${val === "on" ? "✅ *enabled*" : "❌ *disabled*"}`);
        break;
      }

      case `${prefix}kick`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const mentioned = getMentioned(msg);
        const quotedParticipant = getQuotedJid(msg);
        const target = mentioned[0] || quotedParticipant;
        if (!target) { await reply(sock, msg, `Usage: *${prefix}kick @user*`); break; }
        await admin.kickMember(sock, from, target);
        await reply(sock, msg, `✅ Kicked @${target.split("@")[0]} from the group.`);
        break;
      }

      case `${prefix}promote`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const mentioned = getMentioned(msg);
        if (!mentioned.length) { await reply(sock, msg, `Usage: *${prefix}promote @user*`); break; }
        await admin.promoteMember(sock, from, mentioned[0]);
        await reply(sock, msg, `⬆️ @${mentioned[0].split("@")[0]} has been promoted to admin.`);
        break;
      }

      case `${prefix}demote`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const mentioned = getMentioned(msg);
        if (!mentioned.length) { await reply(sock, msg, `Usage: *${prefix}demote @user*`); break; }
        await admin.demoteMember(sock, from, mentioned[0]);
        await reply(sock, msg, `⬇️ @${mentioned[0].split("@")[0]} has been demoted.`);
        break;
      }

      case `${prefix}mute`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        await admin.muteGroup(sock, from);
        await reply(sock, msg, "🔇 Group has been muted. Only admins can send messages.");
        break;
      }

      case `${prefix}unmute`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        await admin.unmuteGroup(sock, from);
        await reply(sock, msg, "🔊 Group has been unmuted. All members can send messages.");
        break;
      }

      case `${prefix}tagall`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        await groups.tagAll(sock, from, text || "📢 Attention everyone!");
        break;
      }

      case `${prefix}setwelcome`: {
        if (!isGroup) { await reply(sock, msg, "❌ Group only command."); break; }
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        if (!text) { await reply(sock, msg, `Usage: *${prefix}setwelcome [message]*\nUse {{name}} for member's name, {{group}} for group name.`); break; }
        groups.setWelcomeMessage(from, text);
        await reply(sock, msg, "✅ Welcome message updated!");
        break;
      }

      case `${prefix}ban`: {
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const mentioned = getMentioned(msg);
        if (!mentioned.length) { await reply(sock, msg, `Usage: *${prefix}ban @user*`); break; }
        security.banUser(mentioned[0]);
        await reply(sock, msg, `🔨 @${mentioned[0].split("@")[0]} has been banned from using the bot.`);
        break;
      }

      case `${prefix}unban`: {
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const mentioned = getMentioned(msg);
        if (!mentioned.length) { await reply(sock, msg, `Usage: *${prefix}unban @user*`); break; }
        security.unbanUser(mentioned[0]);
        await reply(sock, msg, `✅ @${mentioned[0].split("@")[0]} has been unbanned.`);
        break;
      }

      case `${prefix}warn`: {
        if (!isAdminUser) { await reply(sock, msg, "🔒 Admin only."); break; }
        const mentioned = getMentioned(msg);
        if (!mentioned.length) { await reply(sock, msg, `Usage: *${prefix}warn @user*`); break; }
        const warnCount = security.warnUser(mentioned[0]);
        await reply(sock, msg,
          `⚠️ @${mentioned[0].split("@")[0]} has been warned!\n` +
          `📊 Total warnings: *${warnCount}/3*\n` +
          `${warnCount >= 3 ? "🚨 This user has reached the warning limit!" : ""}`,
        );
        break;
      }

      case `${prefix}warnings`: {
        const mentioned = getMentioned(msg);
        const target = mentioned[0] || senderJid;
        const warnCount = security.getWarnings(target);
        await reply(sock, msg, `⚠️ @${target.split("@")[0]} has *${warnCount}* warning(s).`);
        break;
      }

      case `${prefix}time`:
        await reply(sock, msg, `🕐 *Current Server Time:*\n${new Date().toUTCString()}`);
        break;

      default:
        await reply(sock, msg, `❓ Unknown command: *${cmd}*\nType *${prefix}menu* to see all commands.`);
    }
  } catch (err) {
    console.error(`Command error [${cmd}]:`, err.message);
    await reply(sock, msg, `❌ An error occurred: ${err.message}`).catch(() => {});
  }
}

module.exports = { handle };
