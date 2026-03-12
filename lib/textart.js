const axios = require("axios");

const EPHOTO_STYLES = {
  metallic:   { url: "https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html",     name: "Metallic" },
  ice:        { url: "https://en.ephoto360.com/ice-text-effect-online-101.html",                         name: "Ice" },
  snow:       { url: "https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html",       name: "Snow" },
  impressive: { url: "https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html",    name: "Impressive" },
  noel:       { url: "https://en.ephoto360.com/noel-text-effect-online-99.html",                         name: "Noel" },
  water:      { url: "https://en.ephoto360.com/create-water-effect-text-online-295.html",                name: "Water" },
  matrix:     { url: "https://en.ephoto360.com/matrix-text-effect-154.html",                             name: "Matrix" },
  light:      { url: "https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html",  name: "Light" },
  neon:       { url: "https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html", name: "Neon" },
  silver:     { url: "https://en.ephoto360.com/create-glossy-silver-3d-text-effect-online-802.html",     name: "Silver" },
  devil:      { url: "https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html",            name: "Devil" },
  typography: { url: "https://en.ephoto360.com/create-typography-text-effect-on-pavement-online-774.html", name: "Typography" },
  purple:     { url: "https://en.ephoto360.com/purple-text-effect-online-100.html",                      name: "Purple" },
  thunder:    { url: "https://en.ephoto360.com/thunder-text-effect-online-97.html",                      name: "Thunder" },
  leaves:     { url: "https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html", name: "Leaves" },
  "1917":     { url: "https://en.ephoto360.com/1917-style-text-effect-523.html",                         name: "1917" },
  arena:      { url: "https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html",       name: "Arena" },
  hacker:     { url: "https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html",      name: "Hacker" },
  sand:       { url: "https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html",    name: "Sand" },
  dragonball: { url: "https://en.ephoto360.com/create-dragon-ball-style-text-effects-online-809.html",   name: "Dragon Ball" },
  naruto:     { url: "https://en.ephoto360.com/naruto-shippuden-logo-style-text-effect-online-808.html", name: "Naruto" },
  graffiti:   { url: "https://en.ephoto360.com/create-a-cartoon-style-graffiti-text-effect-online-668.html", name: "Graffiti" },
  cat:        { url: "https://en.ephoto360.com/handwritten-text-on-foggy-glass-online-680.html",         name: "Foggy Glass" },
  gold:       { url: "https://en.ephoto360.com/modern-gold-4-213.html",                                 name: "Gold" },
  child:      { url: "https://en.ephoto360.com/write-text-on-wet-glass-online-589.html",                 name: "Wet Glass" },
};

async function generateTextArt(style, text) {
  try {
    const mumaker = require("mumaker");
    const styleInfo = EPHOTO_STYLES[style];
    if (!styleInfo) return { error: `Unknown style: ${style}` };
    const result = await mumaker.ephoto(styleInfo.url, text);
    return { imageUrl: result.image, style: styleInfo.name };
  } catch (err) {
    return { error: `Text art generation failed: ${err.message || err}` };
  }
}

function getStyleList() {
  return Object.entries(EPHOTO_STYLES)
    .map(([key, val]) => `\`${key}\` — ${val.name}`)
    .join("\n");
}

function isValidStyle(style) {
  return !!EPHOTO_STYLES[style];
}

module.exports = { generateTextArt, getStyleList, isValidStyle, EPHOTO_STYLES };
