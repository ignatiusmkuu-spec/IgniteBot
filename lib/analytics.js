const db = require("./datastore");

const DEFAULTS = {
  totalMessages: 0,
  totalCommands: 0,
  uniqueUsers: [],
  commandStats: {},
  hourlyStats: {},
  recentActivity: [],
  startTime: new Date().toISOString(),
};

function trackMessage(jid, command = null) {
  db.update("analytics", DEFAULTS, (data) => {
    data.totalMessages = (data.totalMessages || 0) + 1;

    if (!data.uniqueUsers.includes(jid)) {
      data.uniqueUsers.push(jid);
    }

    const hour = new Date().toISOString().slice(0, 13);
    data.hourlyStats[hour] = (data.hourlyStats[hour] || 0) + 1;

    if (command) {
      data.totalCommands = (data.totalCommands || 0) + 1;
      data.commandStats[command] = (data.commandStats[command] || 0) + 1;
    }

    const activity = {
      time: new Date().toISOString(),
      user: jid.split("@")[0],
      action: command || "message",
    };
    data.recentActivity = [activity, ...(data.recentActivity || [])].slice(
      0,
      50
    );
  });
}

function getStats() {
  return db.read("analytics", DEFAULTS);
}

function getTopCommands(n = 10) {
  const stats = getStats();
  return Object.entries(stats.commandStats || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function getHourlyChart() {
  const stats = getStats();
  const hours = Object.entries(stats.hourlyStats || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24);
  return hours;
}

function formatStatsMessage() {
  const stats = getStats();
  const uptime = Math.floor(
    (Date.now() - new Date(stats.startTime).getTime()) / 1000 / 60
  );
  const topCmds = getTopCommands(5);

  let msg = `📊 *Bot Analytics*\n\n`;
  msg += `📨 Total Messages: *${stats.totalMessages}*\n`;
  msg += `⚙️ Commands Used: *${stats.totalCommands}*\n`;
  msg += `👥 Unique Users: *${stats.uniqueUsers.length}*\n`;
  msg += `⏱ Uptime: *${uptime} minutes*\n\n`;

  if (topCmds.length > 0) {
    msg += `🏆 *Top Commands:*\n`;
    topCmds.forEach(([cmd, count], i) => {
      msg += `${i + 1}. ${cmd}: ${count} uses\n`;
    });
  }

  return msg;
}

module.exports = { trackMessage, getStats, getTopCommands, getHourlyChart, formatStatsMessage };
