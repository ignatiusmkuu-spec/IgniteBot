const db = require("./datastore");

const DEFAULTS = {
  triggers: [
    {
      keyword: "hello",
      response: "👋 Hi there! Type *!menu* to see what I can do.",
      exact: false,
    },
    {
      keyword: "price",
      response: "💰 Check our products with *!shop*",
      exact: false,
    },
    {
      keyword: "help me",
      response: "🤝 I'm here to help! Type *!help* for a full list of commands.",
      exact: false,
    },
  ],
};

function getAll() {
  return db.read("keywords", DEFAULTS).triggers || [];
}

function add(keyword, response, exact = false) {
  db.update("keywords", DEFAULTS, (data) => {
    const existing = data.triggers.findIndex(
      (t) => t.keyword.toLowerCase() === keyword.toLowerCase()
    );
    if (existing >= 0) {
      data.triggers[existing] = { keyword, response, exact };
    } else {
      data.triggers.push({ keyword, response, exact });
    }
  });
}

function remove(keyword) {
  db.update("keywords", DEFAULTS, (data) => {
    data.triggers = data.triggers.filter(
      (t) => t.keyword.toLowerCase() !== keyword.toLowerCase()
    );
  });
}

function match(text) {
  const lower = text.toLowerCase();
  const triggers = getAll();
  for (const t of triggers) {
    if (t.exact) {
      if (lower === t.keyword.toLowerCase()) return t.response;
    } else {
      if (lower.includes(t.keyword.toLowerCase())) return t.response;
    }
  }
  return null;
}

module.exports = { getAll, add, remove, match };
