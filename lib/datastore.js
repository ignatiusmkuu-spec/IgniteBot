const { loadJSON, saveJSON } = require("../config");

const stores = {};

function get(name) {
  if (!stores[name]) {
    stores[name] = { data: null };
  }
  return stores[name];
}

function read(name, defaults = {}) {
  const store = get(name);
  if (!store.data) {
    store.data = loadJSON(name, defaults);
  }
  return store.data;
}

function write(name, data) {
  const store = get(name);
  store.data = data;
  saveJSON(name, data);
}

function update(name, defaults, updater) {
  const data = read(name, defaults);
  updater(data);
  write(name, data);
}

module.exports = { read, write, update };
