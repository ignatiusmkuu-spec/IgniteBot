#!/usr/bin/env node
/**
 * apply-baileys-patches.js
 *
 * Patches @whiskeysockets/baileys after `npm install` to fix hard filters
 * that silently drop incoming WhatsApp messages before they reach the app.
 *
 * Supports both rc.9 and rc13+ (auto-detects which version is installed).
 *
 * Filters removed:
 *   1. msmsg filter      — drops ALL messages from multi-device WhatsApp users
 *   2. shouldIgnoreJid   — drops messages/receipts/notifications from certain JIDs
 *   3. presenceUpdate    — drops presence from certain JIDs
 *   4. CB:* forwarding   — ensures unhandled nodes reach custom handlers
 *
 * Each patch has its own unique marker — safe to run multiple times.
 * Run automatically via "postinstall" / "heroku-postbuild" in package.json,
 * or at startup via require('./scripts/apply-baileys-patches') in index.js.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

const BAILEYS_SOCKET = path.join(
  __dirname, "..", "node_modules", "@whiskeysockets", "baileys", "lib", "Socket"
);

let applied = 0;
let skipped = 0;
let warned  = 0;

/**
 * Apply a patch that may have different `find` strings across Baileys versions.
 * `variants` is an array of { find, replace } objects tried in order.
 * The first matching variant is applied. Already-applied patches are detected
 * via the unique `marker` string that appears only in replacements.
 */
function applyPatch(filePath, { label, marker, variants }) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[baileys-patch] WARN: file not found — ${path.basename(filePath)}`);
    warned++;
    return;
  }

  let src = fs.readFileSync(filePath, "utf8");

  // Already applied — unique marker is present in any variant's replacement
  if (src.includes(marker)) {
    console.log(`[baileys-patch] already applied — "${label}"`);
    skipped++;
    return;
  }

  // Try each variant in order
  for (const { find, replace } of variants) {
    if (src.includes(find)) {
      fs.writeFileSync(filePath, src.replace(find, replace), "utf8");
      console.log(`[baileys-patch] applied  — "${label}"`);
      applied++;
      return;
    }
  }

  // No variant matched
  console.warn(`[baileys-patch] WARN: patch target not found — "${label}" in ${path.basename(filePath)}`);
  console.warn(`[baileys-patch]       (Baileys internals may have changed — check the script)`);
  warned++;
}

// ── messages-recv.js ──────────────────────────────────────────────────────────
const RECV = path.join(BAILEYS_SOCKET, "messages-recv.js");

// ── Patch 1: Remove msmsg filter from handleMessage ──────────────────────────
// Drops ALL messages from multi-device WhatsApp users before messages.upsert fires.
// rc.9: the filter is an if/else inside handleMessage
// rc13: simplified to a single if block (encNode?.attrs.type)
applyPatch(RECV, {
  label:  "handleMessage — remove msmsg filter",
  marker: "[nexus-patch:msmsg]",
  variants: [
    // rc13 format
    {
      find:
`    const handleMessage = async (node) => {
        const encNode = getBinaryNodeChild(node, 'enc');
        // TODO: temporary fix for crashes and issues resulting of failed msmsg decryption
        if (encNode?.attrs.type === 'msmsg') {
            logger.debug({ key: node.attrs.key }, 'ignored msmsg');
            await sendMessageAck(node, NACK_REASONS.MissingMessageSecret);
            return;
        }`,
      replace:
`    const handleMessage = async (node) => {
        // [nexus-patch:msmsg] msmsg filter removed — accept all encryption types (multi-device)
        const encNode = getBinaryNodeChild(node, 'enc');`,
    },
    // rc.9 format (combined shouldIgnoreJid + msmsg in one block)
    {
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
        // [nexus-patch:msmsg] shouldIgnoreJid + msmsg filters removed — accept all messages
        const encNode = getBinaryNodeChild(node, 'enc');`,
    },
  ],
});

// ── Patch 2: Remove shouldIgnoreJid filter ───────────────────────────────────
// rc13: unified processNode function handles all types (message/receipt/notification)
// rc.9: separate filters in handleNotification and handleReceipt
applyPatch(RECV, {
  label:  "processNode/handleNotification — remove shouldIgnoreJid filter",
  marker: "[nexus-patch:shouldIgnoreJid]",
  variants: [
    // rc13: unified processNode gate
    {
      find:
`        if (ignoreJid && ignoreJid !== S_WHATSAPP_NET && shouldIgnoreJid(ignoreJid)) {
            await sendMessageAck(node, type === 'message' ? NACK_REASONS.UnhandledError : undefined);
            return;
        }`,
      replace:
`        // [nexus-patch:shouldIgnoreJid] filter removed — process all JIDs`,
    },
    // rc.9: handleNotification filter
    {
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
        // [nexus-patch:shouldIgnoreJid] shouldIgnoreJid filter removed — process all notifications`,
    },
  ],
});

// ── Patch 3: handleReceipt — remove shouldIgnoreJid filter (rc.9 only) ───────
// rc13 already handles this via the unified processNode patch above.
applyPatch(RECV, {
  label:  "handleReceipt — remove shouldIgnoreJid filter (rc.9)",
  marker: "[nexus-patch:receipt]",
  variants: [
    // rc.9 format
    {
      find:
`        if (shouldIgnoreJid(remoteJid) && remoteJid !== S_WHATSAPP_NET) {
            logger.debug({ remoteJid }, 'ignoring receipt from jid');
            await sendMessageAck(node);
            return;
        }
        const ids = [attrs.id];`,
      replace:
`        // [nexus-patch:receipt] shouldIgnoreJid filter removed — track receipts for all JIDs
        const ids = [attrs.id];`,
    },
    // rc13: handled by processNode patch — mark as skipped via a dummy that always matches
    // We detect rc13 by the processNode marker already being present
    {
      find:    "[nexus-patch:shouldIgnoreJid] filter removed — process all JIDs",
      replace: "[nexus-patch:shouldIgnoreJid] filter removed — process all JIDs[nexus-patch:receipt]",
    },
  ],
});

// ── socket.js ─────────────────────────────────────────────────────────────────
const SOCK = path.join(BAILEYS_SOCKET, "socket.js");

applyPatch(SOCK, {
  label:  "socket — emit CB:* for unhandled nodes",
  marker: "CB:*",
  variants: [
    // Old perezbaileys marker — already applied by previous script
    { find: "// perezbaileys: emit 'CB:*'", replace: "// perezbaileys: emit 'CB:*'" },
    // rc.9 original
    {
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
    },
  ],
});

// ── chats.js ──────────────────────────────────────────────────────────────────
const CHATS = path.join(BAILEYS_SOCKET, "chats.js");

applyPatch(CHATS, {
  label:  "handlePresenceUpdate — remove shouldIgnoreJid filter",
  marker: "shouldIgnoreJid filter removed — handle presence",
  variants: [
    // Old perezbaileys marker — already applied by previous script
    { find: "// perezbaileys: shouldIgnoreJid filter removed — handle presence", replace: "// perezbaileys: shouldIgnoreJid filter removed — handle presence" },
    // rc.9 / rc13 original
    {
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
    },
  ],
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`[baileys-patch] done — applied: ${applied}, skipped: ${skipped}, warnings: ${warned}`);
if (warned > 0) {
  process.exitCode = 1;
  console.warn("[baileys-patch] Some patches could not be applied (see warnings above).");
  console.warn("[baileys-patch] The bot may not receive messages from multi-device users.");
}
