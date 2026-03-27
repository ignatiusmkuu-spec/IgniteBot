const db = require("./db");

const DEFAULT_PACKAGES = {
  safaricom: {
    daily: [
      { code: "SAF-D1", name: "40MB",  price: 10,  validity: "1 hr",   label: "Hourly Lite" },
      { code: "SAF-D2", name: "250MB", price: 20,  validity: "24 hrs", label: "Daily Lite" },
      { code: "SAF-D3", name: "1GB",   price: 50,  validity: "24 hrs", label: "Daily Standard" },
      { code: "SAF-D4", name: "2GB",   price: 99,  validity: "24 hrs", label: "Daily Plus" },
      { code: "SAF-D5", name: "3GB",   price: 149, validity: "24 hrs", label: "Daily Max" },
    ],
    weekly: [
      { code: "SAF-W1", name: "350MB",  price: 50,  validity: "7 days", label: "Weekly Lite" },
      { code: "SAF-W2", name: "1.5GB",  price: 100, validity: "7 days", label: "Weekly Standard" },
      { code: "SAF-W3", name: "5GB",    price: 300, validity: "7 days", label: "Weekly Plus" },
      { code: "SAF-W4", name: "10GB",   price: 500, validity: "7 days", label: "Weekly Max" },
    ],
    monthly: [
      { code: "SAF-M1", name: "1.5GB",  price: 150,  validity: "30 days", label: "Monthly Lite" },
      { code: "SAF-M2", name: "5GB",    price: 500,  validity: "30 days", label: "Monthly Standard" },
      { code: "SAF-M3", name: "10GB",   price: 1000, validity: "30 days", label: "Monthly Plus" },
      { code: "SAF-M4", name: "20GB",   price: 1500, validity: "30 days", label: "Monthly Max" },
      { code: "SAF-M5", name: "50GB",   price: 2500, validity: "30 days", label: "Monthly Ultra" },
    ],
  },
  airtel: {
    daily: [
      { code: "AIR-D1", name: "150MB",  price: 10, validity: "24 hrs", label: "Daily Lite" },
      { code: "AIR-D2", name: "350MB",  price: 20, validity: "24 hrs", label: "Daily Standard" },
      { code: "AIR-D3", name: "1GB",    price: 49, validity: "24 hrs", label: "Daily Plus" },
      { code: "AIR-D4", name: "3GB",    price: 99, validity: "24 hrs", label: "Daily Max" },
    ],
    weekly: [
      { code: "AIR-W1", name: "1GB",   price: 99,  validity: "7 days", label: "Weekly Lite" },
      { code: "AIR-W2", name: "3GB",   price: 199, validity: "7 days", label: "Weekly Standard" },
      { code: "AIR-W3", name: "8GB",   price: 399, validity: "7 days", label: "Weekly Plus" },
      { code: "AIR-W4", name: "20GB",  price: 799, validity: "7 days", label: "Weekly Max" },
    ],
    monthly: [
      { code: "AIR-M1", name: "2GB",   price: 299,  validity: "30 days", label: "Monthly Lite" },
      { code: "AIR-M2", name: "5GB",   price: 499,  validity: "30 days", label: "Monthly Standard" },
      { code: "AIR-M3", name: "10GB",  price: 999,  validity: "30 days", label: "Monthly Plus" },
      { code: "AIR-M4", name: "25GB",  price: 1999, validity: "30 days", label: "Monthly Max" },
    ],
  },
  telkom: {
    daily: [
      { code: "TEL-D1", name: "200MB",  price: 10,  validity: "24 hrs", label: "Daily Lite" },
      { code: "TEL-D2", name: "1GB",    price: 49,  validity: "24 hrs", label: "Daily Plus" },
      { code: "TEL-D3", name: "3GB",    price: 99,  validity: "24 hrs", label: "Daily Max" },
    ],
    weekly: [
      { code: "TEL-W1", name: "3GB",   price: 149, validity: "7 days", label: "Weekly Standard" },
      { code: "TEL-W2", name: "7GB",   price: 299, validity: "7 days", label: "Weekly Plus" },
      { code: "TEL-W3", name: "15GB",  price: 499, validity: "7 days", label: "Weekly Max" },
    ],
    monthly: [
      { code: "TEL-M1", name: "5GB",   price: 399,  validity: "30 days", label: "Monthly Standard" },
      { code: "TEL-M2", name: "15GB",  price: 799,  validity: "30 days", label: "Monthly Plus" },
      { code: "TEL-M3", name: "30GB",  price: 1299, validity: "30 days", label: "Monthly Max" },
    ],
  },
};

const PROVIDERS = {
  safaricom: { emoji: "🟢", full: "SAFARICOM", short: "saf" },
  airtel:    { emoji: "🔴", full: "AIRTEL",    short: "air" },
  telkom:    { emoji: "🔵", full: "TELKOM",    short: "tel" },
};

const CATEGORY_ICONS = {
  daily:   { icon: "📅", label: "DAILY",   sub: "24 hours" },
  weekly:  { icon: "📆", label: "WEEKLY",  sub: "7 days" },
  monthly: { icon: "🗓", label: "MONTHLY", sub: "30 days" },
};

function getPackages() {
  return db.read("_dataPackages", null) || DEFAULT_PACKAGES;
}

function savePackages(pkgs) {
  db.write("_dataPackages", pkgs);
}

function getPackageByCode(code) {
  const pkgs = getPackages();
  for (const [provider, cats] of Object.entries(pkgs)) {
    for (const [cat, list] of Object.entries(cats)) {
      const found = list.find(p => p.code.toLowerCase() === code.toLowerCase());
      if (found) return { ...found, provider, category: cat };
    }
  }
  return null;
}

function addPackage(provider, category, pkg) {
  const pkgs = getPackages();
  if (!pkgs[provider]) pkgs[provider] = {};
  if (!pkgs[provider][category]) pkgs[provider][category] = [];
  pkgs[provider][category] = pkgs[provider][category].filter(p => p.code !== pkg.code);
  pkgs[provider][category].push(pkg);
  savePackages(pkgs);
}

function removePackage(code) {
  const pkgs = getPackages();
  let removed = false;
  for (const provider of Object.keys(pkgs)) {
    for (const cat of Object.keys(pkgs[provider])) {
      const before = pkgs[provider][cat].length;
      pkgs[provider][cat] = pkgs[provider][cat].filter(p => p.code.toLowerCase() !== code.toLowerCase());
      if (pkgs[provider][cat].length < before) removed = true;
    }
  }
  if (removed) savePackages(pkgs);
  return removed;
}

function resetToDefault() {
  savePackages(DEFAULT_PACKAGES);
}

function buildProviderMenu(provider, websiteUrl) {
  const pkgs = getPackages();
  const info = PROVIDERS[provider];
  if (!info || !pkgs[provider]) return null;

  const cats = pkgs[provider];
  let lines = [];
  lines.push(`╔═══════════════════════════╗`);
  lines.push(`║  ${info.emoji} *${info.full} BUNDLES*  ║`);
  lines.push(`╚═══════════════════════════╝`);
  lines.push(`> 🌐 ${websiteUrl}`);
  lines.push(``);

  for (const [catKey, items] of Object.entries(cats)) {
    if (!items || !items.length) continue;
    const catInfo = CATEGORY_ICONS[catKey] || { icon: "📦", label: catKey.toUpperCase(), sub: "" };
    lines.push(`${catInfo.icon} *${catInfo.label} BUNDLES* _(${catInfo.sub})_`);
    lines.push(`┌─────────────────────────────`);
    for (const pkg of items) {
      lines.push(`│ *${pkg.code}*  •  ${pkg.name}  •  *Ksh ${pkg.price.toLocaleString()}*`);
    }
    lines.push(`└─────────────────────────────`);
    lines.push(``);
  }

  lines.push(`💬 *To buy:* _.data buy <code>_`);
  lines.push(`> Example: _.data buy SAF-D3_`);
  return lines.join("\n");
}

function buildAllMenu(websiteUrl) {
  const pkgs = getPackages();
  let lines = [];
  lines.push(`╔══════════════════════════════╗`);
  lines.push(`║   📦 *BINGWA DATA PACKAGES*  ║`);
  lines.push(`╚══════════════════════════════╝`);
  lines.push(`> 🌐 ${websiteUrl}`);
  lines.push(``);

  const tabs = Object.keys(PROVIDERS)
    .filter(p => pkgs[p])
    .map(p => `${PROVIDERS[p].emoji} *${PROVIDERS[p].full}*`)
    .join("   │   ");
  lines.push(tabs);
  lines.push(`━`.repeat(32));

  for (const [provider, info] of Object.entries(PROVIDERS)) {
    if (!pkgs[provider]) continue;
    lines.push(``);
    lines.push(`${info.emoji} *${info.full} BUNDLES*`);
    lines.push(`┄`.repeat(30));
    const cats = pkgs[provider];
    for (const [catKey, items] of Object.entries(cats)) {
      if (!items || !items.length) continue;
      const catInfo = CATEGORY_ICONS[catKey] || { icon: "📦", label: catKey.toUpperCase(), sub: "" };
      lines.push(`${catInfo.icon} *${catInfo.label}* _(${catInfo.sub})_`);
      for (const pkg of items) {
        lines.push(`  • *${pkg.code}* — ${pkg.name} — *Ksh ${pkg.price.toLocaleString()}*`);
      }
    }
  }

  lines.push(``);
  lines.push(`━`.repeat(32));
  lines.push(`💬 *To order:*  _.data buy <code>_`);
  lines.push(`📋 *Per provider:*  _.data safaricom_  •  _.data airtel_  •  _.data telkom_`);
  lines.push(`> Example: _.data buy SAF-M2_`);
  return lines.join("\n");
}

function buildOrderSummary(pkg, phone, websiteUrl) {
  const info = PROVIDERS[pkg.provider] || { emoji: "📦", full: pkg.provider.toUpperCase() };
  const catInfo = CATEGORY_ICONS[pkg.category] || { icon: "📦", label: pkg.category.toUpperCase() };
  return [
    `╔════════════════════════════╗`,
    `║  🛒 *ORDER CONFIRMATION*   ║`,
    `╚════════════════════════════╝`,
    ``,
    `${info.emoji} *Provider:*  ${info.full}`,
    `📦 *Package:*   ${pkg.name}`,
    `⏱ *Validity:*  ${pkg.validity}`,
    `💰 *Price:*     *Ksh ${pkg.price.toLocaleString()}*`,
    `📱 *For:*        ${phone}`,
    ``,
    `━`.repeat(30),
    `🌐 *Complete your order at:*`,
    `> ${websiteUrl}`,
    ``,
    `Or reply *CONFIRM* to proceed via M-Pesa`,
    `Reply *CANCEL* to cancel`,
  ].join("\n");
}

module.exports = {
  getPackages,
  savePackages,
  getPackageByCode,
  addPackage,
  removePackage,
  resetToDefault,
  buildAllMenu,
  buildProviderMenu,
  buildOrderSummary,
  PROVIDERS,
  DEFAULT_PACKAGES,
};
