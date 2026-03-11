const db = require("./datastore");
const { spamThreshold, spamWindowMs } = require("../config");

const DEFAULTS = {
  groupSettings: {},
  warnings: {},
  bannedUsers: [],
};

const spamTracker = new Map();
const messageCache = new Map();

const URL_REGEX =
  /(?:https?:\/\/|www\.)[a-zA-Z0-9-]+(?:\.[a-zA-Z]{2,})+(?:\/[^\s]*)?/gi;

function getGroupSettings(groupJid) {
  const data = db.read("security", DEFAULTS);
  return (
    data.groupSettings[groupJid] || {
      antiLink: false,
      antiSpam: true,
      antiDelete: false,
      linkWhitelist: [],
    }
  );
}

function setGroupSetting(groupJid, key, value) {
  db.update("security", DEFAULTS, (data) => {
    if (!data.groupSettings[groupJid]) {
      data.groupSettings[groupJid] = {
        antiLink: false,
        antiSpam: true,
        antiDelete: false,
        linkWhitelist: [],
      };
    }
    data.groupSettings[groupJid][key] = value;
  });
}

function isSpam(jid) {
  const now = Date.now();
  if (!spamTracker.has(jid)) {
    spamTracker.set(jid, []);
  }
  const times = spamTracker
    .get(jid)
    .filter((t) => now - t < spamWindowMs);
  times.push(now);
  spamTracker.set(jid, times);
  return times.length > spamThreshold;
}

function hasLink(text) {
  return URL_REGEX.test(text);
}

function cacheMessage(msgId, msg) {
  messageCache.set(msgId, {
    msg,
    time: Date.now(),
  });
  if (messageCache.size > 1000) {
    const oldest = [...messageCache.keys()][0];
    messageCache.delete(oldest);
  }
}

function getCachedMessage(msgId) {
  return messageCache.get(msgId);
}

function warnUser(jid) {
  let warns = 0;
  db.update("security", DEFAULTS, (data) => {
    data.warnings[jid] = (data.warnings[jid] || 0) + 1;
    warns = data.warnings[jid];
  });
  return warns;
}

function getWarnings(jid) {
  const data = db.read("security", DEFAULTS);
  return data.warnings[jid] || 0;
}

function clearWarnings(jid) {
  db.update("security", DEFAULTS, (data) => {
    data.warnings[jid] = 0;
  });
}

function isBanned(jid) {
  const data = db.read("security", DEFAULTS);
  return (data.bannedUsers || []).includes(jid);
}

function banUser(jid) {
  db.update("security", DEFAULTS, (data) => {
    if (!data.bannedUsers) data.bannedUsers = [];
    if (!data.bannedUsers.includes(jid)) data.bannedUsers.push(jid);
  });
}

function unbanUser(jid) {
  db.update("security", DEFAULTS, (data) => {
    data.bannedUsers = (data.bannedUsers || []).filter((u) => u !== jid);
  });
}

module.exports = {
  getGroupSettings,
  setGroupSetting,
  isSpam,
  hasLink,
  cacheMessage,
  getCachedMessage,
  warnUser,
  getWarnings,
  clearWarnings,
  isBanned,
  banUser,
  unbanUser,
};
