const { admins } = require("../config");

function isAdmin(jid, groupParticipants = []) {
  const phone = jid.split("@")[0].split(":")[0];
  if (admins.includes(phone) || admins.includes(jid)) return true;
  const participant = groupParticipants.find((p) => p.id === jid);
  return participant?.admin === "admin" || participant?.admin === "superadmin";
}

function isSuperAdmin(jid) {
  const phone = jid.split("@")[0].split(":")[0];
  return admins.includes(phone) || admins.includes(jid);
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
  kickMember,
  promoteMember,
  demoteMember,
  muteGroup,
  unmuteGroup,
  getGroupParticipants,
};
