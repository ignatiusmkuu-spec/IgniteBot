const db = require("./datastore");

const DEFAULTS = { history: [], recipients: [] };

function addRecipient(jid) {
  db.update("broadcast", DEFAULTS, (data) => {
    if (!data.recipients.includes(jid)) data.recipients.push(jid);
  });
}

function removeRecipient(jid) {
  db.update("broadcast", DEFAULTS, (data) => {
    data.recipients = data.recipients.filter((r) => r !== jid);
  });
}

function getRecipients() {
  return db.read("broadcast", DEFAULTS).recipients;
}

async function broadcast(sock, message, recipients) {
  const results = { sent: 0, failed: 0 };
  for (const jid of recipients) {
    try {
      await sock.sendMessage(jid, { text: message });
      results.sent++;
      await new Promise((r) => setTimeout(r, 500));
    } catch {
      results.failed++;
    }
  }
  db.update("broadcast", DEFAULTS, (data) => {
    data.history.unshift({
      message: message.slice(0, 100),
      sent: results.sent,
      failed: results.failed,
      time: new Date().toISOString(),
    });
    data.history = data.history.slice(0, 20);
  });
  return results;
}

function getBroadcastHistory() {
  return db.read("broadcast", DEFAULTS).history;
}

module.exports = { addRecipient, removeRecipient, getRecipients, broadcast, getBroadcastHistory };
