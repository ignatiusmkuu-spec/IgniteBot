const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffmpeg = require("fluent-ffmpeg");
const sharp = require("sharp");
const { PDFDocument } = require("pdf-lib");
const path = require("path");
const fs = require("fs");
const os = require("os");

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const SUPPORTED = {
  "video→audio": "Extract audio from video (MP4 → MP3)",
  "audio→ogg": "Convert audio to OGG voice note",
  "image→pdf": "Convert image to PDF",
  "image→webp": "Convert image to WebP",
  "image→png": "Convert image to PNG",
  "image→jpg": "Convert image to JPG",
};

async function videoToAudio(videoBuffer) {
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `conv_in_${Date.now()}.mp4`);
  const outPath = path.join(tmpDir, `conv_out_${Date.now()}.mp3`);
  fs.writeFileSync(inPath, videoBuffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .noVideo()
      .audioCodec("libmp3lame")
      .audioBitrate(128)
      .on("end", resolve)
      .on("error", reject)
      .save(outPath);
  });

  const buf = fs.readFileSync(outPath);
  fs.unlinkSync(inPath);
  fs.unlinkSync(outPath);
  return buf;
}

async function audioToOgg(audioBuffer) {
  const tmpDir = os.tmpdir();
  const inPath = path.join(tmpDir, `conv_in_${Date.now()}.mp3`);
  const outPath = path.join(tmpDir, `conv_out_${Date.now()}.ogg`);
  fs.writeFileSync(inPath, audioBuffer);

  await new Promise((resolve, reject) => {
    ffmpeg(inPath)
      .audioCodec("libopus")
      .format("ogg")
      .on("end", resolve)
      .on("error", reject)
      .save(outPath);
  });

  const buf = fs.readFileSync(outPath);
  fs.unlinkSync(inPath);
  fs.unlinkSync(outPath);
  return buf;
}

async function imageToPdf(imageBuffer) {
  const pdfDoc = await PDFDocument.create();
  let image;
  try {
    image = await pdfDoc.embedJpg(imageBuffer);
  } catch {
    const pngBuf = await sharp(imageBuffer).png().toBuffer();
    image = await pdfDoc.embedPng(pngBuf);
  }
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return Buffer.from(await pdfDoc.save());
}

async function convertImage(imageBuffer, format) {
  const img = sharp(imageBuffer);
  if (format === "webp") return img.webp({ quality: 85 }).toBuffer();
  if (format === "png") return img.png().toBuffer();
  if (format === "jpg" || format === "jpeg") return img.jpeg({ quality: 85 }).toBuffer();
  throw new Error(`Unsupported format: ${format}`);
}

function getSupportedFormats() {
  return Object.entries(SUPPORTED)
    .map(([k, v]) => `• *${k}* — ${v}`)
    .join("\n");
}

module.exports = { videoToAudio, audioToOgg, imageToPdf, convertImage, getSupportedFormats };
