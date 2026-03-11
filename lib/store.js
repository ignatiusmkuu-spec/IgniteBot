const db = require("./datastore");

function getDefaults(config) {
  return {
    products: config.defaultProducts,
    orders: [],
    nextOrderId: 1000,
  };
}

let _config = null;
function getConfig() {
  if (!_config) _config = require("../config");
  return _config;
}

function getData() {
  return db.read("store", getDefaults(getConfig()));
}

function getProducts() {
  return getData().products || [];
}

function getProduct(id) {
  return getProducts().find((p) => p.id === Number(id));
}

function addProduct(product) {
  const cfg = getConfig();
  db.update("store", getDefaults(cfg), (data) => {
    const maxId = data.products.reduce((m, p) => Math.max(m, p.id), 0);
    product.id = maxId + 1;
    data.products.push(product);
  });
}

function placeOrder(jid, productId, qty = 1) {
  const cfg = getConfig();
  const product = getProduct(productId);
  if (!product) return null;
  if (product.stock !== 999 && product.stock < qty) return { error: "Out of stock" };

  let order = null;
  db.update("store", getDefaults(cfg), (data) => {
    const orderId = data.nextOrderId++;
    order = {
      id: orderId,
      user: jid,
      productId: product.id,
      productName: product.name,
      qty,
      total: (product.price * qty).toFixed(2),
      status: "pending",
      time: new Date().toISOString(),
    };
    data.orders.push(order);
    if (product.stock !== 999) {
      const p = data.products.find((p) => p.id === product.id);
      if (p) p.stock -= qty;
    }
  });
  return order;
}

function getUserOrders(jid) {
  return getData().orders.filter((o) => o.user === jid);
}

function formatCatalog() {
  const products = getProducts();
  if (!products.length) return "🛒 No products available.";
  let msg = `🛒 *Product Catalog*\n\n`;
  for (const p of products) {
    msg += `${p.emoji || "📦"} *${p.name}*\n`;
    msg += `   ID: \`${p.id}\` | Price: *$${p.price}*\n`;
    msg += `   ${p.description}\n`;
    msg += `   Stock: ${p.stock === 999 ? "Unlimited" : p.stock}\n\n`;
  }
  msg += `_Type *!order [id]* to purchase_`;
  return msg;
}

module.exports = { getProducts, getProduct, addProduct, placeOrder, getUserOrders, formatCatalog };
