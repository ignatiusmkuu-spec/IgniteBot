#!/usr/bin/env node
/**
 * apply-baileys-patches.js
 *
 * Patches @whiskeysockets/baileys after `npm install` to fix two hard filters
 * that silently drop incoming WhatsApp messages before they ever reach the app:
 *
 *   1. shouldIgnoreJid filter  — drops messages from certain JIDs
 *   2. msmsg filter            — drops ALL messages from multi-device users
 *                                (the majority of WhatsApp users today)
 *
 * Each patch has its own unique marker so patches are applied independently.
 * Safe to run multiple times — already-applied patches are detected and skipped.
 *
 * Run automatically via "postinstall" in package.json, or manually:
 *   node scripts/apply-baileys-patches.js
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const BAILEYS = path.join(__dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Socket");

let applied = 0;
let skipped = 0;
let warned  = 0;

/**
 * Apply a single patch to a file.
 * Uses a unique per-patch marker so each patch is tracked independently.
 *
 * @param {string} filePath   - Absolute path to the file to patch
 * @param {string} marker     - Unique string that appears ONLY in the replacement
 * @param {string} find       - Exact substring to replace (must exist in the original)
 * @param {string} replace    - Replacement substring (should include the marker)
 * @param {string} label      - Human-readable name for logging
 */
function applyPatch(filePath, { marker, find, replace, label }) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[baileys-patch] WARN: file not found — ${path.basename(filePath)}`);
    warned++;
    return;
  }

  const src = fs.readFileSync(filePath, "utf8");

  // Already applied — the unique marker is present
  if (src.includes(marker)) {
    console.log(`[baileys-patch] already applied — "${label}"`);
    skipped++;
    return;
  }

  // Find target not present — Baileys version may have changed
  if (!src.includes(find)) {
    console.warn(`[baileys-patch] WARN: patch target not found — "${label}" in ${path.basename(filePath)}`);
    console.warn(`[baileys-patch]       (Baileys may have changed internals — check the script)`);
    warned++;
    return;
  }

  fs.writeFileSync(filePath, src.replace(find, replace), "utf8");
  console.log(`[baileys-patch] applied  — "${label}"`);
  applied++;
}

// ── messages-recv.js ──────────────────────────────────────────────────────────
const RECV = path.join(BAILEYS, "messages-recv.js");

// Patch 1: handleMessage — remove shouldIgnoreJid AND msmsg filters
// Without this patch, ALL messages from multi-device WhatsApp users (msmsg type)
// are silently dropped before reaching messages.upsert. Bot receives nothing.
applyPatch(RECV, {
  label:   "handleMessage — remove shouldIgnoreJid + msmsg filters",
  marker:  "[nexus-patch:handleMessage]",
  find:
`    const handleMessage = async (node) => {
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
  replace:
`    const handleMessage = async (node) => {
        // [nexus-patch:handleMessage] shouldIgnoreJid + msmsg filters removed
        // — accept messages from ALL JIDs and ALL encryption types (multi-device)
        const encNode = getBinaryNodeChild(node, 'enc');`,
});

// Patch 2: handleNotification — remove shouldIgnoreJid filter
applyPatch(RECV, {
  label:   "handleNotification — remove shouldIgnoreJid filter",
  marker:  "[nexus-patch:handleNotification]",
  find:
`    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from;
        if (shouldIgnoreJid(remoteJid) && remoteJid !== S_WHATSAPP_NET) {
            logger.debug({ remoteJid, id: node.attrs.id }, 'ignored notification');
            await sendMessageAck(node);
            return;
        }`,
  replace:
`    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from;
        // [nexus-patch:handleNotification] shouldIgnoreJid filter removed — process all notifications`,
});

// ── socket.js ─────────────────────────────────────────────────────────────────
const SOCK = path.join(BAILEYS, "socket.js");

// Patch 3: Emit CB:* for every unhandled binary node
applyPatch(SOCK, {
  label:   "socket — emit CB:* for unhandled nodes",
  // Accept both the new marker and the old perezbaileys marker (already-patched detection)
  marker:  "CB:*",
  find:
`                if (!anyTriggered && logger.level === 'debug') {
                    logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv');
                }`,
  replace:
`                if (!anyTriggered) {
                    // [nexus-patch:socket-cb-star] forward unhandled nodes to CB:* handlers
                    ws.emit('CB:*', frame);
                    if (logger.level === 'debug') {
                        logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv (forwarded to CB:*)');
                    }
                }`,
});

// ── chats.js ──────────────────────────────────────────────────────────────────
const CHATS = path.join(BAILEYS, "chats.js");

// Patch 4: handlePresenceUpdate — remove shouldIgnoreJid filter
applyPatch(CHATS, {
  label:   "handlePresenceUpdate — remove shouldIgnoreJid filter",
  // Accept both the new marker and the old perezbaileys marker (already-patched detection)
  marker:  "perezbaileys: shouldIgnoreJid filter removed — handle presence",
  find:
`    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        let presence;
        const jid = attrs.from;
        const participant = attrs.participant || attrs.from;
        if (shouldIgnoreJid(jid) && jid !== S_WHATSAPP_NET) {
            return;
        }`,
  replace:
`    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        let presence;
        const jid = attrs.from;
        const participant = attrs.participant || attrs.from;
        // [nexus-patch:presenceUpdate] shouldIgnoreJid filter removed — handle presence for all JIDs`,
});

// Patch 5: handleReceipt — remove shouldIgnoreJid filter
// Blocks delivery/read receipt tracking for certain JIDs; also indirectly
// affects message retry logic which can stall message delivery.
applyPatch(RECV, {
  label:   "handleReceipt — remove shouldIgnoreJid filter",
  marker:  "[nexus-patch:handleReceipt]",
  find:
`        if (shouldIgnoreJid(remoteJid) && remoteJid !== S_WHATSAPP_NET) {
            logger.debug({ remoteJid }, 'ignoring receipt from jid');
            await sendMessageAck(node);
            return;
        }
        const ids = [attrs.id];`,
  replace:
`        // [nexus-patch:handleReceipt] shouldIgnoreJid filter removed — track receipts for all JIDs
        const ids = [attrs.id];`,
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`[baileys-patch] done — applied: ${applied}, skipped: ${skipped}, warnings: ${warned}`);
if (warned > 0) {
  console.warn("[baileys-patch] Some patches could not be applied (see warnings above).");
  console.warn("[baileys-patch] The bot may not receive messages from multi-device users.");
}
