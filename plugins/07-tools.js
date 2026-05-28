"use strict";
// ── Utility / tool commands ───────────────────────────────────────────────────
// qr, define, translate, currency, percentage, base64, morse, binary,
// bmi, age, color, short, vcard, hash, uuid, tempconv, tts, text-art effects

const axios = require("axios");

module.exports = [

  // ── .qr ────────────────────────────────────────────────────────────────────
  {
    cmd: "qr",
    aliases: ["qrcode"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _qrText = args.trim() || (msg.quoted?.body) || "";
      if (!_qrText) { await sock.sendMessage(from, { text: `📷 *QR Code Generator*\n\nUsage: \`${pfx}qr https://example.com\`\nOr reply to any text message.` }, { quoted: msg }); return; }
      try {
        const _qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&ecc=H&data=${encodeURIComponent(_qrText)}`;
        const _qrBuf = Buffer.from((await axios.get(_qrUrl, { responseType: "arraybuffer", timeout: 10000 })).data);
        await sock.sendMessage(from, {
          image: _qrBuf, caption: `📷 *QR Code*\n\nContent: ${_qrText.length > 80 ? _qrText.slice(0, 80) + "…" : _qrText}`,
        }, { quoted: msg });
      } catch { await sock.sendMessage(from, { text: `❌ Failed to generate QR code. Try again.` }, { quoted: msg }); }
    },
  },

  // ── .define / .dict ────────────────────────────────────────────────────────
  {
    cmd: "define",
    aliases: ["dict", "dictionary"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _word = args.trim().split(" ")[0].toLowerCase();
      if (!_word) { await sock.sendMessage(from, { text: `📖 *Dictionary*\n\nUsage: \`${pfx}define serendipity\`` }, { quoted: msg }); return; }
      try {
        const _dictRes = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(_word)}`, { timeout: 8000 });
        const _entry   = _dictRes.data[0];
        const _phonetic = _entry.phonetics?.find(p => p.text)?.text || "";
        let _defText = `📖 *${_entry.word}*`;
        if (_phonetic) _defText += `  /${_phonetic}/`;
        _defText += "\n" + "─".repeat(30) + "\n";
        const _shown = new Set();
        let _count = 0;
        for (const meaning of _entry.meanings) {
          if (_count >= 4) break;
          const pos = meaning.partOfSpeech;
          if (_shown.has(pos)) continue;
          _shown.add(pos);
          _defText += `\n*${pos}*\n`;
          meaning.definitions.slice(0, 2).forEach((d, i) => {
            _defText += `${i + 1}. ${d.definition}\n`;
            if (d.example) _defText += `   _"${d.example}"_\n`;
          });
          _count++;
        }
        const _synonyms = _entry.meanings.flatMap(m => m.synonyms || []).slice(0, 5).join(", ");
        if (_synonyms) _defText += `\n🔗 Synonyms: ${_synonyms}`;
        await sock.sendMessage(from, { text: _defText.trim() }, { quoted: msg });
      } catch { await sock.sendMessage(from, { text: `❌ No definition found for *${_word}*. Check the spelling.` }, { quoted: msg }); }
    },
  },

  // ── .translate ─────────────────────────────────────────────────────────────
  {
    cmd: "translate",
    aliases: ["tr", "trans"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _trParts = args.trim().split(/\s+/);
      if (_trParts.length < 2) {
        await sock.sendMessage(from, {
          text: `🌐 *Translator*\n\nUsage: \`${pfx}translate [lang] [text]\`\n\nExamples:\n• \`${pfx}translate fr Hello world\`\n• \`${pfx}translate sw Good morning\`\n\nCommon codes: en, fr, es, de, ar, sw, zu, yo, ig, ha, pt, zh`,
        }, { quoted: msg });
        return;
      }
      const _toLang = _trParts[0].toLowerCase();
      const _trText = _trParts.slice(1).join(" ");
      try {
        const _trRes  = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(_trText)}&langpair=en|${_toLang}`, { timeout: 10000 });
        const _trData = _trRes.data;
        if (_trData.responseStatus !== 200 && _trData.responseStatus !== "200") throw new Error("bad status");
        const _translated = _trData.responseData?.translatedText;
        if (!_translated || _translated === _trText) throw new Error("no translation");
        await sock.sendMessage(from, {
          text: `🌐 *Translation* (en → ${_toLang.toUpperCase()})\n\n📥 _${_trText}_\n\n📤 *${_translated}*`,
        }, { quoted: msg });
      } catch { await sock.sendMessage(from, { text: `❌ Translation failed. Check the language code or try again.\n\nCommon codes: en, fr, es, de, ar, sw, zu, yo, ig, ha, pt, zh` }, { quoted: msg }); }
    },
  },

  // ── .currency ──────────────────────────────────────────────────────────────
  {
    cmd: "currency",
    aliases: ["convert", "fx"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _cParts = (args || "").trim().split(/\s+/);
      if (_cParts.length < 3 || isNaN(_cParts[0])) {
        await sock.sendMessage(from, {
          text: `💱 *Currency Converter*\n\nUsage: \`${pfx}currency <amount> <FROM> <TO>\`\n\nExamples:\n• \`${pfx}currency 100 USD KES\`\n• \`${pfx}currency 50 EUR GBP\``,
        }, { quoted: msg });
        return;
      }
      const _amt  = parseFloat(_cParts[0]);
      const _from = _cParts[1].toUpperCase();
      const _to   = _cParts[2].toUpperCase();
      try {
        await sock.sendMessage(from, { text: `💱 Converting ${_amt} ${_from} → ${_to}...` }, { quoted: msg });
        const _fxRes = await axios.get(`https://api.exchangerate-api.com/v4/latest/${_from}`, { timeout: 10000 });
        const _rate  = _fxRes.data?.rates?.[_to];
        if (!_rate) throw new Error(`Unknown currency pair: ${_from}/${_to}`);
        const _result  = (_amt * _rate).toFixed(4);
        const _rateStr = _rate.toFixed(6);
        await sock.sendMessage(from, {
          text:
            `╔══════════════════════╗\n║ 💱 *CURRENCY CONVERTER*\n╚══════════════════════╝\n\n` +
            `💵 *Amount:* ${_amt} ${_from}\n🔄 *Rate:* 1 ${_from} = ${_rateStr} ${_to}\n` +
            `💰 *Result:* *${_result} ${_to}*\n\n_Powered by ExchangeRate-API_`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Could not convert: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .percentage ────────────────────────────────────────────────────────────
  {
    cmd: "percentage",
    aliases: ["pct", "percent"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      if (!(args || "").trim()) {
        await sock.sendMessage(from, {
          text: `🔢 *Percentage Calculator*\n\nUsage:\n• \`${pfx}percentage 25 of 200\`\n• \`${pfx}percentage 50 out of 200\`\n• \`${pfx}percentage increase 100 to 150\``,
        }, { quoted: msg });
        return;
      }
      try {
        let _pResult = "";
        const _fullArg = args.trim().toLowerCase();
        if (_fullArg.includes("increase") || _fullArg.includes("decrease")) {
          const _nums = _fullArg.match(/[\d.]+/g)?.map(Number);
          if (_nums?.length >= 2) {
            const _diff = _nums[1] - _nums[0];
            const _chng = ((_diff / _nums[0]) * 100).toFixed(2);
            _pResult = `📊 From ${_nums[0]} to ${_nums[1]}: *${Number(_chng) >= 0 ? "+" : ""}${_chng}%* ${Number(_chng) >= 0 ? "increase 📈" : "decrease 📉"}`;
          }
        } else if (_fullArg.includes("of")) {
          const _nums = _fullArg.match(/[\d.]+/g)?.map(Number);
          if (_nums?.length >= 2) _pResult = `📊 ${_nums[0]}% of ${_nums[1]} = *${(_nums[0] / 100 * _nums[1]).toFixed(2)}*`;
        } else if (_fullArg.includes("out of")) {
          const _nums = _fullArg.match(/[\d.]+/g)?.map(Number);
          if (_nums?.length >= 2) _pResult = `📊 ${_nums[0]} out of ${_nums[1]} = *${(_nums[0] / _nums[1] * 100).toFixed(2)}%*`;
        } else {
          const _nums = _fullArg.match(/[\d.]+/g)?.map(Number);
          if (_nums?.length >= 2) _pResult = `📊 ${_nums[0]}% of ${_nums[1]} = *${(_nums[0] / 100 * _nums[1]).toFixed(2)}*`;
        }
        if (!_pResult) throw new Error("Could not parse input");
        await sock.sendMessage(from, { text: `🔢 *Percentage Calculator*\n\n${_pResult}` }, { quoted: msg });
      } catch { await sock.sendMessage(from, { text: `❌ Invalid input. Try: \`${pfx}percentage 25 of 200\`` }, { quoted: msg }); }
    },
  },

  // ── .base64 ────────────────────────────────────────────────────────────────
  {
    cmd: "base64",
    aliases: ["b64"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      if (!args.trim()) {
        await sock.sendMessage(from, { text: `🔑 *Base64 Tool*\n\nUsage:\n• \`${pfx}base64 encode Hello World\`\n• \`${pfx}base64 decode SGVsbG8gV29ybGQ=\`` }, { quoted: msg });
        return;
      }
      const _b64Parts = args.trim().split(/\s+/);
      const _b64Sub   = _b64Parts[0].toLowerCase();
      const _b64Val   = _b64Parts.slice(1).join(" ");
      if (_b64Sub === "encode" && _b64Val) {
        const _encoded = Buffer.from(_b64Val).toString("base64");
        await sock.sendMessage(from, { text: `🔑 *Base64 Encode*\n\n*Input:* ${_b64Val}\n*Output:* \`${_encoded}\`` }, { quoted: msg });
      } else if (_b64Sub === "decode" && _b64Val) {
        try {
          const _decoded = Buffer.from(_b64Val, "base64").toString("utf8");
          await sock.sendMessage(from, { text: `🔑 *Base64 Decode*\n\n*Input:* \`${_b64Val}\`\n*Output:* ${_decoded}` }, { quoted: msg });
        } catch { await sock.sendMessage(from, { text: `❌ Invalid base64 string.` }, { quoted: msg }); }
      } else {
        const _b64Auto = /^[A-Za-z0-9+/]+=*$/.test(args.trim()) && args.trim().length % 4 === 0;
        if (_b64Auto) {
          try {
            const _decoded = Buffer.from(args.trim(), "base64").toString("utf8");
            await sock.sendMessage(from, { text: `🔑 *Base64 → Auto-decoded*\n\n*Input:* \`${args.trim()}\`\n*Output:* ${_decoded}` }, { quoted: msg });
          } catch { await sock.sendMessage(from, { text: `🔑 Base64 Encode:\n\`${Buffer.from(args.trim()).toString("base64")}\`` }, { quoted: msg }); }
        } else {
          const _enc = Buffer.from(args.trim()).toString("base64");
          await sock.sendMessage(from, { text: `🔑 *Base64 Encode*\n\n*Input:* ${args.trim()}\n*Output:* \`${_enc}\`` }, { quoted: msg });
        }
      }
    },
  },

  // ── .morse ─────────────────────────────────────────────────────────────────
  {
    cmd: "morse",
    aliases: ["morsecode"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _MORSE_MAP = { A:".-",B:"-...",C:"-.-.",D:"-..",E:".",F:"..-.",G:"--.",H:"....",I:"..",J:".---",K:"-.-",L:".-..",M:"--",N:"-.",O:"---",P:".--.",Q:"--.-",R:".-.",S:"...",T:"-",U:"..-",V:"...-",W:".--",X:"-..-",Y:"-.--",Z:"--..", "0":"-----","1":".----","2":"..---","3":"...--","4":"....-","5":".....","6":"-....","7":"--...","8":"---..","9":"----." };
      const _REV_MORSE = Object.fromEntries(Object.entries(_MORSE_MAP).map(([k,v]) => [v,k]));
      if (!args.trim()) { await sock.sendMessage(from, { text: `📡 *Morse Code*\n\nUsage:\n• \`${pfx}morse Hello World\` — encode text\n• \`${pfx}morse .... . .-.. .-.. ---\` — decode morse` }, { quoted: msg }); return; }
      const _isMorse = /^[.\- /]+$/.test(args.trim());
      if (_isMorse) {
        const _decoded = args.trim().split(" / ").map(word => word.split(" ").map(c => _REV_MORSE[c] || "?").join("")).join(" ");
        await sock.sendMessage(from, { text: `📡 *Morse → Text*\n\n*Input:* \`${args.trim()}\`\n*Output:* ${_decoded}` }, { quoted: msg });
      } else {
        const _encoded = args.toUpperCase().split(" ").map(word => word.split("").map(c => _MORSE_MAP[c] || "?").join(" ")).join(" / ");
        await sock.sendMessage(from, { text: `📡 *Text → Morse*\n\n*Input:* ${args.trim()}\n*Output:* \`${_encoded}\`` }, { quoted: msg });
      }
    },
  },

  // ── .binary ────────────────────────────────────────────────────────────────
  {
    cmd: "binary",
    aliases: ["bin", "bin2text", "text2bin"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _binInput = (args || "").trim();
      if (!_binInput) { await sock.sendMessage(from, { text: `💻 *Binary Converter*\n\nUsage:\n• \`${pfx}binary Hello\` → text to binary\n• \`${pfx}binary 01001000 01101001\` → binary to text` }, { quoted: msg }); return; }
      try {
        const _isBinary = /^[01\s]+$/.test(_binInput) && _binInput.includes(" ");
        if (_isBinary) {
          const _decoded = _binInput.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join("");
          await sock.sendMessage(from, {
            text:
`╔══〔 🔢 𝗕𝗜𝗡𝗔𝗥𝗬 𝗗𝗘𝗖𝗢𝗗𝗘𝗥 〕══════╗
╚═══════════════════════════════╝

📥 *Binary Input:*
\`${_binInput.slice(0,120)}${_binInput.length > 120 ? "…" : ""}\`

📤 *Decoded Text:*
*${_decoded}*

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 Hacker Mode_`,
          }, { quoted: msg });
        } else {
          const _encoded = _binInput.split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
          await sock.sendMessage(from, {
            text:
`╔══〔 🔢 𝗕𝗜𝗡𝗔𝗥𝗬 𝗘𝗡𝗖𝗢𝗗𝗘𝗥 〕══════╗
╚═══════════════════════════════╝

📥 *Text Input:*  *${_binInput.slice(0, 50)}${_binInput.length > 50 ? "…" : ""}*

📤 *Binary Output:*
\`${_encoded.slice(0, 300)}${_encoded.length > 300 ? "…" : ""}\`

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 Hacker Mode_`,
          }, { quoted: msg });
        }
      } catch (e) { await sock.sendMessage(from, { text: `❌ Binary conversion error: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .bmi ───────────────────────────────────────────────────────────────────
  {
    cmd: "bmi",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _parts = args.trim().split(/\s+/);
      if (_parts.length < 2 || isNaN(_parts[0]) || isNaN(_parts[1])) { await sock.sendMessage(from, { text: `⚖️ *BMI Calculator*\n\nUsage: \`${pfx}bmi <weight_kg> <height_cm>\`\n\nExample: \`${pfx}bmi 70 175\`` }, { quoted: msg }); return; }
      const _w = parseFloat(_parts[0]);
      const _h = parseFloat(_parts[1]) / 100;
      const _bmi = (_w / (_h * _h)).toFixed(1);
      let _cat;
      if (_bmi < 18.5) _cat = "⚠️ Underweight"; else if (_bmi < 25) _cat = "✅ Normal weight"; else if (_bmi < 30) _cat = "⚠️ Overweight"; else _cat = "❌ Obese";
      await sock.sendMessage(from, {
        text:
          `╔══════════════════════╗\n║ ⚖️ *BMI CALCULATOR*\n╚══════════════════════╝\n\n` +
          `⚖️ *Weight:* ${_w} kg\n📏 *Height:* ${(_h * 100)} cm\n🔢 *BMI:* ${_bmi}\n📊 *Category:* ${_cat}\n\n` +
          `_Scale: <18.5 Underweight | 18.5-24.9 Normal | 25-29.9 Overweight | ≥30 Obese_`,
      }, { quoted: msg });
    },
  },

  // ── .age ───────────────────────────────────────────────────────────────────
  {
    cmd: "age",
    aliases: ["birthday"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      if (!args.trim()) { await sock.sendMessage(from, { text: `🎂 *Age Calculator*\n\nUsage: \`${pfx}age DD/MM/YYYY\`\n\nExample: \`${pfx}age 15/03/1999\`` }, { quoted: msg }); return; }
      try {
        const [_dd, _mm, _yyyy] = args.trim().split(/[\/\-\.]/).map(Number);
        const _bday = new Date(_yyyy, _mm - 1, _dd);
        if (isNaN(_bday.getTime()) || _bday > new Date()) throw new Error("Invalid date");
        const _now = new Date();
        let _ageY = _now.getFullYear() - _bday.getFullYear();
        let _ageM = _now.getMonth() - _bday.getMonth();
        let _ageD = _now.getDate() - _bday.getDate();
        if (_ageD < 0) { _ageM--; _ageD += new Date(_now.getFullYear(), _now.getMonth(), 0).getDate(); }
        if (_ageM < 0) { _ageY--; _ageM += 12; }
        const _nextBday = new Date(_now.getFullYear(), _mm - 1, _dd);
        if (_nextBday < _now) _nextBday.setFullYear(_now.getFullYear() + 1);
        const _daysLeft = Math.ceil((_nextBday - _now) / 86400000);
        await sock.sendMessage(from, {
          text:
            `╔══════════════════════╗\n║ 🎂 *AGE CALCULATOR*\n╚══════════════════════╝\n\n` +
            `📅 *Birthday:* ${_dd}/${_mm}/${_yyyy}\n🎉 *Age:* ${_ageY} years, ${_ageM} months, ${_ageD} days\n` +
            `🎈 *Next Birthday:* in ${_daysLeft} day${_daysLeft !== 1 ? "s" : ""}`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Invalid date. Use: \`${pfx}age DD/MM/YYYY\`\nExample: \`${pfx}age 15/03/1999\`` }, { quoted: msg }); }
    },
  },

  // ── .color ─────────────────────────────────────────────────────────────────
  {
    cmd: "color",
    aliases: ["colour", "hex"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _raw = (args || "").trim().replace(/^#/, "");
      if (!_raw || !/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(_raw)) { await sock.sendMessage(from, { text: `🎨 *Color Inspector*\n\nUsage: \`${pfx}color #FF5733\`\n\nExample: \`${pfx}color 1A73E8\`` }, { quoted: msg }); return; }
      const _full = _raw.length === 3 ? _raw.split("").map(c => c + c).join("") : _raw;
      const _r = parseInt(_full.slice(0,2),16), _g = parseInt(_full.slice(2,4),16), _b = parseInt(_full.slice(4,6),16);
      const _max = Math.max(_r,_g,_b), _min = Math.min(_r,_g,_b), _d = _max - _min;
      let _h = 0;
      if (_d) {
        if (_max === _r) _h = ((_g - _b) / _d) % 6;
        else if (_max === _g) _h = (_b - _r) / _d + 2;
        else _h = (_r - _g) / _d + 4;
        _h = Math.round(_h * 60); if (_h < 0) _h += 360;
      }
      const _s = _max ? Math.round(_d / _max * 100) : 0;
      const _v = Math.round(_max / 255 * 100);
      await sock.sendMessage(from, {
        text:
          `╔══════════════════════╗\n║ 🎨 *COLOR INSPECTOR*\n╚══════════════════════╝\n\n` +
          `🔷 *HEX:* #${_full.toUpperCase()}\n🟥 *RGB:* rgb(${_r}, ${_g}, ${_b})\n` +
          `🎛️ *HSV:* hsv(${_h}°, ${_s}%, ${_v}%)\n\n_Preview: https://www.colorhexa.com/${_full}_`,
      }, { quoted: msg });
    },
  },

  // ── .short / .shorten ──────────────────────────────────────────────────────
  {
    cmd: "short",
    aliases: ["shorten", "shrink"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _url = (args || "").trim();
      if (!_url || !/^https?:\/\//i.test(_url)) { await sock.sendMessage(from, { text: `🔗 *URL Shortener*\n\nUsage: \`${pfx}short https://your-long-url.com\`` }, { quoted: msg }); return; }
      try {
        const _shrinkRes = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(_url)}`, { timeout: 10000 });
        const _short = _shrinkRes.data?.trim();
        if (!_short || !_short.startsWith("http")) throw new Error("Shortening failed");
        await sock.sendMessage(from, { text: `🔗 *URL Shortener*\n\n📎 *Original:* ${_url}\n✂️ *Short URL:* ${_short}` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Could not shorten URL: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .vcard ─────────────────────────────────────────────────────────────────
  {
    cmd: "vcard",
    aliases: ["contact"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _vcParts = (args || "").trim().split("|").map(s => s.trim());
      const _vcName  = _vcParts[0] || "";
      const _vcPhone = (_vcParts[1] || "").replace(/\D/g, "");
      if (!_vcName || !_vcPhone) {
        await sock.sendMessage(from, { text: `📇 *vCard Generator*\n\nUsage: \`${pfx}vcard Name | PhoneNumber\`\n\nExample: \`${pfx}vcard John Doe | 254700123456\`` }, { quoted: msg });
        return;
      }
      const _vcData = `BEGIN:VCARD\nVERSION:3.0\nFN:${_vcName}\nTEL;TYPE=CELL:+${_vcPhone}\nEND:VCARD`;
      await sock.sendMessage(from, { contacts: { displayName: _vcName, contacts: [{ vcard: _vcData }] } }, { quoted: msg });
    },
  },

  // ── .hash ──────────────────────────────────────────────────────────────────
  {
    cmd: "hash",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _hashParts = (args || "").trim().split(/\s+/);
      const _hashAlgos = ["md5","sha1","sha256","sha512"];
      let _hashAlgo, _hashInput;
      if (_hashAlgos.includes(_hashParts[0]?.toLowerCase())) {
        _hashAlgo  = _hashParts[0].toLowerCase();
        _hashInput = _hashParts.slice(1).join(" ").trim();
      } else {
        _hashAlgo  = "sha256";
        _hashInput = _hashParts.join(" ").trim();
      }
      if (!_hashInput) { await sock.sendMessage(from, { text: `🔐 *Hash Generator*\n\nUsage: \`${pfx}hash [algo] <text>\`\nAlgorithms: md5 · sha1 · sha256 · sha512\n\nExample: \`${pfx}hash sha256 hello world\`` }, { quoted: msg }); return; }
      try {
        const _crypto3 = require("crypto");
        const _md5  = _crypto3.createHash("md5").update(_hashInput).digest("hex");
        const _sha1 = _crypto3.createHash("sha1").update(_hashInput).digest("hex");
        const _s256 = _crypto3.createHash("sha256").update(_hashInput).digest("hex");
        const _s512 = _crypto3.createHash("sha512").update(_hashInput).digest("hex");
        await sock.sendMessage(from, {
          text:
`╔══〔 🔐 𝗛𝗔𝗦𝗛 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗢𝗥 〕══════╗
   Input: _"${_hashInput.slice(0, 40)}${_hashInput.length > 40 ? "…" : ""}"_
╚═══════════════════════════════╝

📦 *MD5*
\`${_md5}\`

🔑 *SHA-1*
\`${_sha1}\`

🛡️ *SHA-256*
\`${_s256}\`

🔒 *SHA-512*
\`${_s512.slice(0, 64)}\`
\`${_s512.slice(64)}\`

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 Crypto Engine_`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Hash error: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .uuid ──────────────────────────────────────────────────────────────────
  {
    cmd: "uuid",
    aliases: ["guid"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _crypto4 = require("crypto");
      const _mkUUID  = () => {
        const h = _crypto4.randomBytes(16);
        h[6] = (h[6] & 0x0f) | 0x40;
        h[8] = (h[8] & 0x3f) | 0x80;
        return [...h].map((b, i) => ([4,6,8,10].includes(i) ? "-" : "") + b.toString(16).padStart(2,"0")).join("");
      };
      const _uuids = Array.from({ length: 5 }, _mkUUID);
      await sock.sendMessage(from, {
        text:
`╔══〔 🔑 𝗨𝗨𝗜𝗗 𝗚𝗘𝗡𝗘𝗥𝗔𝗧𝗢𝗥 〕═════╗
   5× Cryptographically Random UUIDs
╚═══════════════════════════════╝

${_uuids.map((u, i) => `\`${i+1}. ${u}\``).join("\n")}

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 · RFC 4122 v4 UUID_`,
      }, { quoted: msg });
    },
  },

  // ── .tempconv ──────────────────────────────────────────────────────────────
  {
    cmd: "tempconv",
    aliases: ["temp", "celsius", "fahrenheit"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _tParts = (args || "").trim().split(/\s+/);
      const _tVal   = parseFloat(_tParts[0]);
      const _tUnit  = (_tParts[1] || "").toUpperCase();
      if (isNaN(_tVal) || !["C","F","K"].includes(_tUnit)) {
        await sock.sendMessage(from, { text: `🌡️ *Temperature Converter*\n\nUsage: \`${pfx}tempconv <value> <C|F|K>\`\n\nExamples:\n• \`${pfx}tempconv 100 C\`\n• \`${pfx}tempconv 212 F\`\n• \`${pfx}tempconv 373 K\`` }, { quoted: msg });
        return;
      }
      let _toC, _toF, _toK;
      if (_tUnit === "C") { _toC = _tVal; _toF = _tVal * 9/5 + 32; _toK = _tVal + 273.15; }
      else if (_tUnit === "F") { _toC = (_tVal - 32) * 5/9; _toF = _tVal; _toK = (_tVal + 459.67) * 5/9; }
      else { _toC = _tVal - 273.15; _toF = _tVal * 9/5 - 459.67; _toK = _tVal; }
      const _feel = _toC < 0 ? "🥶 Freezing" : _toC < 10 ? "❄️ Very Cold" : _toC < 20 ? "🌬️ Cool" : _toC < 28 ? "☀️ Comfortable" : _toC < 36 ? "🌤️ Warm" : _toC < 45 ? "🔥 Hot" : "💀 Extreme Heat";
      await sock.sendMessage(from, {
        text:
`╔══〔 🌡️ 𝗧𝗘𝗠𝗣 𝗖𝗢𝗡𝗩𝗘𝗥𝗧𝗘𝗥 〕═════╗
╚═══════════════════════════════╝

🔢 *Input:*   ${_tVal}°${_tUnit}

🌡️ *Celsius:*     ${_toC.toFixed(2)}°C
⚗️ *Fahrenheit:*  ${_toF.toFixed(2)}°F
⚛️ *Kelvin:*      ${_toK.toFixed(2)} K

🎯 *Feels like:* ${_feel}

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 Unit Converter_`,
      }, { quoted: msg });
    },
  },

  // ── .tts ───────────────────────────────────────────────────────────────────
  {
    cmd: "tts",
    aliases: ["speak", "voice"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const text = args.trim() || msg.quoted?.body || "";
      if (!text) { await sock.sendMessage(from, { text: `🔊 *Text to Speech*\n\nUsage: \`${pfx}tts <text>\`\nOr reply to a message.` }, { quoted: msg }); return; }
      try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;
        const buf = Buffer.from((await axios.get(url, { responseType: "arraybuffer", timeout: 15000, headers: { "User-Agent": "Mozilla/5.0" } })).data);
        await sock.sendMessage(from, { audio: buf, mimetype: "audio/mpeg", ptt: true }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ TTS failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── Text-art effects ───────────────────────────────────────────────────────
  {
    cmd: "typography",
    aliases: ["purple", "thunder", "leaves", "sand", "snow", "impressive", "ice"],
    async run(ctx) {
      const { sock, msg, from, args, pfx, cmd } = ctx;
      const _textArtMap = {
        typography: "https://en.ephoto360.com/create-typography-text-effect-on-pavement-online-774.html",
        purple:     "https://en.ephoto360.com/purple-text-effect-online-100.html",
        thunder:    "https://en.ephoto360.com/thunder-text-effect-online-97.html",
        leaves:     "https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html",
        sand:       "https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html",
        snow:       "https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html",
        impressive: "https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html",
        ice:        "https://en.ephoto360.com/ice-text-effect-online-101.html",
      };
      const _taText = args.trim();
      if (!_taText) {
        await sock.sendMessage(from, { text: `🎨 Usage: \`${pfx}${cmd} <your text>\`\nExample: \`${pfx}${cmd} NEXUS-MD\`` }, { quoted: msg });
        return;
      }
      await sock.sendMessage(from, { text: "🎨 *Wait a moment...*" }, { quoted: msg });
      try {
        const _mumaker = require("mumaker");
        const _taRes   = await _mumaker.ephoto(_textArtMap[cmd], _taText);
        await sock.sendMessage(from, { image: { url: _taRes.image }, caption: `ᘜᗴᑎᗴᖇᗩTᗴᗪ ᗷY ᑎᗴ᙭ᑌՏ ᗰᗪ` }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Text-art effect failed: ${e.message}` }, { quoted: msg }); }
    },
  },

];
