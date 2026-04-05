const { admins } = require("../config");
const db = require("./db");

const _participantCache = new Map();
const _CACHE_TTL = 12_000;

const SUDO_DEFAULTS = { sudos: [] };

function _normalizePhone(jid) {
  return (jid || "").split("@")[0].split(":")[0];
}

function getDynamicSudos() {
  return db.read("sudos", SUDO_DEFAULTS).sudos || [];
}

function addSudo(jid) {
  const phone = _normalizePhone(jid);
  db.update("sudos", SUDO_DEFAULTS, (data) => {
    if (!data.sudos) data.sudos = [];
    if (!data.sudos.includes(phone)) data.sudos.push(phone);
  });
}

function removeSudo(jid) {
  const phone = _normalizePhone(jid);
  db.update("sudos", SUDO_DEFAULTS, (data) => {
    data.sudos = (data.sudos || []).filter((n) => n !== phone);
  });
}

function isAdmin(jid, groupParticipants = []) {
  const phone = _normalizePhone(jid);
  if (admins.includes(phone) || admins.includes(jid)) return true;
  const dynSudos = getDynamicSudos();
  if (dynSudos.includes(phone)) return true;
  return groupParticipants.some(p => {
    const pPhone = _normalizePhone(p.id);
    return pPhone === phone && (p.admin === "admin" || p.admin === "superadmin");
  });
}

function isSuperAdmin(jid) {
  const phone = _normalizePhone(jid);
  if (admins.includes(phone) || admins.includes(jid)) return true;
  const dynSudos = getDynamicSudos();
  return dynSudos.includes(phone);
}

function getSenderAdminStatus(senderJid, groupParticipants = []) {
  const phone = _normalizePhone(senderJid);
  return groupParticipants.some(p => {
    const pPhone = _normalizePhone(p.id);
    return pPhone === phone && (p.admin === "admin" || p.admin === "superadmin");
  });
}

function getBotAdminStatus(botId, groupParticipants = []) {
  const botPhone = _normalizePhone(botId);
  return groupParticipants.some(p => {
    const pPhone = _normalizePhone(p.id);
    return pPhone === botPhone && (p.admin === "admin" || p.admin === "superadmin");
  });
}

async function kickMember(sock, groupJid, memberJid) {
  await sock.groupParticipantsUpdate(groupJid, [memberJid], "remove");
}

async function promoteMember(sock, groupJid, memberJid) {
  await sock.groupParticipantsUpdate(groupJid, [memberJid], "promote");
}

async function demoteMember(sock, groupJid, memberJid) {
  await sock.groupParticipantsUpdate(groupJid, [memberJid], "demote");
}

async function muteGroup(sock, groupJid) {
  await sock.groupSettingUpdate(groupJid, "announcement");
}

async function unmuteGroup(sock, groupJid) {
  await sock.groupSettingUpdate(groupJid, "not_announcement");
}

async function getGroupParticipants(sock, groupJid) {
  const now = Date.now();
  const hit = _participantCache.get(groupJid);
  if (hit && hit.expires > now) return hit.participants;
  try {
    const meta = await sock.groupMetadata(groupJid);
    _participantCache.set(groupJid, { participants: meta.participants, expires: now + _CACHE_TTL });
    return meta.participants;
  } catch {
    return [];
  }
}

function invalidateGroupCache(groupJid) {
  _participantCache.delete(groupJid);
}

module.exports = {
  isAdmin,
  isSuperAdmin,
  getSenderAdminStatus,
  getBotAdminStatus,
  addSudo,
  removeSudo,
  getDynamicSudos,
  kickMember,
  promoteMember,
  demoteMember,
  muteGroup,
  unmuteGroup,
  getGroupParticipants,
  invalidateGroupCache,
  _normalizePhone,
};
