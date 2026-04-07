#!/usr/bin/env node
/**
 * apply-perezbaileys-patches.js
 *
 * Re-applies all perezbaileys patches to @whiskeysockets/baileys after
 * `npm install` wipes node_modules.
 *
 * Run automatically via "postinstall" in package.json, or manually:
 *   node scripts/apply-perezbaileys-patches.js
 */

"use strict";

const fs = require("fs");
const path = require("path");

const BAILEYS = path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Socket");

let patched = 0;
let skipped = 0;

function patchFile(filePath, patches) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[perezbaileys] WARN: file not found — ${filePath}`);
    return;
  }
  let src = fs.readFileSync(filePath, "utf8");
  let changed = false;
  for (const { find, replace, label } of patches) {
    if (src.includes("perezbaileys:")) {
      // Already patched
      skipped++;
      return;
    }
    if (!src.includes(find)) {
      console.warn(`[perezbaileys] WARN: patch target not found — "${label}" in ${path.basename(filePath)}`);
      continue;
    }
    src = src.replace(find, replace);
    changed = true;
    patched++;
    console.log(`[perezbaileys] patched  "${label}" in ${path.basename(filePath)}`);
  }
  if (changed) fs.writeFileSync(filePath, src, "utf8");
}

// ── messages-recv.js ─────────────────────────────────────────────────────────

patchFile(path.join(BAILEYS, "messages-recv.js"), [
  {
    label: "handleNotification — remove shouldIgnoreJid filter",
    find: `    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from;
        if (shouldIgnoreJid(remoteJid) && remoteJid !== S_WHATSAPP_NET) {
            logger.debug({ remoteJid, id: node.attrs.id }, 'ignored notification');
            await sendMessageAck(node);
            return;
        }`,
    replace: `    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from;
        // perezbaileys: shouldIgnoreJid filter removed — process all notifications`,
  },
  {
    label: "handleMessage — remove shouldIgnoreJid + msmsg filters",
    find: `    const handleMessage = async (node) => {
        if (shouldIgnoreJid(node.attrs.from) && node.attrs.from !== S_WHATSAPP_NET) {
            logger.debug({ key: node.attrs.key }, 'ignored message');
            await sendMessageAck(node, NACK_REASONS.UnhandledError);
            return;
        }
        const encNode = getBinaryNodeChild(node, 'enc');
        // TODO: temporary fix for crashes and issues resulting of failed msmsg decryption
        if (encNode && encNode.attrs.type === 'msmsg') {
            logger.debug({ key: node.attrs.key }, 'ignored msmsg');
            await sendMessageAck(node, NACK_REASONS.MissingMessageSecret);
            return;
        }`,
    replace: `    const handleMessage = async (node) => {
        // perezbaileys: shouldIgnoreJid filter removed — accept messages from all JIDs
        // perezbaileys: msmsg filter removed — process all encrypted message types
        const encNode = getBinaryNodeChild(node, 'enc');`,
  },
]);

// ── socket.js ────────────────────────────────────────────────────────────────

patchFile(path.join(BAILEYS, "socket.js"), [
  {
    label: "unhandled frame — emit CB:* instead of silent debug log",
    find: `                if (!anyTriggered && logger.level === 'debug') {
                    logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv');
                }`,
    replace: `                if (!anyTriggered) {
                    // perezbaileys: emit 'CB:*' for every unhandled node so custom handlers can process non-official commands
                    ws.emit('CB:*', frame);
                    if (logger.level === 'debug') {
                        logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv (forwarded to CB:*)');
                    }
                }`,
  },
]);

// ── chats.js ─────────────────────────────────────────────────────────────────

patchFile(path.join(BAILEYS, "chats.js"), [
  {
    label: "handlePresenceUpdate — remove shouldIgnoreJid filter",
    find: `    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        let presence;
        const jid = attrs.from;
        const participant = attrs.participant || attrs.from;
        if (shouldIgnoreJid(jid) && jid !== S_WHATSAPP_NET) {
            return;
        }`,
    replace: `    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        let presence;
        const jid = attrs.from;
        const participant = attrs.participant || attrs.from;
        // perezbaileys: shouldIgnoreJid filter removed — handle presence for all JIDs`,
  },
]);

// ── Summary ───────────────────────────────────────────────────────────────────

if (skipped > 0) {
  console.log(`[perezbaileys] ${skipped} patch(es) already applied — nothing to do.`);
} else if (patched > 0) {
  console.log(`[perezbaileys] ${patched} patch(es) applied successfully.`);
} else {
  console.log("[perezbaileys] No patches applied (check warnings above).");
}
