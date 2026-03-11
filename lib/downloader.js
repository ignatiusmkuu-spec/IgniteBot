const ytdl = require("@distube/ytdl-core");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function getVideoInfo(url) {
  try {
    const info = await ytdl.getInfo(url);
    const details = info.videoDetails;
    return {
      title: details.title,
      author: details.author?.name,
      duration: details.lengthSeconds,
      views: details.viewCount,
      url: details.video_url,
      thumbnail: details.thumbnails?.slice(-1)[0]?.url,
    };
  } catch (err) {
    throw new Error(`Could not fetch video info: ${err.message}`);
  }
}

async function downloadAudio(url) {
  const tmpDir = os.tmpdir();
  const rawPath = path.join(tmpDir, `audio_raw_${Date.now()}.webm`);
  const outPath = path.join(tmpDir, `audio_${Date.now()}.mp3`);

  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.slice(0, 60);

  await new Promise((resolve, reject) => {
    const stream = ytdl.downloadFromInfo(info, { quality: "highestaudio", filter: "audioonly" });
    const out = fs.createWriteStream(rawPath);
    stream.pipe(out);
    out.on("finish", resolve);
    stream.on("error", reject);
    out.on("error", reject);
  });

  await new Promise((resolve, reject) => {
    ffmpeg(rawPath)
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .on("end", resolve)
      .on("error", reject)
      .save(outPath);
  });

  fs.unlinkSync(rawPath);
  return { path: outPath, title };
}

async function downloadVideo(url) {
  const tmpDir = os.tmpdir();
  const outPath = path.join(tmpDir, `video_${Date.now()}.mp4`);

  const info = await ytdl.getInfo(url);
  const title = info.videoDetails.title.slice(0, 60);

  await new Promise((resolve, reject) => {
    ytdl
      .downloadFromInfo(info, {
        quality: "highestvideo",
        filter: (fmt) => fmt.container === "mp4" && fmt.hasAudio && fmt.hasVideo,
      })
      .on("error", () => {
        ytdl
          .downloadFromInfo(info, { quality: "highest" })
          .pipe(fs.createWriteStream(outPath))
          .on("finish", resolve)
          .on("error", reject);
      })
      .pipe(fs.createWriteStream(outPath))
      .on("finish", resolve)
      .on("error", reject);
  });

  return { path: outPath, title };
}

async function searchYouTube(query) {
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const axios = require("axios");
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 10000,
    });
    const html = res.data;
    const match = html.match(/var ytInitialData = (.+?);<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const videos =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
          ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      const results = [];
      for (const item of videos) {
        const v = item?.videoRenderer;
        if (v && results.length < 5) {
          results.push({
            title: v.title?.runs?.[0]?.text,
            url: `https://www.youtube.com/watch?v=${v.videoId}`,
            duration: v.lengthText?.simpleText,
            channel: v.ownerText?.runs?.[0]?.text,
            views: v.viewCountText?.simpleText,
          });
        }
      }
      return results;
    }
  } catch {}
  return [];
}

module.exports = { getVideoInfo, downloadAudio, downloadVideo, searchYouTube };
