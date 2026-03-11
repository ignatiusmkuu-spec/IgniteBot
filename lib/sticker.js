const sharp = require("sharp");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

async function imageToSticker(imageBuffer) {
  const tmpDir = os.tmpdir();
  const outPath = path.join(tmpDir, `sticker_${Date.now()}.webp`);
  try {
    await sharp(imageBuffer)
      .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 80 })
      .toFile(outPath);
    const buf = fs.readFileSync(outPath);
    fs.unlinkSync(outPath);
    return buf;
  } catch (err) {
    throw new Error(`Sticker conversion failed: ${err.message}`);
  }
}

async function videoToSticker(videoBuffer) {
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `input_${Date.now()}.mp4`);
  const outPath = path.join(tmpDir, `sticker_${Date.now()}.webp`);
  fs.writeFileSync(inPath, videoBuffer);

  return new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .outputOptions([
        "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000",
        "-vcodec", "libwebp",
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-vsync", "0",
        "-t", "00:00:05",
      ])
      .toFormat("webp")
      .on("end", () => {
        const buf = fs.readFileSync(outPath);
        fs.unlinkSync(inPath);
        fs.unlinkSync(outPath);
        resolve(buf);
      })
      .on("error", (err) => {
        try { fs.unlinkSync(inPath); } catch {}
        reject(new Error(`Video sticker failed: ${err.message}`));
      })
      .save(outPath);
  });
}

module.exports = { imageToSticker, videoToSticker };
