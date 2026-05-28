"use strict";
// ── NEXUS-MD Plugin Loader ────────────────────────────────────────────────────
// Loads all .js files from /plugins, maps cmd/alias → handler,
// first-registration wins (alphabetical file order → 00-* beats 10-*).
// dispatch(ctx) returns true if a command was handled, false otherwise.

const fs   = require("fs");
const path = require("path");

const _map = new Map();   // lowercase cmd → async run(ctx)
let   _loaded = false;

function load() {
  const dir   = path.join(__dirname, "..", "plugins");
  if (!fs.existsSync(dir)) { console.warn("[loader] plugins/ directory not found"); return; }
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js")).sort();
  for (const f of files) {
    let plugins;
    try { plugins = require(path.join(dir, f)); }
    catch (e) { console.error(`[loader] Failed to load plugin ${f}:`, e.message); continue; }
    if (!Array.isArray(plugins)) { console.warn(`[loader] ${f} did not export an array — skipping`); continue; }
    for (const p of plugins) {
      if (!p || typeof p.run !== "function") continue;
      const cmds = [p.cmd, ...(Array.isArray(p.aliases) ? p.aliases : [])].filter(Boolean);
      for (const c of cmds) {
        const key = c.toLowerCase();
        if (!_map.has(key)) {           // first-registration wins
          _map.set(key, p.run);
        }
      }
    }
  }
  _loaded = true;
  console.log(`[loader] ${_map.size} commands registered from ${files.length} plugin file(s)`);
}

async function dispatch(ctx) {
  if (!_loaded) load();
  const handler = _map.get(ctx.cmd.toLowerCase());
  if (!handler) return false;
  try { await handler(ctx); }
  catch (e) {
    console.error(`[plugin:${ctx.cmd}] unhandled error:`, e.message);
    try {
      await ctx.sock.sendMessage(ctx.from, { text: `❌ Command error: ${e.message}` }, { quoted: ctx.msg });
    } catch {}
  }
  return true;
}

module.exports = { load, dispatch };
