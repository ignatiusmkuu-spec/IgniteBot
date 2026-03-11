const db = require("./datastore");

const DEFAULTS = { welcomeMessages: {}, goodbyeMessages: {}, groupData: {} };

function setWelcomeMessage(groupJid, message) {
  db.update("groups", DEFAULTS, (data) => {
    data.welcomeMessages[groupJid] = message;
  });
}

function getWelcomeMessage(groupJid) {
  const data = db.read("groups", DEFAULTS);
  return (
    data.welcomeMessages[groupJid] ||
    "👋 Welcome to the group, @{{name}}! 🎉\nPlease read the group rules."
  );
}

function setGoodbyeMessage(groupJid, message) {
  db.update("groups", DEFAULTS, (data) => {
    data.goodbyeMessages[groupJid] = message;
  });
}

function getGoodbyeMessage(groupJid) {
  const data = db.read("groups", DEFAULTS);
  return data.goodbyeMessages[groupJid] || "👋 @{{name}} has left the group. Goodbye!";
}

async function sendWelcome(sock, groupJid, newMemberJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const participant = meta.participants.find((p) => p.id === newMemberJid);
    const name = participant?.notify || newMemberJid.split("@")[0];
    const template = getWelcomeMessage(groupJid);
    const message = template
      .replace(/{{name}}/g, name)
      .replace(/{{group}}/g, meta.subject);

    await sock.sendMessage(groupJid, {
      text: message,
      mentions: [newMemberJid],
    });
  } catch (err) {
    console.error("Welcome message error:", err.message);
  }
}

async function sendGoodbye(sock, groupJid, removedMemberJid) {
  try {
    const name = removedMemberJid.split("@")[0];
    const template = getGoodbyeMessage(groupJid);
    const message = template.replace(/{{name}}/g, name);
    await sock.sendMessage(groupJid, {
      text: message,
      mentions: [removedMemberJid],
    });
  } catch (err) {
    console.error("Goodbye message error:", err.message);
  }
}

async function tagAll(sock, groupJid, message = "") {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const mentions = meta.participants.map((p) => p.id);
    const tags = mentions.map((jid) => `@${jid.split("@")[0]}`).join(" ");
    await sock.sendMessage(groupJid, {
      text: `${message}\n${tags}`,
      mentions,
    });
  } catch (err) {
    throw new Error(`Tag all failed: ${err.message}`);
  }
}

async function getGroupInfo(sock, groupJid) {
  try {
    const meta = await sock.groupMetadata(groupJid);
    const admins = meta.participants.filter((p) => p.admin).map((p) => p.id);
    return {
      name: meta.subject,
      description: meta.desc,
      memberCount: meta.participants.length,
      admins: admins.length,
      creation: new Date(meta.creation * 1000).toLocaleDateString(),
    };
  } catch {
    return null;
  }
}

module.exports = {
  setWelcomeMessage,
  getWelcomeMessage,
  setGoodbyeMessage,
  getGoodbyeMessage,
  sendWelcome,
  sendGoodbye,
  tagAll,
  getGroupInfo,
};
