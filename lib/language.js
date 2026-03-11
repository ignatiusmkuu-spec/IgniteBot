const db = require("./datastore");
const { supportedLanguages } = require("../config");

const DEFAULTS = { userLangs: {}, groupLangs: {} };

function getUserLang(jid) {
  const data = db.read("languages", DEFAULTS);
  return data.userLangs[jid] || "en";
}

function setUserLang(jid, lang) {
  if (!supportedLanguages[lang]) return false;
  db.update("languages", DEFAULTS, (data) => {
    data.userLangs[jid] = lang;
  });
  return true;
}

function getGroupLang(jid) {
  const data = db.read("languages", DEFAULTS);
  return data.groupLangs[jid] || "en";
}

function setGroupLang(jid, lang) {
  if (!supportedLanguages[lang]) return false;
  db.update("languages", DEFAULTS, (data) => {
    data.groupLangs[jid] = lang;
  });
  return true;
}

function getLangList() {
  return Object.entries(supportedLanguages)
    .map(([code, name]) => `*${code}* — ${name}`)
    .join("\n");
}

module.exports = { getUserLang, setUserLang, getGroupLang, setGroupLang, getLangList, supportedLanguages };
