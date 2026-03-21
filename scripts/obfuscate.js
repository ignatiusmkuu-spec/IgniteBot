#!/usr/bin/env node
const JavaScriptObfuscator = require("javascript-obfuscator");
const fs = require("fs");
const path = require("path");

const SOURCES = path.join(__dirname, "../.private/lib");
const OUTPUT  = path.join(__dirname, "../lib");

const FILES = [
  "commands.js",
  "security.js",
  "perez.js",
  "dreadfunc.js",
  "dreadexif.js",
  "dreadquotely.js",
  "dreadupload.js",
];

const OPTIONS = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.4,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: "hexadecimal",
  log: false,
  renameGlobals: false,
  rotateStringArray: true,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: true,
  stringArrayCallsTransform: true,
  stringArrayCallsTransformThreshold: 0.5,
  stringArrayEncoding: ["base64"],
  stringArrayIndexShift: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 2,
  stringArrayWrappersType: "variable",
  stringArrayThreshold: 0.75,
  target: "node",
  transformObjectKeys: false,
  unicodeEscapeSequence: false,
};

let ok = 0, fail = 0;
for (const file of FILES) {
  const src = path.join(SOURCES, file);
  const dst = path.join(OUTPUT, file);
  if (!fs.existsSync(src)) {
    console.warn(`⚠️  Source not found: ${src} — skipping`);
    fail++;
    continue;
  }
  try {
    const code = fs.readFileSync(src, "utf8");
    const result = JavaScriptObfuscator.obfuscate(code, OPTIONS);
    fs.writeFileSync(dst, result.getObfuscatedCode());
    const origSize = Buffer.byteLength(code);
    const newSize  = Buffer.byteLength(result.getObfuscatedCode());
    console.log(`✅  ${file.padEnd(22)} ${(origSize/1024).toFixed(1)}KB → ${(newSize/1024).toFixed(1)}KB`);
    ok++;
  } catch (err) {
    console.error(`❌  ${file}: ${err.message}`);
    fail++;
  }
}
console.log(`\nDone: ${ok} obfuscated, ${fail} failed.`);
if (fail > 0) process.exit(1);
