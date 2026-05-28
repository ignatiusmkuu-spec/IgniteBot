"use strict";
// ── AI commands ───────────────────────────────────────────────────────────────
// chatbot/ai/bot (with hehe sub-command), hehe/vision/see/describe,
// data/bundles/packages

const axios = require("axios");

module.exports = [

  // ── .chatbot / .ai / .bot ─────────────────────────────────────────────────
  {
    cmd: "chatbot",
    aliases: ["ai", "bot"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, settings,
              _isChatbotOn, _setChatbot, _AI_PERSONA,
              downloadMediaMessage, getContentType, normalizeMessageContent } = ctx;

      const _cbSub  = (args.trim().split(/\s+/)[0] || "").toLowerCase();
      const _cbSub2 = (args.trim().split(/\s+/)[1] || "").toLowerCase();

      // ── .ai hehe — vision analysis on image / video / sticker ─────────────
      if (_cbSub === "hehe") {
        const _hvQMsg  = msg.quoted?.message || null;
        const _hvQType = _hvQMsg
          ? (getContentType(normalizeMessageContent(_hvQMsg) || {}) || Object.keys(_hvQMsg)[0])
          : null;
        const _VISION_TYPES = ["imageMessage","videoMessage","stickerMessage","viewOnceMessage","viewOnceMessageV2"];
        const _hvHasMedia   = _hvQMsg && _VISION_TYPES.includes(_hvQType);
        if (!_hvQMsg || !_hvHasMedia) {
          await sock.sendMessage(from, {
            text:
              `🤖👁 *AI Hehe — Vision Analysis*\n${"─".repeat(28)}\n\n` +
              `Reply to a *photo, video, or sticker* and send:\n  \`${pfx}ai hehe\`\n\n` +
              `Or ask a specific question:\n  \`${pfx}ai hehe what does this meme mean?\`\n\n` +
              `_Powered by Llama 4 Vision / GPT-4o / Gemini_`,
          }, { quoted: msg });
          return;
        }
        await sock.sendMessage(from, { text: "🤖👁 Analysing media... ⏳" }, { quoted: msg });
        try {
          const _hvInner     = _hvQMsg?.viewOnceMessage?.message || _hvQMsg?.viewOnceMessageV2?.message || _hvQMsg;
          const _hvInnerType = getContentType(normalizeMessageContent(_hvInner) || {}) || Object.keys(_hvInner)[0];
          const _hvBuf       = await downloadMediaMessage({ key: msg.quoted.key, message: _hvInner }, "buffer", { reuploadRequest: sock.updateMediaMessage });
          let _hvImgBase64 = null, _hvImgMime = "image/jpeg", _hvMediaLabel = "image";
          if (_hvInnerType === "stickerMessage") {
            _hvMediaLabel = "sticker";
            try { const sharp = require("sharp"); const _pngBuf = await sharp(_hvBuf).png().toBuffer(); _hvImgBase64 = _pngBuf.toString("base64"); _hvImgMime = "image/png"; }
            catch { _hvImgBase64 = _hvBuf.toString("base64"); _hvImgMime = "image/webp"; }
          } else if (_hvInnerType === "videoMessage") {
            _hvMediaLabel = "video";
            const ffmpeg   = require("fluent-ffmpeg");
            const ffPath   = require("@ffmpeg-installer/ffmpeg").path;
            const path     = require("path");
            const fs       = require("fs");
            ffmpeg.setFfmpegPath(ffPath);
            const _tmpIn  = path.join(process.cwd(), "data", `hvid_in_${Date.now()}.mp4`);
            const _tmpOut = path.join(process.cwd(), "data", `hvid_frame_${Date.now()}.jpg`);
            try {
              fs.writeFileSync(_tmpIn, _hvBuf);
              await new Promise((res, rej) => { ffmpeg(_tmpIn).seekInput(0).frames(1).output(_tmpOut).on("end", res).on("error", rej).run(); });
              const _frameBuf = fs.readFileSync(_tmpOut); _hvImgBase64 = _frameBuf.toString("base64"); _hvImgMime = "image/jpeg";
            } finally { try { fs.unlinkSync(_tmpIn); } catch {} try { fs.unlinkSync(_tmpOut); } catch {} }
          } else { _hvImgBase64 = _hvBuf.toString("base64"); _hvImgMime = _hvInner?.imageMessage?.mimetype || "image/jpeg"; }
          const _hvDataUri = `data:${_hvImgMime};base64,${_hvImgBase64}`;
          const _hvQuestion = args.slice("hehe".length).trim() || `Analyze this ${_hvMediaLabel} in full detail. Describe everything: people, objects, text, colors, emotions, context, setting, and any other notable detail. Be thorough and structured.`;
          let _hvAnswer = null;
          const _hvGroqKey   = process.env.GROQ_API_KEY;
          const _hvOpenaiKey = process.env.OPENAI_API_KEY;
          const _hvGeminiKey = process.env.GEMINI_API_KEY;
          const _hvXaiKey    = process.env.XAI_API_KEY;
          const persona = _AI_PERSONA || "You are a helpful AI assistant.";
          if (_hvGroqKey && !_hvAnswer) { try { const _r = await axios.post("https://api.groq.com/openai/v1/chat/completions", { model:"meta-llama/llama-4-scout-17b-16e-instruct", messages:[{role:"system",content:persona},{role:"user",content:[{type:"image_url",image_url:{url:_hvDataUri}},{type:"text",text:_hvQuestion}]}], max_tokens:1200, temperature:0.4 }, { headers:{Authorization:`Bearer ${_hvGroqKey}`,"Content-Type":"application/json"}, timeout:45000 }); _hvAnswer = _r.data?.choices?.[0]?.message?.content?.trim() || null; } catch {} }
          if (_hvXaiKey && !_hvAnswer) { try { const _r = await axios.post("https://api.x.ai/v1/chat/completions", { model:"grok-2-vision-1212", messages:[{role:"system",content:persona},{role:"user",content:[{type:"image_url",image_url:{url:_hvDataUri}},{type:"text",text:_hvQuestion}]}], max_tokens:1200, temperature:0.4 }, { headers:{Authorization:`Bearer ${_hvXaiKey}`,"Content-Type":"application/json"}, timeout:45000 }); _hvAnswer = _r.data?.choices?.[0]?.message?.content?.trim() || null; } catch {} }
          if (_hvOpenaiKey && !_hvAnswer) { try { const _r = await axios.post("https://api.openai.com/v1/chat/completions", { model:"gpt-4o", messages:[{role:"system",content:persona},{role:"user",content:[{type:"image_url",image_url:{url:_hvDataUri,detail:"high"}},{type:"text",text:_hvQuestion}]}], max_tokens:1200 }, { headers:{Authorization:`Bearer ${_hvOpenaiKey}`,"Content-Type":"application/json"}, timeout:45000 }); _hvAnswer = _r.data?.choices?.[0]?.message?.content?.trim() || null; } catch {} }
          if (_hvGeminiKey && !_hvAnswer) { try { const _r = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${_hvGeminiKey}`, { contents:[{parts:[{inline_data:{mime_type:_hvImgMime,data:_hvImgBase64}},{text:persona+"\n\n"+_hvQuestion}]}], generationConfig:{maxOutputTokens:1200,temperature:0.4} }, { headers:{"Content-Type":"application/json"}, timeout:45000 }); _hvAnswer = _r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null; } catch {} }
          if (!_hvAnswer) {
            try {
              const FormData = require("form-data");
              const _form = new FormData();
              _form.append("reqtype","fileupload"); _form.append("fileToUpload", _hvBuf, { filename:"media.jpg", contentType:_hvImgMime });
              const _cb = await axios.post("https://catbox.moe/user/api.php", _form, { headers:_form.getHeaders(), timeout:20000 });
              const _cbUrl = (_cb.data || "").trim();
              if (_cbUrl.startsWith("https://")) { const _fb = await axios.get(`https://apiskeith.top/ai/gpt4?q=${encodeURIComponent("Describe this "+_hvMediaLabel+" in full detail: "+_cbUrl)}`, { timeout:30000 }); _hvAnswer = _fb.data?.result || _fb.data?.message || _fb.data?.reply || null; }
            } catch {}
          }
          if (!_hvAnswer) throw new Error("All vision AI providers returned empty — add GROQ_API_KEY or OPENAI_API_KEY for best results");
          const _hvEmoji = { stickerMessage:"🎭", videoMessage:"🎥" }[_hvInnerType] || "🖼️";
          await sock.sendMessage(from, { text: `🤖👁 *AI Hehe — ${_hvEmoji} ${_hvMediaLabel.charAt(0).toUpperCase()+_hvMediaLabel.slice(1)} Analysis*\n${"─".repeat(30)}\n\n${_hvAnswer}` }, { quoted: msg });
        } catch (_hvErr) {
          console.error("[ai hehe] error:", _hvErr.message);
          await sock.sendMessage(from, { text: `❌ *AI Hehe failed:* ${_hvErr.message}` }, { quoted: msg });
        }
        return;
      }

      // ── Owner-only sub-commands below ─────────────────────────────────────
      if (!isOwner) {
        await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg });
        return;
      }

      // .chatbot global on/off
      if (_cbSub === "global") {
        if (_cbSub2 === "on" || _cbSub2 === "off") {
          settings.set("aiChatGlobal", _cbSub2 === "on");
          await sock.sendMessage(from, {
            text: `🌐 *AI Chatbot (Global)* is now *${_cbSub2.toUpperCase()}*\n\n` +
              (_cbSub2 === "on" ? "The bot will reply to *all messages in every chat* with the AI persona." : "The bot will only respond in chats where you explicitly turned it on."),
          }, { quoted: msg });
        } else {
          const _gCur = settings.get("aiChatGlobal") === true || settings.get("aiChatGlobal") === "on";
          await sock.sendMessage(from, {
            text: `🌐 *Global AI Chatbot:* *${_gCur ? "ON ✅" : "OFF ❌"}*\n\nUsage:\n\`${pfx}chatbot global on\`\n\`${pfx}chatbot global off\``,
          }, { quoted: msg });
        }
        return;
      }

      // .chatbot on/off
      if (_cbSub === "on" || _cbSub === "off") {
        const _turnOn = _cbSub === "on";
        if (_setChatbot) _setChatbot(from, _turnOn);
        else settings.set(`chatbot_${from}`, _turnOn);
        await sock.sendMessage(from, {
          text: `🤖 *AI Chatbot* is now *${_cbSub.toUpperCase()}* in this chat\n\n` +
            (_turnOn
              ? `I'll now reply to every message here using the AI persona.\n\n_Tip: Use_ \`${pfx}chatbot off\` _to disable anytime._`
              : `I'll stop replying to regular messages here.\n\n_Tip: Use_ \`${pfx}chatbot on\` _to re-enable._`),
        }, { quoted: msg });
        return;
      }

      // .chatbot — show status
      const _globalOn = settings.get("aiChatGlobal") === true || settings.get("aiChatGlobal") === "on";
      const _chatOn   = _isChatbotOn ? _isChatbotOn(from) : (settings.get(`chatbot_${from}`) === true);
      const _apiMode  = process.env.GROQ_API_KEY ? "Groq (Llama 4)" : process.env.OPENAI_API_KEY ? "OpenAI (GPT-4o)" : "Public API";
      await sock.sendMessage(from, {
        text:
          `🤖 *NEXUS AI Chatbot — Ignatius Perez Persona*\n\n` +
          `📍 This chat: *${_chatOn ? "ON ✅" : "OFF ❌"}*\n` +
          `🌐 Global mode: *${_globalOn ? "ON ✅" : "OFF ❌"}*\n` +
          `⚙️ AI Engine: *${_apiMode}*\n\n` +
          `*Commands:*\n\`${pfx}chatbot on\` — Enable in this chat\n\`${pfx}chatbot off\` — Disable in this chat\n` +
          `\`${pfx}chatbot global on\` — Enable in ALL chats\n\`${pfx}chatbot global off\` — Disable globally`,
      }, { quoted: msg });
    },
  },

  // ── .hehe / .vision / .see / .describe / .analyze ─────────────────────────
  {
    cmd: "hehe",
    aliases: ["vision", "see", "describe", "analyze"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, cmd,
              _AI_PERSONA, downloadMediaMessage, getContentType, normalizeMessageContent } = ctx;
      const _qMsg  = msg.quoted?.message || null;
      const _qType = _qMsg ? (getContentType(_qMsg) || Object.keys(_qMsg)[0]) : null;
      const _hasImg = _qType === "imageMessage" || !!_qMsg?.imageMessage || !!_qMsg?.viewOnceMessage?.message?.imageMessage || !!_qMsg?.viewOnceMessageV2?.message?.imageMessage;
      if (!_qMsg || !_hasImg) {
        await sock.sendMessage(from, {
          text: `🔍 *AI Image Analysis*\n\nReply to any image with \`${pfx}${cmd}\` to get a full AI analysis.\n\nOptionally add a question:\n\`${pfx}${cmd} what brand is this?\``,
        }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "🔍 Analysing image... please wait ⏳" }, { quoted: msg });
      try {
        const _visionInner = _qMsg?.viewOnceMessage?.message || _qMsg?.viewOnceMessageV2?.message || _qMsg;
        const _imgBuf      = await downloadMediaMessage({ key: msg.quoted.key, message: _visionInner }, "buffer", { reuploadRequest: sock.updateMediaMessage });
        const _imgBase64   = _imgBuf.toString("base64");
        const _imgMime     = _visionInner?.imageMessage?.mimetype || "image/jpeg";
        const _dataUri     = `data:${_imgMime};base64,${_imgBase64}`;
        const _question    = args.trim() || "Analyze this image in full detail. Describe everything you see: people, objects, text, colors, context, mood, setting, and any notable details. Be thorough and structured.";
        const persona      = _AI_PERSONA || "You are a helpful AI assistant.";
        let _visionAnswer  = null;
        const _groqKey     = process.env.GROQ_API_KEY;
        const _openaiKey   = process.env.OPENAI_API_KEY;
        const _geminiKey   = process.env.GEMINI_API_KEY;
        if (_groqKey) {
          try {
            const _gRes = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
              model: "meta-llama/llama-4-scout-17b-16e-instruct",
              messages: [{role:"system",content:persona},{role:"user",content:[{type:"image_url",image_url:{url:_dataUri}},{type:"text",text:_question}]}],
              max_tokens: 1024, temperature: 0.4,
            }, { headers:{Authorization:`Bearer ${_groqKey}`,"Content-Type":"application/json"}, timeout:45000 });
            _visionAnswer = _gRes.data?.choices?.[0]?.message?.content?.trim();
          } catch {}
        }
        if (!_visionAnswer && _openaiKey) {
          try {
            const _oRes = await axios.post("https://api.openai.com/v1/chat/completions", {
              model:"gpt-4o", messages:[{role:"system",content:persona},{role:"user",content:[{type:"image_url",image_url:{url:_dataUri,detail:"high"}},{type:"text",text:_question}]}], max_tokens:1024,
            }, { headers:{Authorization:`Bearer ${_openaiKey}`,"Content-Type":"application/json"}, timeout:45000 });
            _visionAnswer = _oRes.data?.choices?.[0]?.message?.content?.trim();
          } catch {}
        }
        if (!_visionAnswer && _geminiKey) {
          try {
            const _gemRes = await axios.post(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${_geminiKey}`, {
              contents:[{parts:[{inline_data:{mime_type:_imgMime,data:_imgBase64}},{text:persona+"\n\n"+_question}]}],
              generationConfig:{maxOutputTokens:1024,temperature:0.4},
            }, { headers:{"Content-Type":"application/json"}, timeout:45000 });
            _visionAnswer = _gemRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          } catch {}
        }
        if (!_visionAnswer) {
          const FormData = require("form-data");
          const _form = new FormData();
          _form.append("reqtype","fileupload"); _form.append("fileToUpload", _imgBuf, { filename:"img.jpg", contentType:_imgMime });
          const _cbRes = await axios.post("https://catbox.moe/user/api.php", _form, { headers:_form.getHeaders(), timeout:20000 });
          const _cbUrl = _cbRes.data?.trim();
          if (_cbUrl && _cbUrl.startsWith("https://")) {
            const _fallRes = await axios.get(`https://apiskeith.top/ai/gpt4?q=${encodeURIComponent("Analyze this image in detail (objects, text, context, colors, setting): "+_cbUrl)}`, { timeout:30000 });
            _visionAnswer = _fallRes.data?.result || _fallRes.data?.message || _fallRes.data?.reply;
          }
        }
        if (!_visionAnswer) throw new Error("All vision AI providers returned empty response");
        await sock.sendMessage(from, { text: `🔍 *AI Image Analysis*\n${"─".repeat(26)}\n\n${_visionAnswer}` }, { quoted: msg });
      } catch (_vErr) {
        console.error("[vision] error:", _vErr.message);
        await sock.sendMessage(from, {
          text: `❌ Vision AI failed: ${_vErr.message}\n\nTip: Set \`GROQ_API_KEY\`, \`OPENAI_API_KEY\`, or \`GEMINI_API_KEY\` for the best results.`,
        }, { quoted: msg });
      }
    },
  },

  // ── .data / .bundles / .packages ──────────────────────────────────────────
  {
    cmd: "data",
    aliases: ["bundles", "packages"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, isOwner, dataPkgs, _pendingOrders } = ctx;
      const _BINGWA_URL = process.env.BINGWA_URL || "https://bingwa-sigma.vercel.app";
      const _subArg  = args.trim().toLowerCase();
      const _subParts = _subArg.split(/\s+/);
      const _sub     = _subParts[0];
      const _subCode = _subParts.slice(1).join(" ").trim();

      // .data buy <code>
      if (_sub === "buy" || _sub === "order") {
        const _buyCode = _subCode || _subParts[1] || "";
        if (!_buyCode) {
          await sock.sendMessage(from, {
            text: `🛒 *Usage:* \`.data buy <package-code>\`\n\n> Example: \`.data buy SAF-D3\`\n\nType \`.data\` to see all packages with their codes.`,
          }, { quoted: msg });
          return;
        }
        if (!dataPkgs) { await sock.sendMessage(from, { text: "❌ Data packages module not available." }, { quoted: msg }); return; }
        const _pkg = dataPkgs.getPackageByCode(_buyCode);
        if (!_pkg) {
          await sock.sendMessage(from, {
            text: `❌ Package code *${_buyCode.toUpperCase()}* not found.\n\nType \`.data\` to see available packages and their codes.`,
          }, { quoted: msg });
          return;
        }
        if (_pendingOrders) _pendingOrders.set(from, { pkg: _pkg, step: "phone" });
        const _catI = dataPkgs.CATEGORY_ICONS ? (dataPkgs.CATEGORY_ICONS[_pkg.category] || { icon: "📦", label: _pkg.category.toUpperCase() }) : { icon: "📦", label: _pkg.category.toUpperCase() };
        await sock.sendMessage(from, {
          text:
            `${_catI.icon} *${_pkg.name}* — *KES ${_pkg.price.toLocaleString()}*\n` +
            `⏱ Validity: ${_pkg.validity}\n\n` +
            `📱 Enter the *Safaricom number* to receive this bundle:\n_(format: 07XXXXXXXX or 254XXXXXXXXX)_\n\nReply *CANCEL* to abort.`,
        }, { quoted: msg });
        return;
      }

      // .data reset
      if (_sub === "reset") {
        if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
        if (dataPkgs) dataPkgs.resetToDefault();
        await sock.sendMessage(from, { text: "✅ Data packages reset to defaults." }, { quoted: msg });
        return;
      }

      // .data addpkg
      if (_sub === "addpkg" || _sub === "add") {
        if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
        const _ap = _subParts.slice(1);
        if (_ap.length < 6) {
          await sock.sendMessage(from, {
            text: `📦 *Add Package Usage:*\n\`.data addpkg safaricom <category> <code> <data> <price> <validity>\`\n\nExample:\n\`.data addpkg safaricom bingwaData BWA-7 10GB 1000 30Days\``,
          }, { quoted: msg });
          return;
        }
        const [_apProv, _apCat, _apCode, _apData, _apPrice, ..._apVal] = _ap;
        const _newPkg = { code: _apCode.toUpperCase(), name: _apData, price: parseInt(_apPrice, 10) || 0, validity: _apVal.join(" "), label: `${_apData} ${_apCat}` };
        if (dataPkgs) dataPkgs.addPackage(_apProv.toLowerCase(), _apCat.toLowerCase(), _newPkg);
        await sock.sendMessage(from, { text: `✅ Package *${_newPkg.code}* added:\n📦 ${_newPkg.name} — Ksh ${_newPkg.price.toLocaleString()} — ${_newPkg.validity}` }, { quoted: msg });
        return;
      }

      // .data delpkg
      if (_sub === "delpkg" || _sub === "del" || _sub === "remove") {
        if (!isOwner) { await sock.sendMessage(from, { text: "❌ Owner-only command." }, { quoted: msg }); return; }
        const _delCode = _subParts[1] || "";
        if (!_delCode) { await sock.sendMessage(from, { text: `Usage: \`.data delpkg <code>\`` }, { quoted: msg }); return; }
        const _removed = dataPkgs ? dataPkgs.removePackage(_delCode) : false;
        await sock.sendMessage(from, {
          text: _removed ? `✅ Package *${_delCode.toUpperCase()}* removed.` : `❌ Package *${_delCode.toUpperCase()}* not found.`,
        }, { quoted: msg });
        return;
      }

      // .data <provider>
      if (dataPkgs) {
        const _providers = Object.keys(dataPkgs.PROVIDERS || {});
        const _matchedProv = _providers.find(p =>
          p.startsWith(_sub) ||
          dataPkgs.PROVIDERS[p].short === _sub ||
          dataPkgs.PROVIDERS[p].full?.toLowerCase() === _sub
        );
        if (_matchedProv && _sub) {
          const _menu = dataPkgs.buildProviderMenu(_matchedProv, _BINGWA_URL);
          await sock.sendMessage(from, { text: _menu }, { quoted: msg });
          return;
        }
        const _allMenu = dataPkgs.buildAllMenu(_BINGWA_URL);
        await sock.sendMessage(from, { text: _allMenu }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: "❌ Data packages module not available." }, { quoted: msg });
      }
    },
  },

];
