"use strict";

/**
 * perezbaileys — Perez-patched fork of @whiskeysockets/baileys
 *
 * Changes over stock Baileys:
 *  1. shouldIgnoreJid always returns false → no message/notification/chat is
 *     silently dropped based on JID.
 *  2. msmsg filter removed → multi-device signal messages are passed through
 *     instead of being ack'd and discarded.
 *  3. Unhandled WABinary nodes emit 'CB:*' on the internal WebSocket emitter
 *     so non-official / future WA commands can be caught by the bot.
 *  4. Presence updates are forwarded for every JID regardless of shouldIgnoreJid.
 *  5. Exports a helper `onUnhandledNode(sock, cb)` to attach a CB:* listener.
 */

// Load the patched @whiskeysockets/baileys (patches applied to node_modules)
const baileys = require("@whiskeysockets/baileys");

// Grab the original makeWASocket (comes as the `default` export)
const _makeWASocket = baileys.default;

/**
 * Perez-patched makeWASocket.
 * Accepts all the same options as the original but forces perezbaileys defaults.
 */
function makeWASocket(config = {}) {
  const patchedConfig = {
    // Force JID filter off — accept messages from every JID
    shouldIgnoreJid: () => false,
    // Spread caller config AFTER defaults so callers can still override if needed
    ...config,
    // Hard-lock shouldIgnoreJid — don't let callers accidentally re-enable filtering
    shouldIgnoreJid: () => false,
  };

  const sock = _makeWASocket(patchedConfig);

  // Attach the CB:* event to the top-level EventEmitter the bot can listen to.
  // The patched socket.js already emits 'CB:*' on the internal ws emitter;
  // here we bridge it to the public sock.ev bus as 'node.unhandled'.
  if (sock && sock.ws && typeof sock.ws.on === "function") {
    sock.ws.on("CB:*", (frame) => {
      try {
        sock.ev.emit("node.unhandled", frame);
      } catch (_) {}
    });
  }

  return sock;
}

// ── Helper: attach a listener for all non-official / unhandled WA nodes ──────
/**
 * onUnhandledNode(sock, callback)
 *
 * Convenience wrapper — calls callback(frame) for every WABinary node that
 * was not handled by any built-in Baileys handler.
 *
 * Usage:
 *   const { onUnhandledNode } = require("perezbaileys");
 *   onUnhandledNode(sock, (frame) => {
 *     console.log("Unhandled node:", frame.tag, frame.attrs);
 *   });
 */
function onUnhandledNode(sock, callback) {
  if (!sock || !sock.ev) throw new Error("perezbaileys: invalid socket passed to onUnhandledNode");
  sock.ev.on("node.unhandled", callback);
  return () => sock.ev.off("node.unhandled", callback); // returns an unsubscribe fn
}

// ── Re-export everything from the original Baileys so this is a drop-in ──────
module.exports = {
  ...baileys,
  default: makeWASocket,
  makeWASocket,
  onUnhandledNode,
  // Expose version info
  PEREZBAILEYS_VERSION: "1.0.0",
  BAILEYS_BASE_VERSION: baileys.version || "7.x",
};
