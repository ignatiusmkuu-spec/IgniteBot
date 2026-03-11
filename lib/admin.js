const { admins } = require("../config");
const db = require("./db");

const SUDO_DEFAULTS = { sudos: [] };

function getDynamicSudos() {
  return db.read("sudos", SUDO_DEFAULTS).sudos || [];
}

function addSudo(jid) {
  const phone = jid.split("@")[0].split(":")[0];
  db.update("sudos", SUDO_DEFAULTS, (data) => {
    if (!data.sudos) data.sudos = [];
    if (!data.sudos.includes(phone)) data.sudos.push(phone);
  });
}

function removeSudo(jid) {
  const phone = jid.split("@")[0].split(":")[0];
  db.update("sudos", SUDO_DEFAULTS, (data) => {
    data.sudos = (data.sudos || []).filter((n) => n !== phone);
  });
}

function isAdmin(jid, groupParticipants = []) {
  const phone = jid.split("@")[0].split(":")[0];
  if (admins.includes(phone) || admins.includes(jid)) return true;
  const dynSudos = getDynamicSudos();
  if (dynSudos.includes(phone)) return true;
  const participant = groupParticipants.find((p) => p.id === jid);
  return participant?.admin === "admin" || participant?.admin === "superadmin";
}

function isSuperAdmin(jid) {
  const phone = jid.split("@")[0].split(":")[0];
  if (admins.includes(phone) || admins.includes(jid)) return true;
  const dynSudos = getDynamicSudos();
  return dynSudos.includes(phone);
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
  try {
    const meta = await sock.groupMetadata(groupJid);
    return meta.participants;
  } catch {
    return [];
  }
}

module.exports = {
  isAdmin,
  isSuperAdmin,
  addSudo,
  removeSudo,
  getDynamicSudos,
  kickMember,
  promoteMember,
  demoteMember,
  muteGroup,
  unmuteGroup,
  getGroupParticipants,
};
