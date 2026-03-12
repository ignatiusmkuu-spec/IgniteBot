# IgniteBot (Nexus V2) — WhatsApp Bot

## Overview
A modular WhatsApp bot built with Node.js and Baileys. Features 150+ commands across AI, downloaders, group management, text art, sports, media creation, code compilation, and more.

## Architecture
- **Entry:** `index.js` — Baileys socket, QR/pairing, event handlers, anti-delete, anti-leave enforcement
- **Commands:** `lib/commands.js` — Main command router (~3930 lines, switch-case handler)
- **Config:** `config.js` — Bot settings, prefix, admin numbers
- **Data:** `data/` directory — JSON-based persistent storage

## Core Modules (lib/)
| Module | Purpose |
|--------|---------|
| `commands.js` | Main command handler — routes all user commands |
| `ai.js` | AI providers (Groq, OpenAI) for chat/image generation |
| `downloader.js` | YouTube/universal media download (yt-dlp) |
| `perez.js` | API-based AI (GPT/Llama/Blackbox/DarkGPT), social media downloaders (TikTok/Twitter/FB/IG), lyrics, anime, movie, GitHub, carbon code, APK, misc utilities |
| `textart.js` | 25 ephoto360 text art styles via mumaker (metallic, neon, gold, naruto, etc.) |
| `sports.js` | Football standings & fixtures for 5 European leagues via dreaded API |
| `groups.js` | Welcome/goodbye messages, tag all, group info |
| `admin.js` | Super admin, sudo management, kick/promote/demote/mute |
| `security.js` | Anti-link, anti-spam, anti-delete, anti-long-text, anti-leave, warnings, bans |
| `settings.js` | Bot settings persistence (mode, prefix, menu media) |
| `sticker.js` | Image/video to sticker conversion |
| `converter.js` | Media format conversion (video→audio, image→PDF) |
| `translator.js` | Language translation |
| `analytics.js` | Message and command tracking |
| `store.js` | Product catalog and orders |
| `booking.js` | Service booking system |
| `broadcast.js` | Mass messaging |
| `keywords.js` | Auto-response keywords |
| `db.js` | PostgreSQL integration |
| `datastore.js` | JSON file-based storage |

## Command Categories
- **AI:** ai, ai2, ai3, chat, ask, gpt, gpt2, gpt3, darkgpt, imagine, dalle, createimage, tts, say, summarize
- **Downloaders:** play, song, yt, dl, tiktok, twitter, instagram, ytmp3, ytmp4, song2, video, lyrics, yts, fbdl, facebook, pindl
- **Sports:** epl, laliga, bundesliga, seriea, ligue1, fixtures
- **Text Art:** 25 styles (metallic, ice, snow, neon, gold, naruto, dragonball, graffiti, etc.)
- **Fun:** 8ball, fact, flip, joke, quote, roll, pickupline, catfact, advise, hack
- **Utilities:** carbon, screenshot, anime, movie, github, gitclone, apk, news, tweet, pin, qr, short, weather, wiki, define, inspect, removebg, remini, trt/translate, mail, whatsong/shazam, upload, hacker2, runtime, request/reportbug
- **Sticker Tools:** sticker, take, attp, smeme, quotely, tovideo/mp4, toimage/photo, vv/retrieve
- **Code Compiler:** compile-js, compile-py, compile-c, compile-c++, eval, sc/repo
- **Text:** aesthetic, bold, italic, mock, reverse, emojify, upper, lower, repeat, calc
- **Group:** add, kick, kickall, kill, kill2, promote/demote all, ban, mute, open/close, tagall, hidetag/tag, poll, warn, approve/reject join requests, foreigners, icon, subject, desc, gcprofile, antileave, vcf, disp-1/7/90/off
- **Owner:** sudo, broadcast, cast, block, unblock, join, restart, save, botpp, fullpp, setmode, setprefix, dp

## Key Dependencies
- `@whiskeysockets/baileys` — WhatsApp Web API
- `axios` — HTTP requests for external APIs
- `yt-search` — YouTube search
- `mumaker` — Text art generation (ephoto360)
- `ruhend-scraper` — Instagram downloader fallback
- `sharp` — Image processing
- `qrcode` — QR code generation
- `form-data` — Multipart uploads (catbox, image APIs)

## External APIs Used
- `api.dreaded.site` — Sports standings, lyrics, TikTok/FB downloads, news, dark GPT, Gemini Vision, removebg, shazam
- `bk9.fun` — AI chat (Llama, Jeeves, Blackbox), APK search/download, Gemini image
- `emkc.org/api/v2/piston` — Code compilation (JS, Python, C, C++)
- `carbonara.solopov.dev` — Code-to-image (carbon)
- `image.thum.io` — Website screenshots
- `api.jikan.moe` — Anime data
- `omdbapi.com` — Movie data
- `api.github.com` — GitHub profiles/repos
- `api.popcat.xyz` — Pickup lines
- `some-random-api.com` — Tweet image generation
- `catbox.moe` / `litterbox.catbox.moe` — Media upload (for image analysis, memes)
- `aemt.me` — Quotely, hacker2 filter
- `api.lolhuman.xyz` — Animated text stickers (ATTP)
- `api.memegen.link` — Meme generation
- `api.mymemory.translated.net` — Translation
- `inferenceengine.vyro.ai` — Image enhancement (remini)

## Environment Variables
- `ADMIN_NUMBERS` — Comma-separated admin phone numbers
- `OPENAI_API_KEY` — OpenAI API key (optional)
- `GROQ_API_KEY` — Groq API key (optional)
- `DATABASE_URL` — PostgreSQL connection string (optional)
- `LOLHUMAN_API_KEY` — API key for lolhuman.xyz services (optional, has default)
- `REMOVE_BG_API_KEY` — remove.bg API key (optional, falls back to dreaded API)
