"use strict";
// ── Fun & games commands ──────────────────────────────────────────────────────
// joke, fact, 8ball, flip, dice, truth, dare, wyr, compliment, roast,
// ship, catfact, dogfact, urban, pickupline, numberfact, calc, trivia, rps, gpass

const axios = require("axios");

module.exports = [

  // ── .joke ──────────────────────────────────────────────────────────────────
  {
    cmd: "joke",
    aliases: ["dadjoke", "funfact2", "techjoke", "devjoke"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        const _jRes = await axios.get(
          "https://v2.jokeapi.dev/joke/Programming,Miscellaneous?blacklistFlags=nsfw,racist,sexist&type=twopart,single",
          { timeout: 10000 }
        );
        const _j = _jRes.data;
        let _jokeText;
        if (_j.type === "twopart") {
          _jokeText =
`╔══〔 😂 𝗗𝗘𝗩 𝗝𝗢𝗞𝗘𝗦 〕════════════╗
╚═══════════════════════════════╝

❓ ${_j.setup}

💡 ${_j.delivery}

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 Humour Module_`;
        } else {
          _jokeText =
`╔══〔 😂 𝗗𝗘𝗩 𝗝𝗢𝗞𝗘𝗦 〕════════════╗
╚═══════════════════════════════╝

💡 ${_j.joke}

_⚡ 𝗡𝗘𝗫𝗨𝗦-𝗠𝗗 Humour Module_`;
        }
        await sock.sendMessage(from, { text: _jokeText }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Joke fetch failed: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .fact ──────────────────────────────────────────────────────────────────
  {
    cmd: "fact",
    aliases: ["funfact", "didyouknow"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        const _fRes = await axios.get("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en", { timeout: 8000 });
        await sock.sendMessage(from, { text: `🧠 *Did You Know?*\n\n${_fRes.data.text}\n\n_Source: uselessfacts.jsph.pl_` }, { quoted: msg });
      } catch { await sock.sendMessage(from, { text: `❌ Couldn't fetch a fact right now. Try again!` }, { quoted: msg }); }
    },
  },

  // ── .8ball ─────────────────────────────────────────────────────────────────
  {
    cmd: "8ball",
    aliases: ["eightball", "ask"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _question = args.trim();
      if (!_question) { await sock.sendMessage(from, { text: `🎱 *Magic 8-Ball*\n\nAsk me a question!\nUsage: \`${pfx}8ball Will I be rich?\`` }, { quoted: msg }); return; }
      const _answers = [
        "🟢 It is certain.","🟢 It is decidedly so.","🟢 Without a doubt.",
        "🟢 Yes, definitely.","🟢 You may rely on it.","🟢 As I see it, yes.",
        "🟢 Most likely.","🟢 Outlook good.","🟢 Yes.","🟢 Signs point to yes.",
        "🟡 Reply hazy, try again.","🟡 Ask again later.","🟡 Better not tell you now.",
        "🟡 Cannot predict now.","🟡 Concentrate and ask again.",
        "🔴 Don't count on it.","🔴 My reply is no.","🔴 My sources say no.",
        "🔴 Outlook not so good.","🔴 Very doubtful.",
      ];
      const _ans = _answers[Math.floor(Math.random() * _answers.length)];
      await sock.sendMessage(from, { text: `🎱 *Magic 8-Ball*\n\n❓ _${_question}_\n\n${_ans}` }, { quoted: msg });
    },
  },

  // ── .flip / .coinflip ──────────────────────────────────────────────────────
  {
    cmd: "flip",
    aliases: ["coinflip", "coin"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _side = Math.random() < 0.5 ? "🪙 *HEADS*" : "🪙 *TAILS*";
      await sock.sendMessage(from, { text: `🪙 *Coin Flip*\n\nFlipping...\n\nResult: ${_side}` }, { quoted: msg });
    },
  },

  // ── .dice / .roll ──────────────────────────────────────────────────────────
  {
    cmd: "dice",
    aliases: ["roll", "rolldice"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _sides = parseInt(args.trim()) || 6;
      if (_sides < 2 || _sides > 1000) { await sock.sendMessage(from, { text: `🎲 Please specify between 2 and 1000 sides.\nUsage: \`${pfx}dice 20\`` }, { quoted: msg }); return; }
      const _rolled = Math.floor(Math.random() * _sides) + 1;
      await sock.sendMessage(from, { text: `🎲 *Dice Roll* (d${_sides})\n\nYou rolled: *${_rolled}*` }, { quoted: msg });
    },
  },

  // ── .truth ─────────────────────────────────────────────────────────────────
  {
    cmd: "truth",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _truths = [
        "What is the most embarrassing thing you've ever done?",
        "Have you ever lied to your best friend? What was it about?",
        "What is your biggest fear?",
        "Who was your first crush and do they know?",
        "What is the biggest lie you have ever told?",
        "Have you ever cheated on a test or game?",
        "What is the most childish thing you still do?",
        "What is one thing you would never want your parents to find out?",
        "Have you ever sent a message to the wrong person? What did it say?",
        "What is something you have never told anyone?",
        "Have you ever pretended to like a gift when you actually hated it?",
        "What is the worst advice you have ever given?",
        "Have you ever blamed someone else for something you did?",
        "What is your most embarrassing memory from school?",
        "Have you ever ghosted someone? Why?",
        "What is the weirdest dream you have ever had?",
        "What is the pettiest reason you stopped talking to someone?",
        "Have you ever eaten food off the floor and not told anyone?",
        "What is the most ridiculous thing you ever did to impress someone?",
        "What is a secret you kept from your parents?",
      ];
      const _t = _truths[Math.floor(Math.random() * _truths.length)];
      await sock.sendMessage(from, { text: `🎯 *TRUTH*\n\n${_t}` }, { quoted: msg });
    },
  },

  // ── .dare ──────────────────────────────────────────────────────────────────
  {
    cmd: "dare",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _dares = [
        "Send a voice note saying 'I love NEXUS-MD!'",
        "Change your profile picture to a cartoon for the next hour.",
        "Send the last song you listened to.",
        "Tell the group your most embarrassing nickname.",
        "Post an old cringe photo of yourself.",
        "Send a 15-second voice note speaking in a funny accent.",
        "Write a love poem for the group bot.",
        "Do 20 push-ups and report back.",
        "Send your current location emoji (fake or real).",
        "Confess your most embarrassing habit.",
        "Send a text to your mum saying 'I accidentally dyed my eyebrows'.",
        "Set the weirdest song as your status for 30 minutes.",
        "Send a voice note of you singing.",
        "Type your next 10 messages with your eyes closed.",
        "Reply to the last 3 messages with only emojis.",
      ];
      const _d = _dares[Math.floor(Math.random() * _dares.length)];
      await sock.sendMessage(from, { text: `🔥 *DARE*\n\n${_d}` }, { quoted: msg });
    },
  },

  // ── .wyr ───────────────────────────────────────────────────────────────────
  {
    cmd: "wyr",
    aliases: ["wouldyourather"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _wyrs = [
        ["Be able to fly","Be able to become invisible"],
        ["Always be 10 minutes late","Always be 20 minutes early"],
        ["Have free Wi-Fi everywhere","Have free food everywhere"],
        ["Live without music","Live without social media"],
        ["Be rich and unknown","Be famous and broke"],
        ["Have a rewind button for your life","Have a pause button for your life"],
        ["Speak every language","Play every instrument"],
        ["Never eat sugar again","Never eat salt again"],
        ["Always have to sing instead of speaking","Always have to dance instead of walking"],
        ["Know when you will die","Know how you will die"],
        ["Have unlimited battery on all devices","Have free unlimited data forever"],
        ["Be able to read minds","Be able to control time"],
        ["Have a photographic memory","Have the ability to forget anything you choose"],
        ["Live in the past","Live in the future"],
        ["Only be able to whisper","Only be able to shout"],
      ];
      const _w = _wyrs[Math.floor(Math.random() * _wyrs.length)];
      await sock.sendMessage(from, { text: `🤔 *WOULD YOU RATHER...*\n\n🅰️ ${_w[0]}\n\n*— OR —*\n\n🅱️ ${_w[1]}` }, { quoted: msg });
    },
  },

  // ── .compliment ────────────────────────────────────────────────────────────
  {
    cmd: "compliment",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _compliments = [
        "You have the ability to make everyone around you feel better just by being there! 🌟",
        "Your kindness is like a warm blanket on a cold day. ❤️",
        "You have such a unique perspective that makes conversations so much more interesting! 💡",
        "The way you handle challenges is truly inspiring! 💪",
        "You bring so much joy and positivity to everyone you meet! ☀️",
        "Your creativity is absolutely remarkable! 🎨",
        "You have a heart of gold and it shows in everything you do! 💛",
        "Your smile has the power to light up any room! 😊",
        "You are more talented than you realize! 🏆",
        "The world is genuinely a better place with you in it! 🌍",
      ];
      const _target = msg.quoted ? `@${msg.quoted.sender.split("@")[0]}` : (msg.mentionedJids?.[0] ? `@${msg.mentionedJids[0].split("@")[0]}` : "you");
      const _c = _compliments[Math.floor(Math.random() * _compliments.length)];
      const _mentions = msg.quoted ? [msg.quoted.sender] : (msg.mentionedJids?.[0] ? [msg.mentionedJids[0]] : []);
      await sock.sendMessage(from, { text: `💐 *Compliment for ${_target}*\n\n${_c}`, mentions: _mentions }, { quoted: msg });
    },
  },

  // ── .roast ─────────────────────────────────────────────────────────────────
  {
    cmd: "roast",
    aliases: [],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const _roasts = [
        "You're the human equivalent of a participation trophy. 🏆",
        "You're not stupid; you just have bad luck thinking. 🍀",
        "I'd roast you harder, but my mum said I'm not allowed to burn trash. 🗑️",
        "You're the reason the gene pool needs a lifeguard. 🏊",
        "I'd explain it to you, but I left my crayons at home. 🖍️",
        "Your secrets are always safe with me. I never listen when you talk. 😴",
        "I thought of you today. It reminded me to take out the trash. 🗑️",
        "You're proof that evolution can go in reverse. 🦎",
        "If I had a dollar for every time you said something smart, I'd be broke. 💸",
        "You're like a cloud — when you disappear, it's a beautiful day. ☀️",
      ];
      const _target = msg.quoted ? `@${msg.quoted.sender.split("@")[0]}` : (msg.mentionedJids?.[0] ? `@${msg.mentionedJids[0].split("@")[0]}` : "you");
      const _r = _roasts[Math.floor(Math.random() * _roasts.length)];
      const _rMentions = msg.quoted ? [msg.quoted.sender] : (msg.mentionedJids?.[0] ? [msg.mentionedJids[0]] : []);
      await sock.sendMessage(from, { text: `🔥 *Roast for ${_target}*\n\n${_r}\n\n_Just for laughs! 😂_`, mentions: _rMentions }, { quoted: msg });
    },
  },

  // ── .ship ──────────────────────────────────────────────────────────────────
  {
    cmd: "ship",
    aliases: ["lovemeter", "love"],
    async run(ctx) {
      const { sock, msg, from, args } = ctx;
      const _p1 = (args || "").trim().split(/\s+and\s+|\s+&\s+|\s+\+\s+/i);
      const _name1 = _p1[0]?.trim() || msg.pushName || "Person 1";
      const _name2 = _p1[1]?.trim() || (msg.quoted ? msg.quoted.sender.split("@")[0] : "Person 2");
      const _seed  = (_name1 + _name2).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const _pct   = ((_seed * 7 + 13) % 101);
      const _bars  = Math.round(_pct / 10);
      const _bar   = "❤️".repeat(_bars) + "🖤".repeat(10 - _bars);
      let _verdict;
      if (_pct < 20) _verdict = "💔 No chemistry at all...";
      else if (_pct < 40) _verdict = "😐 Barely compatible";
      else if (_pct < 60) _verdict = "😊 Some potential!";
      else if (_pct < 80) _verdict = "😍 Great match!";
      else _verdict = "💕 Soulmates! Perfect match!";
      await sock.sendMessage(from, {
        text: `💘 *LOVE METER*\n\n👤 *${_name1}*\n💞 ${_bar}\n👤 *${_name2}*\n\n❤️ *Compatibility: ${_pct}%*\n\n${_verdict}`,
      }, { quoted: msg });
    },
  },

  // ── .catfact ───────────────────────────────────────────────────────────────
  {
    cmd: "catfact",
    aliases: ["cat"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        const _cfRes = await axios.get("https://catfact.ninja/fact", { timeout: 8000 });
        await sock.sendMessage(from, { text: `🐱 *Cat Fact*\n\n${_cfRes.data.fact}` }, { quoted: msg });
      } catch {
        const _offline = ["Cats sleep 12-16 hours per day.","A group of cats is called a clowder.","Cats can make over 100 vocal sounds.","Cats have 32 muscles in each ear.","A cat's nose print is unique, like a human fingerprint."];
        await sock.sendMessage(from, { text: `🐱 *Cat Fact*\n\n${_offline[Math.floor(Math.random() * _offline.length)]}` }, { quoted: msg });
      }
    },
  },

  // ── .dogfact ───────────────────────────────────────────────────────────────
  {
    cmd: "dogfact",
    aliases: ["dog"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        const _dfRes = await axios.get("https://dogapi.dog/api/v2/facts", { timeout: 8000 });
        const _dfFact = _dfRes.data?.data?.[0]?.attributes?.body || null;
        if (!_dfFact) throw new Error("no fact");
        await sock.sendMessage(from, { text: `🐶 *Dog Fact*\n\n${_dfFact}` }, { quoted: msg });
      } catch {
        const _offline = ["Dogs have a sense of time and miss their owners when they're gone.","A dog's nose print is unique like a human fingerprint.","Dogs can understand up to 250 words and gestures.","Dogs dream like humans — they have REM sleep cycles.","The Basenji is the only breed of dog that cannot bark."];
        await sock.sendMessage(from, { text: `🐶 *Dog Fact*\n\n${_offline[Math.floor(Math.random() * _offline.length)]}` }, { quoted: msg });
      }
    },
  },

  // ── .urban ─────────────────────────────────────────────────────────────────
  {
    cmd: "urban",
    aliases: ["ud"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _term = (args || "").trim();
      if (!_term) { await sock.sendMessage(from, { text: `📖 *Urban Dictionary*\n\nUsage: \`${pfx}urban <word or phrase>\`\nExample: \`${pfx}urban slay\`` }, { quoted: msg }); return; }
      try {
        const _udRes = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(_term)}`, { timeout: 10000 });
        const _def   = _udRes.data?.list?.[0];
        if (!_def) { await sock.sendMessage(from, { text: `❌ No definition found for *${_term}*.` }, { quoted: msg }); return; }
        const _clean = (s) => s.replace(/\[|\]/g, "").slice(0, 600);
        await sock.sendMessage(from, {
          text:
            `📖 *Urban Dictionary: ${_def.word}*\n\n` +
            `📝 *Definition:*\n${_clean(_def.definition)}\n\n` +
            `💬 *Example:*\n${_clean(_def.example || "N/A")}\n\n` +
            `👍 ${_def.thumbs_up} | 👎 ${_def.thumbs_down}`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Could not fetch definition: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .pickupline ────────────────────────────────────────────────────────────
  {
    cmd: "pickupline",
    aliases: ["pickup"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      const lines = [
        "Are you a WiFi signal? Because I'm feeling a strong connection. 📶",
        "Are you a magician? Because whenever I look at you, everyone else disappears. ✨",
        "Do you have a map? I keep getting lost in your eyes. 🗺️",
        "Are you a camera? Because every time I look at you, I smile. 📷",
        "Do you believe in love at first message? Or should I send another one? 💌",
        "Are you a bank loan? Because you have my interest. 💰",
        "Are you made of copper and tellurium? Because you're CuTe. ⚗️",
        "Is your name Google? Because you have everything I've been searching for. 🔍",
        "Are you a star? Because your beauty is out of this world. ⭐",
        "Do you have a charger? Because you just gave my heart a boost. 🔋",
      ];
      await sock.sendMessage(from, { text: `😏 *Pickup Line*\n\n${lines[Math.floor(Math.random() * lines.length)]}` }, { quoted: msg });
    },
  },

  // ── .numberfact ────────────────────────────────────────────────────────────
  {
    cmd: "numberfact",
    aliases: ["numfact"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _numRaw    = (args || "").trim();
      const _num       = parseInt(_numRaw, 10);
      if (_numRaw && isNaN(_num)) { await sock.sendMessage(from, { text: `❌ Please provide a valid number. Example: \`${pfx}numberfact 42\`` }, { quoted: msg }); return; }
      const _numTarget = _numRaw ? _num : Math.floor(Math.random() * 1000);
      try {
        const _nfRes = await axios.get(`https://numbersapi.com/${_numTarget}`, { timeout: 8000 });
        await sock.sendMessage(from, { text: `🔢 *Number Fact: ${_numTarget}*\n\n${_nfRes.data}` }, { quoted: msg });
      } catch {
        await sock.sendMessage(from, { text: `🔢 *Number Fact: ${_numTarget}*\n\n${_numTarget} is ${_numTarget % 2 === 0 ? "an even" : "an odd"} number with ${_numTarget.toString().length} digit(s).` }, { quoted: msg });
      }
    },
  },

  // ── .calc ──────────────────────────────────────────────────────────────────
  {
    cmd: "calc",
    aliases: ["math", "calculate"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const expr = args.trim();
      if (!expr) { await sock.sendMessage(from, { text: `🧮 *Calculator*\n\nUsage: \`${pfx}calc 2^10 + 5 * (3 - 1)\`` }, { quoted: msg }); return; }
      try {
        const sanitized = expr.replace(/[^0-9+\-*/%.^() ]/g, "");
        const result = Function(`"use strict"; return (${sanitized.replace(/\^/g, "**")})`)();
        if (typeof result !== "number" || !isFinite(result)) throw new Error("invalid");
        await sock.sendMessage(from, { text: `🧮 *Calculator*\n\n📥 Input: \`${expr}\`\n📤 Result: *${result}*` }, { quoted: msg });
      } catch { await sock.sendMessage(from, { text: `❌ Invalid expression. Only numbers and + - * / % ^ ( ) are allowed.` }, { quoted: msg }); }
    },
  },

  // ── .trivia ────────────────────────────────────────────────────────────────
  {
    cmd: "trivia",
    aliases: ["quiz"],
    async run(ctx) {
      const { sock, msg, from } = ctx;
      try {
        await sock.sendMessage(from, { text: "🧠 Loading trivia question..." }, { quoted: msg });
        const _tRes = await axios.get("https://opentdb.com/api.php?amount=1&type=multiple", { timeout: 10000 });
        const _q    = _tRes.data.results?.[0];
        if (!_q) throw new Error("No question returned");
        const he = (s) => s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#039;/g,"'");
        const _answers = [..._q.incorrect_answers, _q.correct_answer].sort(() => Math.random() - 0.5).map(he);
        const _letters = ["A","B","C","D"];
        const _answerLines = _answers.map((a, i) => `   ${_letters[i]}) ${a}`).join("\n");
        const _correctLetter = _letters[_answers.indexOf(he(_q.correct_answer))];
        await sock.sendMessage(from, {
          text:
            `╔══════════════════════╗\n║ 🧠 *TRIVIA QUESTION*\n╚══════════════════════╝\n\n` +
            `📂 *Category:* ${he(_q.category)}\n⚡ *Difficulty:* ${_q.difficulty.charAt(0).toUpperCase() + _q.difficulty.slice(1)}\n\n` +
            `❓ *${he(_q.question)}*\n\n${_answerLines}\n\n` +
            `> _Spoiler — Answer: *${_correctLetter}) ${he(_q.correct_answer)}*_`,
        }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Could not load trivia: ${e.message}` }, { quoted: msg }); }
    },
  },

  // ── .rps ───────────────────────────────────────────────────────────────────
  {
    cmd: "rps",
    aliases: ["rockpaperscissors"],
    async run(ctx) {
      const { sock, msg, from, args, pfx } = ctx;
      const _choices = ["🪨 Rock","📄 Paper","✂️ Scissors"];
      const _userRaw = (args || "").trim().toLowerCase();
      const _map = { rock:0, r:0, paper:1, p:1, scissors:2, s:2 };
      if (!(_userRaw in _map)) { await sock.sendMessage(from, { text: `🎮 *Rock Paper Scissors*\n\nUsage: \`${pfx}rps rock\` / \`${pfx}rps paper\` / \`${pfx}rps scissors\`` }, { quoted: msg }); return; }
      const _uIdx = _map[_userRaw];
      const _bIdx = Math.floor(Math.random() * 3);
      let _result;
      if (_uIdx === _bIdx) _result = "🤝 *It's a Tie!*";
      else if ((_uIdx - _bIdx + 3) % 3 === 1) _result = "🎉 *You Win!*";
      else _result = "🤖 *Bot Wins!*";
      await sock.sendMessage(from, {
        text: `🎮 *Rock Paper Scissors*\n\n👤 *You:* ${_choices[_uIdx]}\n🤖 *Bot:* ${_choices[_bIdx]}\n\n${_result}`,
      }, { quoted: msg });
    },
  },

  // ── .gpass ─────────────────────────────────────────────────────────────────
  {
    cmd: "gpass",
    aliases: ["genpassword"],
    async run(ctx) {
      const { sock, msg, from, args } = ctx;
      try {
        const _crypto2  = require("crypto");
        const _lenArg   = parseInt(args.trim().split(/\s+/)[0], 10);
        const _len      = isNaN(_lenArg) || _lenArg < 8 ? 12 : _lenArg;
        if (_lenArg < 8 && !isNaN(_lenArg)) { await sock.sendMessage(from, { text: "❌ Please provide a valid length (minimum 8 characters)." }, { quoted: msg }); return; }
        const _charset  = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+[]{}|;:,.<>?";
        let   _password = "";
        for (let i = 0; i < _len; i++) _password += _charset[_crypto2.randomInt(0, _charset.length)];
        await sock.sendMessage(from, { text: `🔐 *Your generated password (${_len} chars):*` }, { quoted: msg });
        await sock.sendMessage(from, { text: _password }, { quoted: msg });
      } catch (e) { await sock.sendMessage(from, { text: `❌ Error generating password: ${e.message}` }, { quoted: msg }); }
    },
  },

];
