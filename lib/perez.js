const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

async function fetchJson(url) {
  const { data } = await axios.get(url, { timeout: 30000 });
  if (typeof data === "string" && data.trim().startsWith("<")) {
    throw new Error("API returned HTML instead of JSON — endpoint may be down");
  }
  return data;
}

async function gptChat(text, provider = "llama") {
  const apis = {
    llama:    `https://bk9.fun/ai/llama?q=${encodeURIComponent(text)}`,
    jeeves:   `https://bk9.fun/ai/jeeves-chat?q=${encodeURIComponent(text)}`,
    blackbox: `https://bk9.fun/ai/blackbox?q=${encodeURIComponent(text)}`,
    gpt4:     `https://bk9.fun/ai/gptt4?q=${encodeURIComponent(text)}`,
  };
  const url = apis[provider] || apis.llama;
  try {
    const data = await fetchJson(url);
    if (!data || typeof data !== "object") return `AI provider returned an invalid response. Try again later.`;
    return data.BK9 || "No response from AI provider.";
  } catch (e) {
    return `AI service unavailable: ${e.code === "ENOTFOUND" ? "cannot reach server" : e.message}`;
  }
}

async function darkGpt(text) {
  try {
    const data = await fetchJson(`https://api.dreaded.site/api/makgpt?text=${encodeURIComponent(text)}`);
    if (!data || typeof data !== "object") return "DarkGPT returned an invalid response.";
    return data.result || "No response.";
  } catch (e) {
    return `DarkGPT unavailable: ${e.code === "ENOTFOUND" ? "cannot reach server" : e.message}`;
  }
}

async function downloadTikTok(url) {
  const data = await fetchJson(`https://api.dreaded.site/api/tiktok?url=${encodeURIComponent(url)}`);
  if (!data?.tiktok?.video) throw new Error("Could not fetch TikTok video — API returned no video URL");
  const resp = await axios.get(data.tiktok.video, { responseType: "arraybuffer", timeout: 60000 });
  return {
    buffer: Buffer.from(resp.data),
    caption: `🎥 *TikTok Video*\n👤 ${data.tiktok.author?.nickname || "Unknown"}\n❤️ ${data.tiktok.statistics?.likeCount || 0} likes`,
  };
}

async function downloadTwitter(url) {
  const data = await fetchJson(`https://api.dreaded.site/api/alldl?url=${encodeURIComponent(url)}`);
  if (!data?.data?.videoUrl) throw new Error("Could not fetch Twitter video — no video URL in response");
  return { videoUrl: data.data.videoUrl };
}

async function downloadFacebook(url) {
  const data = await fetchJson(`https://api.dreaded.site/api/facebook?url=${encodeURIComponent(url)}`);
  if (!data?.facebook?.sdVideo) throw new Error("Could not fetch Facebook video — no video URL in response");
  return { videoUrl: data.facebook.sdVideo };
}

async function downloadInstagram(url) {
  try {
    const { igdl } = require("ruhend-scraper");
    const result = await igdl(url);
    if (!result?.data?.length) throw new Error("No media found");
    return result.data.map(d => d.url).filter(Boolean);
  } catch (primaryErr) {
    try {
      const data = await fetchJson(`https://api.dreaded.site/api/alldl?url=${encodeURIComponent(url)}`);
      if (!data?.data?.videoUrl) throw new Error("No media URL in fallback response");
      return [data.data.videoUrl];
    } catch {
      throw new Error(`Instagram download failed: ${primaryErr.message}`);
    }
  }
}

async function searchYouTube(query) {
  const yts = require("yt-search");
  const result = await yts(query);
  if (!result?.videos?.length) return [];
  return result.videos.slice(0, 10);
}

async function ytAudioApi(url) {
  const data = await fetchJson(`https://api.dreaded.site/api/ytdl/audio?url=${encodeURIComponent(url)}`);
  if (!data?.result?.url) throw new Error("Audio API returned no download URL");
  return { audioUrl: data.result.url, title: data.result.title || "audio" };
}

async function ytVideoApi(url) {
  const data = await fetchJson(`https://api.dreaded.site/api/ytdl/video?url=${encodeURIComponent(url)}`);
  if (!data?.result?.url) throw new Error("Video API returned no download URL");
  return { videoUrl: data.result.url, title: data.result.title || "video" };
}

async function getLyrics(songName) {
  try {
    const data = await fetchJson(`https://api.dreaded.site/api/lyrics?title=${encodeURIComponent(songName)}`);
    if (!data || typeof data !== "object") return null;
    if (!data.success || !data.result?.lyrics) return null;
    return data.result;
  } catch {
    return null;
  }
}

async function getAnime() {
  const { data } = await axios.get("https://api.jikan.moe/v4/random/anime", { timeout: 15000 });
  if (!data?.data) throw new Error("Anime API returned invalid data");
  const d = data.data;
  return {
    title: d.title || "Unknown",
    synopsis: d.synopsis,
    imageUrl: d.images?.jpg?.image_url,
    episodes: d.episodes,
    status: d.status,
    url: d.url,
  };
}

async function getMovie(name) {
  const { data } = await axios.get(`http://www.omdbapi.com/?apikey=742b2d09&t=${encodeURIComponent(name)}&plot=full`, { timeout: 15000 });
  if (!data || data.Response === "False") return null;
  return data;
}

async function getGithubUser(username) {
  const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(username)}`, { timeout: 10000 });
  if (!data?.login) throw new Error("Invalid GitHub user response");
  return data;
}

async function screenshot(url) {
  return `https://image.thum.io/get/fullpage/${url}`;
}

async function carbonCode(code) {
  const resp = await axios.post("https://carbonara.solopov.dev/api/cook", {
    code,
    backgroundColor: "#1F816D",
  }, { responseType: "arraybuffer", timeout: 30000, headers: { "Content-Type": "application/json" } });
  if (!resp.data || resp.data.length < 100) throw new Error("Carbon API returned invalid image data");
  return Buffer.from(resp.data);
}

async function getPickupLine() {
  const { data } = await axios.get("https://api.popcat.xyz/pickuplines", { timeout: 8000 });
  if (!data?.pickupline) throw new Error("No pickup line returned");
  return data.pickupline;
}

async function getCatFact() {
  try {
    const data = await fetchJson("https://api.dreaded.site/api/catfact");
    if (data?.fact) return data.fact;
    return "Cats spend 70% of their lives sleeping.";
  } catch {
    return "Cats spend 70% of their lives sleeping.";
  }
}

async function getFact() {
  try {
    const data = await fetchJson("https://api.dreaded.site/api/fact");
    if (data?.fact) return data.fact;
    return "Honey never spoils.";
  } catch {
    return "Honey never spoils.";
  }
}

async function getApk(query) {
  const search = await fetchJson(`https://bk9.fun/search/apk?q=${encodeURIComponent(query)}`);
  if (!search || typeof search !== "object") throw new Error("APK search API returned invalid response");
  if (!search.BK9?.[0]?.id) throw new Error("App not found");
  const dl = await fetchJson(`https://bk9.fun/download/apk?id=${search.BK9[0].id}`);
  if (!dl?.BK9) throw new Error("APK download link not available");
  return dl.BK9;
}

module.exports = {
  fetchJson,
  gptChat,
  darkGpt,
  downloadTikTok,
  downloadTwitter,
  downloadFacebook,
  downloadInstagram,
  searchYouTube,
  ytAudioApi,
  ytVideoApi,
  getLyrics,
  getAnime,
  getMovie,
  getGithubUser,
  screenshot,
  carbonCode,
  getPickupLine,
  getCatFact,
  getFact,
  getApk,
};
