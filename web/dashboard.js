const express = require("express");
const router = express.Router();
const analytics = require("../lib/analytics");
const { getProducts } = require("../lib/store");
const { getAllBookings } = require("../lib/booking");
const { getBroadcastHistory } = require("../lib/broadcast");

router.get("/dashboard", (req, res) => {
  const tab = req.query.tab || "overview";
  res.send(getDashboardHTML(tab));
});

router.get("/add-session", (req, res) => {
  res.redirect("/dashboard?tab=add");
});

router.get("/api/stats", async (req, res) => {
  const stats = await analytics.getStats();
  const topCommands = await analytics.getTopCommands(10);
  const hourly = await analytics.getHourlyChart();
  res.json({ stats, topCommands, hourly });
});

router.get("/api/products", (req, res) => {
  res.json(getProducts());
});

router.get("/api/bookings", (req, res) => {
  res.json(getAllBookings().slice(0, 20));
});

router.get("/api/broadcasts", (req, res) => {
  res.json(getBroadcastHistory());
});

function getDashboardHTML(activeTab) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEXUS-MD · Control Centre</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Orbitron:wght@400;600;700;900&family=Syne:wght@400;600;700;800&display=swap');

:root {
  --bg:       #020510;
  --bg2:      #060d1f;
  --bg3:      #0a1628;
  --border:   rgba(0,212,255,0.12);
  --border2:  rgba(168,85,247,0.15);
  --cyan:     #00d4ff;
  --purple:   #a855f7;
  --blue:     #3b82f6;
  --green:    #10b981;
  --red:      #ef4444;
  --gold:     #f59e0b;
  --text:     #e2e8f0;
  --muted:    #64748b;
  --glass:    rgba(6,13,31,0.7);
  --glow-c:   0 0 20px rgba(0,212,255,0.3);
  --glow-p:   0 0 20px rgba(168,85,247,0.3);
  --glow-b:   0 0 20px rgba(59,130,246,0.3);
}

*{box-sizing:border-box;margin:0;padding:0}

html{scroll-behavior:smooth}

body {
  font-family:'Space Grotesk',system-ui,sans-serif;
  background:var(--bg);
  color:var(--text);
  min-height:100vh;
  overflow-x:hidden;
}

/* ── Animated grid background ── */
body::before {
  content:'';
  position:fixed;
  inset:0;
  background-image:
    linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px);
  background-size:40px 40px;
  pointer-events:none;
  z-index:0;
}

body::after {
  content:'';
  position:fixed;
  top:-50%;left:-50%;
  width:200%;height:200%;
  background:radial-gradient(ellipse at 20% 50%, rgba(168,85,247,0.04) 0%, transparent 50%),
             radial-gradient(ellipse at 80% 20%, rgba(0,212,255,0.04) 0%, transparent 50%);
  pointer-events:none;
  z-index:0;
}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:4px;height:4px}
::-webkit-scrollbar-track{background:var(--bg)}
::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.3);border-radius:2px}
::-webkit-scrollbar-thumb:hover{background:var(--cyan)}

/* ── Layout ── */
.layout{position:relative;z-index:1;display:flex;flex-direction:column;min-height:100vh}

/* ── Header ── */
.header {
  position:sticky;top:0;z-index:100;
  background:rgba(2,5,16,0.85);
  backdrop-filter:blur(20px);
  -webkit-backdrop-filter:blur(20px);
  border-bottom:1px solid var(--border);
  padding:0 28px;
  height:64px;
  display:flex;align-items:center;gap:16px;
}

.header-logo {
  display:flex;align-items:center;gap:10px;
  text-decoration:none;
}

.logo-icon {
  width:36px;height:36px;
  background:linear-gradient(135deg,var(--cyan),var(--purple));
  border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-size:16px;
  box-shadow:var(--glow-c);
  flex-shrink:0;
}

.logo-text {
  font-size:1.1rem;font-weight:700;
  background:linear-gradient(90deg,var(--cyan),var(--purple));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;
  letter-spacing:0.5px;
}

.header-spacer{flex:1}

.status-pill {
  display:flex;align-items:center;gap:7px;
  background:var(--bg3);
  border:1px solid var(--border);
  border-radius:999px;
  padding:5px 14px;
  font-size:0.72rem;font-weight:600;
  letter-spacing:0.5px;
  text-transform:uppercase;
}

.pulse {
  width:7px;height:7px;border-radius:50%;
  background:var(--cyan);
  box-shadow:0 0 6px var(--cyan);
  animation:pulse 2s infinite;
}
.pulse.red{background:var(--red);box-shadow:0 0 6px var(--red)}
.pulse.gold{background:var(--gold);box-shadow:0 0 6px var(--gold)}

@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(0.85)}}

.platform-chip {
  background:var(--bg3);
  border:1px solid var(--border2);
  border-radius:6px;
  padding:4px 10px;
  font-size:0.72rem;color:var(--muted);
  font-family:'JetBrains Mono',monospace;
}

/* ── Nav tabs ── */
.nav {
  background:rgba(6,13,31,0.6);
  backdrop-filter:blur(12px);
  border-bottom:1px solid var(--border);
  padding:0 28px;
  display:flex;gap:0;
  overflow-x:auto;
}
.nav::-webkit-scrollbar{height:2px}

.nav-tab {
  position:relative;
  padding:16px 20px;
  font-size:0.82rem;font-weight:500;
  color:var(--muted);
  cursor:pointer;
  border-bottom:2px solid transparent;
  text-decoration:none;
  display:flex;align-items:center;gap:7px;
  white-space:nowrap;
  transition:color .2s;
  letter-spacing:0.3px;
}
.nav-tab:hover{color:var(--text)}
.nav-tab.active{color:var(--cyan);border-bottom-color:var(--cyan);font-weight:600}
.nav-tab.active::after {
  content:'';
  position:absolute;bottom:-1px;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,var(--cyan),transparent);
  filter:blur(2px);
}
.nav-tab.t-setup{color:#f59e0b}
.nav-tab.t-setup.active{color:#f59e0b;border-bottom-color:#f59e0b}
.nav-tab.t-setup.active::after{background:linear-gradient(90deg,transparent,#f59e0b,transparent)}
.nav-tab.t-add{color:var(--green)}
.nav-tab.t-add.active{color:var(--green);border-bottom-color:var(--green)}
.nav-tab.t-add.active::after{background:linear-gradient(90deg,transparent,var(--green),transparent)}

.tab-icon{font-size:0.9rem;opacity:0.8}

/* ── Container ── */
.container{max-width:1240px;margin:0 auto;padding:28px 28px;flex:1}

/* ── Glass card ── */
.card {
  background:var(--glass);
  backdrop-filter:blur(16px);
  border:1px solid var(--border);
  border-radius:16px;
  padding:22px;
  transition:border-color .3s,box-shadow .3s;
  position:relative;
  overflow:hidden;
}
.card::before {
  content:'';
  position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(0,212,255,0.03) 0%,transparent 60%);
  pointer-events:none;
}
.card:hover{border-color:rgba(0,212,255,0.25);box-shadow:var(--glow-c)}

.card-label {
  font-size:0.68rem;font-weight:600;
  color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;
  margin-bottom:10px;display:flex;align-items:center;gap:6px;
}
.card-value {
  font-size:2.2rem;font-weight:700;
  background:linear-gradient(135deg,var(--cyan),var(--blue));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  background-clip:text;line-height:1;
}
.card-sub{font-size:0.75rem;color:var(--muted);margin-top:6px}

/* ── Stat grid ── */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px;margin-bottom:22px}

/* ── Section ── */
.section {
  background:var(--glass);
  backdrop-filter:blur(16px);
  border:1px solid var(--border);
  border-radius:16px;
  padding:24px;
  margin-bottom:18px;
}
.section-title {
  font-size:0.85rem;font-weight:600;
  color:var(--text);
  margin-bottom:18px;
  display:flex;align-items:center;gap:8px;
  letter-spacing:0.3px;
}
.section-title::after{
  content:'';flex:1;height:1px;
  background:linear-gradient(90deg,var(--border),transparent);
}

/* ── Table ── */
table{width:100%;border-collapse:collapse}
th {
  text-align:left;font-size:0.68rem;
  color:var(--muted);text-transform:uppercase;letter-spacing:1px;
  padding:10px 14px;
  border-bottom:1px solid var(--border);
  font-family:'JetBrains Mono',monospace;
}
td{padding:11px 14px;border-bottom:1px solid rgba(0,212,255,0.05);font-size:0.85rem}
tr:last-child td{border-bottom:none}
tr:hover td{background:rgba(0,212,255,0.03)}

/* ── Progress bar ── */
.prog-wrap{height:4px;background:rgba(0,212,255,0.08);border-radius:2px;margin-top:6px;overflow:hidden}
.prog-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--cyan),var(--purple));box-shadow:0 0 8px var(--cyan)}

/* ── Badge ── */
.badge{display:inline-flex;align-items:center;padding:3px 10px;border-radius:6px;font-size:0.72rem;font-weight:600;letter-spacing:0.3px}
.badge.confirmed{background:rgba(16,185,129,0.12);color:var(--green);border:1px solid rgba(16,185,129,0.2)}
.badge.pending{background:rgba(245,158,11,0.12);color:var(--gold);border:1px solid rgba(245,158,11,0.2)}
.badge.cancelled{background:rgba(239,68,68,0.12);color:var(--red);border:1px solid rgba(239,68,68,0.2)}

/* ── Session ID box ── */
.sid-outer{
  background:rgba(0,0,0,0.4);
  border:1px solid var(--border);
  border-radius:14px;
  padding:20px;
  margin-bottom:18px;
}
.sid-label{font-size:0.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;font-family:'JetBrains Mono',monospace}
.sid-box{
  background:rgba(0,0,0,0.5);
  border:1px solid rgba(0,212,255,0.2);
  border-radius:10px;
  padding:16px;
  font-family:'JetBrains Mono',monospace;
  font-size:0.76rem;
  color:var(--cyan);
  word-break:break-all;
  max-height:110px;overflow-y:auto;
  line-height:1.6;
  cursor:text;user-select:all;
  box-shadow:inset 0 0 20px rgba(0,212,255,0.04);
}
.sid-actions{display:flex;gap:10px;margin-top:14px;flex-wrap:wrap}

/* ── Buttons ── */
.btn {
  display:inline-flex;align-items:center;gap:6px;
  padding:9px 18px;
  border-radius:10px;border:none;
  cursor:pointer;font-size:0.82rem;font-weight:600;
  font-family:'Space Grotesk',system-ui,sans-serif;
  letter-spacing:0.3px;
  transition:all .2s;
  text-decoration:none;
  white-space:nowrap;
}
.btn:hover{transform:translateY(-1px)}
.btn:active{transform:translateY(0)}

.btn-cyan{
  background:linear-gradient(135deg,rgba(0,212,255,0.15),rgba(0,212,255,0.08));
  color:var(--cyan);
  border:1px solid rgba(0,212,255,0.3);
}
.btn-cyan:hover{background:linear-gradient(135deg,rgba(0,212,255,0.25),rgba(0,212,255,0.15));box-shadow:var(--glow-c)}

.btn-purple{
  background:linear-gradient(135deg,rgba(168,85,247,0.15),rgba(168,85,247,0.08));
  color:var(--purple);
  border:1px solid rgba(168,85,247,0.3);
}
.btn-purple:hover{background:linear-gradient(135deg,rgba(168,85,247,0.25),rgba(168,85,247,0.15));box-shadow:var(--glow-p)}

.btn-green{
  background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(16,185,129,0.08));
  color:var(--green);
  border:1px solid rgba(16,185,129,0.3);
}
.btn-green:hover{background:linear-gradient(135deg,rgba(16,185,129,0.25),rgba(16,185,129,0.15));box-shadow:0 0 20px rgba(16,185,129,0.3)}

.btn-gold{
  background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.08));
  color:var(--gold);
  border:1px solid rgba(245,158,11,0.3);
}
.btn-gold:hover{box-shadow:0 0 20px rgba(245,158,11,0.3)}

.btn-ghost{
  background:rgba(255,255,255,0.04);
  color:var(--muted);
  border:1px solid var(--border);
}
.btn-ghost:hover{color:var(--text);background:rgba(255,255,255,0.08)}

.btn-solid-cyan{
  background:linear-gradient(135deg,var(--cyan),#0ea5e9);
  color:#000;
  border:none;
  font-weight:700;
}
.btn-solid-cyan:hover{box-shadow:var(--glow-c);filter:brightness(1.1)}

/* ── Info grid ── */
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:18px}
.info-item{
  background:rgba(0,0,0,0.3);
  border:1px solid var(--border);
  border-radius:12px;
  padding:16px;
}
.info-label{font-size:0.68rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:7px;font-family:'JetBrains Mono',monospace}
.info-val{font-size:1rem;font-weight:600;color:var(--text)}

/* ── Status dot ── */
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;vertical-align:middle}
.dot-green{background:var(--green);box-shadow:0 0 6px var(--green)}
.dot-red{background:var(--red);box-shadow:0 0 6px var(--red)}
.dot-gold{background:var(--gold);box-shadow:0 0 6px var(--gold)}

/* ── Form ── */
.form-section{
  background:var(--glass);
  backdrop-filter:blur(16px);
  border:1px solid var(--border);
  border-radius:16px;
  padding:26px;
  margin-bottom:18px;
}
.form-section-title{
  font-size:0.9rem;font-weight:700;
  color:var(--text);
  margin-bottom:5px;
  background:linear-gradient(90deg,var(--cyan),var(--purple));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.form-section-sub{font-size:0.8rem;color:var(--muted);margin-bottom:20px;line-height:1.5}

.form-group{margin-bottom:18px}
.form-label{
  display:block;font-size:0.72rem;font-weight:600;
  color:var(--muted);text-transform:uppercase;letter-spacing:1px;
  margin-bottom:7px;font-family:'JetBrains Mono',monospace;
}
.form-input,.form-select {
  width:100%;
  background:rgba(0,0,0,0.4);
  border:1px solid var(--border);
  border-radius:10px;
  padding:11px 14px;
  color:var(--text);
  font-size:0.85rem;
  outline:none;
  transition:border .2s,box-shadow .2s;
  font-family:'Space Grotesk',system-ui,sans-serif;
}
.form-input:focus,.form-select:focus{
  border-color:rgba(0,212,255,0.4);
  box-shadow:0 0 0 3px rgba(0,212,255,0.08);
}
.form-input::placeholder{color:#334155}
.form-input:disabled{opacity:.4;cursor:not-allowed}
.form-hint{font-size:0.72rem;color:var(--muted);margin-top:5px;line-height:1.4}
.form-hint a{color:var(--cyan);text-decoration:none}
.form-hint a:hover{text-decoration:underline}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:600px){.form-row{grid-template-columns:1fr}}

/* ── Platform section ── */
.platform-section{
  background:rgba(0,0,0,0.3);
  border:1px solid var(--border2);
  border-radius:12px;
  padding:18px;
  margin-bottom:18px;
}
.platform-section-title{
  font-size:0.82rem;font-weight:600;color:var(--text);
  margin-bottom:14px;display:flex;align-items:center;gap:7px;
}

/* ── Alert ── */
.alert{
  padding:13px 16px;
  border-radius:10px;
  font-size:0.82rem;
  margin-bottom:16px;
  line-height:1.5;
  display:flex;align-items:flex-start;gap:8px;
}
.alert-warn{background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);color:#fbbf24}
.alert-success{background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);color:var(--green)}
.alert-info{background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);color:#60a5fa}

/* ── Steps ── */
.steps{display:flex;flex-direction:column;gap:14px}
.step{display:flex;gap:14px;align-items:flex-start}
.step-num{
  background:linear-gradient(135deg,var(--cyan),var(--purple));
  color:#000;border-radius:50%;
  width:26px;height:26px;min-width:26px;
  display:flex;align-items:center;justify-content:center;
  font-size:0.75rem;font-weight:700;flex-shrink:0;margin-top:1px;
}
.step-text{font-size:0.85rem;color:var(--text);line-height:1.6}
.step-text code{
  background:rgba(0,212,255,0.1);
  border:1px solid rgba(0,212,255,0.2);
  padding:1px 7px;border-radius:5px;
  font-family:'JetBrains Mono',monospace;
  font-size:0.78rem;color:var(--cyan);
}

/* ── Chart ── */
.chart-wrap{display:flex;gap:3px;align-items:flex-end;height:64px;margin:12px 0 4px}
.chart-bar{
  flex:1;min-width:4px;border-radius:3px 3px 0 0;
  background:linear-gradient(180deg,var(--cyan),var(--blue));
  opacity:.7;transition:opacity .2s,box-shadow .2s;
  box-shadow:0 0 6px rgba(0,212,255,0.2);
}
.chart-bar:hover{opacity:1;box-shadow:0 0 12px rgba(0,212,255,0.5)}
.chart-labels{display:flex;gap:3px;font-size:0.65rem;color:var(--muted);font-family:'JetBrains Mono',monospace}

/* ── Region radio ── */
.region-opt{
  display:flex;align-items:center;gap:12px;
  background:rgba(0,0,0,0.3);
  border:2px solid var(--border);
  border-radius:10px;padding:14px 16px;
  cursor:pointer;transition:border-color .2s,background .2s;
  font-size:0.85rem;
}
.region-opt.selected{border-color:rgba(0,212,255,0.4);background:rgba(0,212,255,0.05)}
.region-opt input[type=radio]{accent-color:var(--cyan);width:15px;height:15px}

/* ── Resource row ── */
.resource-row{
  display:flex;align-items:center;justify-content:space-between;
  background:rgba(0,0,0,0.25);
  border:1px solid var(--border);
  border-radius:10px;padding:13px 16px;
  margin-bottom:10px;
}
.resource-icon{font-size:1.2rem;margin-right:10px}
.resource-name{font-size:0.88rem;color:var(--text)}
.resource-sub{font-size:0.72rem;color:var(--muted);margin-top:2px;font-family:'JetBrains Mono',monospace}
.resource-price{font-size:0.8rem;color:var(--muted);font-family:'JetBrains Mono',monospace}

/* ── Badge required ── */
.req-badge{font-size:0.65rem;background:rgba(239,68,68,0.15);color:var(--red);border:1px solid rgba(239,68,68,0.25);padding:2px 7px;border-radius:5px;margin-left:6px;vertical-align:middle}

/* ── Hidden ── */
.hidden{display:none!important}

/* ── Pairing Site Bar ── */
/* ── NEXUS Repo Bar ────────────────────────────────────────────────────── */
/* ── Nexus Pairing Card (nx-card) ── */
.nx-card{
  position:relative;
  margin-top:18px;
  border-radius:24px;
  overflow:hidden;
  background:linear-gradient(150deg,#040e1c 0%,#060f1e 55%,#050c18 100%);
  box-shadow:
    0 0 0 1px rgba(0,212,255,0.18),
    0 0 0 2px rgba(168,85,247,0.07),
    0 24px 70px rgba(0,0,0,0.85),
    0 0 100px rgba(0,212,255,0.04);
}
/* animated rainbow top border */
.nx-card::before{
  content:'';
  position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,#7c3aed,#00d4ff,#10b981,#a855f7,#00d4ff,#7c3aed);
  background-size:400% 100%;
  animation:nx-border-run 5s linear infinite;
  z-index:4;
}
/* diagonal scanline texture */
.nx-card::after{
  content:'';
  position:absolute;inset:0;
  background:repeating-linear-gradient(
    -48deg,
    transparent,transparent 4px,
    rgba(0,212,255,0.013) 4px,rgba(0,212,255,0.013) 5px
  );
  pointer-events:none;z-index:0;
}
@keyframes nx-border-run{0%{background-position:0%}100%{background-position:400%}}
/* ambient glow orbs */
.nx-glow-orb{position:absolute;pointer-events:none;border-radius:50%;filter:blur(70px);z-index:0}
.nx-glow-orb1{width:220px;height:220px;background:rgba(0,212,255,0.07);top:-70px;left:-30px}
.nx-glow-orb2{width:160px;height:160px;background:rgba(168,85,247,0.07);bottom:-50px;right:50px}
/* body row */
.nx-card-body{
  position:relative;z-index:1;
  padding:26px 30px;
  display:flex;align-items:center;gap:26px;
  flex-wrap:wrap;
}
/* icon cluster */
.nx-icon-cluster{
  position:relative;
  width:72px;height:72px;min-width:72px;
  display:flex;align-items:center;justify-content:center;
}
.nx-icon-orbit1{
  position:absolute;inset:-11px;border-radius:26px;
  border:1.5px solid rgba(0,212,255,0.22);
  animation:nx-orbit 4s ease-in-out infinite;
}
.nx-icon-orbit2{
  position:absolute;inset:-22px;border-radius:36px;
  border:1px dashed rgba(168,85,247,0.16);
  animation:nx-orbit 4s ease-in-out infinite reverse;
  animation-delay:.9s;
}
@keyframes nx-orbit{
  0%,100%{opacity:.3;transform:scale(1) rotate(0deg)}
  50%{opacity:.9;transform:scale(1.06) rotate(4deg)}
}
.nx-icon-core{
  width:72px;height:72px;
  background:linear-gradient(135deg,rgba(0,212,255,0.15),rgba(168,85,247,0.23));
  border:1.5px solid rgba(0,212,255,0.38);
  border-radius:22px;
  display:flex;align-items:center;justify-content:center;
  font-size:30px;
  position:relative;z-index:1;
  box-shadow:0 0 45px rgba(0,212,255,0.28),inset 0 0 28px rgba(0,212,255,0.07);
  animation:nx-icon-pulse 3s ease-in-out infinite;
}
@keyframes nx-icon-pulse{
  0%,100%{box-shadow:0 0 45px rgba(0,212,255,0.28),inset 0 0 28px rgba(0,212,255,0.07)}
  50%{box-shadow:0 0 80px rgba(0,212,255,0.58),0 0 110px rgba(168,85,247,0.2),inset 0 0 40px rgba(0,212,255,0.14)}
}
/* center text */
.nx-card-main{flex:1;min-width:220px}
.nx-badge{
  display:inline-flex;align-items:center;gap:7px;
  padding:4px 12px;
  border-radius:999px;
  background:rgba(16,185,129,0.1);
  border:1px solid rgba(16,185,129,0.32);
  font-family:'Syne',sans-serif;
  font-size:0.58rem;font-weight:800;
  text-transform:uppercase;letter-spacing:2.2px;
  color:#10b981;
  margin-bottom:9px;
}
.nx-badge-dot{
  width:6px;height:6px;border-radius:50%;
  background:#10b981;
  box-shadow:0 0 7px #10b981;
  animation:pulse 1.5s infinite;
}
.nx-title{
  font-family:'Orbitron',monospace;
  font-size:1.12rem;font-weight:900;
  background:linear-gradient(90deg,#00d4ff 0%,#a855f7 40%,#00d4ff 80%);
  background-size:200%;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  animation:nx-shine 4s linear infinite;
  margin-bottom:9px;
  letter-spacing:2px;line-height:1.2;
}
@keyframes nx-shine{0%{background-position:0%}100%{background-position:200%}}
.nx-url-pill{
  display:inline-flex;align-items:center;gap:7px;
  padding:5px 13px;
  border-radius:999px;
  background:rgba(0,212,255,0.07);
  border:1px solid rgba(0,212,255,0.22);
  font-family:'JetBrains Mono',monospace;
  font-size:0.7rem;
  color:rgba(0,212,255,0.85);
  text-decoration:none;
  margin-bottom:11px;
  transition:all .22s;
  width:fit-content;
}
.nx-url-pill:hover{
  background:rgba(0,212,255,0.14);
  border-color:rgba(0,212,255,0.45);
  color:#00d4ff;
  box-shadow:0 0 22px rgba(0,212,255,0.22);
}
.nx-url-arrow{
  color:rgba(168,85,247,0.85);
  transition:transform .2s;font-style:normal;
}
.nx-url-pill:hover .nx-url-arrow{transform:translate(2px,-2px)}
.nx-desc{
  font-size:0.75rem;color:rgba(255,255,255,0.42);
  line-height:1.6;margin-bottom:11px;
  font-family:'Space Grotesk',sans-serif;max-width:460px;
}
.nx-chips{display:flex;gap:5px;flex-wrap:wrap}
.nx-chip{
  display:inline-flex;align-items:center;gap:4px;
  padding:3px 10px;border-radius:999px;
  font-size:0.6rem;font-weight:700;
  text-transform:uppercase;letter-spacing:0.8px;
  font-family:'Syne',sans-serif;
}
.nx-chip-green{background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);color:#10b981}
.nx-chip-cyan{background:rgba(0,212,255,0.08);border:1px solid rgba(0,212,255,0.22);color:#00d4ff}
.nx-chip-purple{background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.26);color:#a855f7}
.nx-chip-dot{
  width:5px;height:5px;border-radius:50%;
  background:currentColor;box-shadow:0 0 5px currentColor;
  animation:pulse 2s infinite;
}
/* right CTA column */
.nx-card-action{
  display:flex;flex-direction:column;align-items:center;gap:10px;
  flex-shrink:0;
}
.nx-scan-hint{
  font-size:0.6rem;color:rgba(255,255,255,0.28);
  font-family:'JetBrains Mono',monospace;
  text-align:center;letter-spacing:0.3px;
}
/* CTA button */
.nx-cta{
  display:inline-flex;flex-direction:column;align-items:center;gap:5px;
  padding:16px 34px;border-radius:18px;
  background:linear-gradient(135deg,#00afd4 0%,#7c3aed 100%);
  color:#fff;font-family:'Orbitron',monospace;
  font-size:0.75rem;font-weight:900;
  text-decoration:none;letter-spacing:1.5px;text-transform:uppercase;
  white-space:nowrap;border:none;cursor:pointer;
  transition:all .3s cubic-bezier(.4,0,.2,1);
  box-shadow:
    0 8px 34px rgba(0,175,212,0.42),
    0 2px 0 rgba(255,255,255,0.15) inset,
    0 0 0 1px rgba(255,255,255,0.07) inset;
  position:relative;overflow:hidden;
  min-width:164px;text-align:center;
}
.nx-cta-sweep{
  position:absolute;top:-50%;left:-60%;
  width:55%;height:200%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.18),transparent);
  transform:skewX(-20deg);
  animation:nx-sweep 3.5s ease-in-out infinite;
  pointer-events:none;
}
@keyframes nx-sweep{0%{left:-60%}60%,100%{left:160%}}
.nx-cta:hover{
  transform:translateY(-4px) scale(1.04);
  box-shadow:
    0 22px 65px rgba(0,175,212,0.58),
    0 8px 26px rgba(124,58,237,0.42),
    0 2px 0 rgba(255,255,255,0.15) inset;
  filter:brightness(1.1);
}
.nx-cta-icon{font-size:1.2rem;line-height:1}
.nx-cta-label{display:block;font-size:0.72rem;font-weight:900;letter-spacing:1.5px;color:#fff}
.nx-cta-sub{
  display:block;font-family:'JetBrains Mono',monospace;
  font-size:0.52rem;font-weight:400;
  color:rgba(255,255,255,0.52);
  text-transform:none;letter-spacing:0;white-space:nowrap;
}
/* stats strip */
.nx-stats{
  position:relative;z-index:1;
  display:flex;
  border-top:1px solid rgba(0,212,255,0.09);
  background:rgba(0,0,0,0.22);
}
.nx-stat{
  flex:1;padding:11px 8px;
  border-right:1px solid rgba(0,212,255,0.07);
  text-align:center;
}
.nx-stat:last-child{border-right:none}
.nx-stat-val{
  font-family:'Orbitron',monospace;
  font-size:0.8rem;font-weight:800;
  color:var(--cyan);margin-bottom:2px;
}
.nx-stat-lbl{
  font-size:0.56rem;font-weight:700;
  text-transform:uppercase;letter-spacing:1px;
  color:var(--muted);font-family:'Syne',sans-serif;
}

/* ── Toggle section ── */
.toggle-section{cursor:pointer;user-select:none}
.toggle-section .chevron{transition:transform .2s;display:inline-block}
.toggle-section.open .chevron{transform:rotate(90deg)}

/* ── Toast ── */
.toast{
  position:fixed;bottom:24px;right:24px;z-index:9999;
  background:rgba(6,13,31,0.95);
  border:1px solid rgba(0,212,255,0.3);
  border-radius:12px;
  backdrop-filter:blur(16px);
  padding:12px 20px;font-size:0.82rem;font-weight:600;
  color:var(--cyan);
  box-shadow:var(--glow-c);
  opacity:0;transform:translateY(12px);
  transition:opacity .3s,transform .3s;
  pointer-events:none;
  max-width:320px;
}
.toast.show{opacity:1;transform:translateY(0)}

/* ── Glow divider ── */
.glow-line{height:1px;background:linear-gradient(90deg,transparent,var(--cyan),var(--purple),transparent);margin:24px 0;opacity:.4}

/* ── Two column ── */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:18px}
@media(max-width:768px){.two-col{grid-template-columns:1fr}}

/* ── Responsive ── */
@media(max-width:640px){
  .header{padding:0 16px;height:58px}
  .nav{padding:0 12px}
  .container{padding:16px}
  .card{padding:18px}
  .section,.form-section{padding:18px}
}
</style>
</head>
<body>
<div class="layout">

<!-- ══ HEADER ══════════════════════════════════════════ -->
<header class="header">
  <a class="header-logo" href="/dashboard">
    <div class="logo-icon">⚡</div>
    <span class="logo-text">NEXUS-MD</span>
  </a>
  <div class="header-spacer"></div>
  <span class="platform-chip" id="platformBadge">DETECTING…</span>
  <div class="status-pill">
    <span class="pulse" id="statusPulse"></span>
    <span id="connBadge">LIVE</span>
  </div>
</header>

<!-- ══ NAV ══════════════════════════════════════════════ -->
<nav class="nav">
  <a class="nav-tab ${activeTab==="overview"?"active":""}" href="/dashboard?tab=overview">
    <span class="tab-icon">📊</span>Overview
  </a>
  <a class="nav-tab ${activeTab==="session"?"active":""}" href="/dashboard?tab=session">
    <span class="tab-icon">🔑</span>Session ID
  </a>
  <a class="nav-tab t-setup ${activeTab==="setup"?"active":""}" href="/dashboard?tab=setup">
    <span class="tab-icon">⚙️</span>Setup
  </a>
  <a class="nav-tab t-add ${activeTab==="add"?"active":""}" href="/dashboard?tab=add">
    <span class="tab-icon">➕</span>Add Session
  </a>
</nav>

<!-- ══ MAIN ═════════════════════════════════════════════ -->
<main class="container">

<!-- ─── OVERVIEW TAB ──────────────────────────────────── -->
<div id="tabOverview" style="display:${activeTab==="overview"?"block":"none"}">

  <div class="stat-grid" id="statsGrid">
    <div class="card">
      <div class="card-label">📨 Total Messages</div>
      <div class="card-value" id="totalMessages">—</div>
      <div class="card-sub">All time</div>
    </div>
    <div class="card">
      <div class="card-label">⚙️ Commands Used</div>
      <div class="card-value" id="totalCommands" style="background:linear-gradient(135deg,var(--purple),var(--blue));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">—</div>
      <div class="card-sub">All time</div>
    </div>
    <div class="card">
      <div class="card-label">👥 Unique Users</div>
      <div class="card-value" id="uniqueUsers" style="background:linear-gradient(135deg,var(--green),var(--cyan));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">—</div>
      <div class="card-sub">Distinct contacts</div>
    </div>
    <div class="card">
      <div class="card-label">⏱ Uptime</div>
      <div class="card-value" id="uptime" style="background:linear-gradient(135deg,var(--gold),#f97316);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">—</div>
      <div class="card-sub">Minutes running</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📈 Activity — Last 24 Hours</div>
    <div class="chart-wrap" id="chartBars"></div>
    <div class="chart-labels" id="chartLabels"></div>
  </div>

  <div class="two-col">
    <div class="section">
      <div class="section-title">🏆 Top Commands</div>
      <table>
        <thead><tr><th>Command</th><th>Uses</th><th style="width:80px">Bar</th></tr></thead>
        <tbody id="commandTable"></tbody>
      </table>
    </div>
    <div class="section">
      <div class="section-title">🕐 Recent Activity</div>
      <table>
        <thead><tr><th>Time</th><th>User</th><th>Action</th></tr></thead>
        <tbody id="activityTable"></tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">📅 Recent Bookings</div>
    <table>
      <thead><tr><th>#</th><th>Service</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
      <tbody id="bookingsTable"></tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">📢 Broadcast History</div>
    <table>
      <thead><tr><th>Message</th><th>Sent</th><th>Failed</th><th>Time</th></tr></thead>
      <tbody id="broadcastTable"></tbody>
    </table>
  </div>
</div>

<!-- ─── SESSION TAB ───────────────────────────────────── -->
<div id="tabSession" style="display:${activeTab==="session"?"block":"none"}">

  <div class="info-grid" id="sessionInfoGrid">
    <div class="info-item">
      <div class="info-label">Status</div>
      <div class="info-val" id="sConnected"><span class="dot dot-gold"></span>Checking…</div>
    </div>
    <div class="info-item">
      <div class="info-label">Phone Number</div>
      <div class="info-val" id="sPhone">—</div>
    </div>
    <div class="info-item">
      <div class="info-label">Session Format</div>
      <div class="info-val" style="color:var(--green)">Universal · Any Baileys</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🔑 Your Session ID</div>
    <p style="font-size:0.82rem;color:var(--muted);margin-bottom:18px;line-height:1.6">
      Your bot session in <strong style="color:var(--cyan)">NEXUS-MD</strong> format.
      Copy and save it — paste it as the <code style="font-family:'JetBrains Mono',monospace;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);padding:1px 7px;border-radius:5px;color:var(--cyan)">SESSION_ID</code>
      environment variable on Heroku, Render, or Replit to keep your bot online.
    </p>

    <div class="sid-outer">
      <div class="sid-label">Session ID · NEXUS-MD Format</div>
      <div class="sid-box" id="sessionIdBox">⏳ Loading session…</div>
      <div class="sid-actions">
        <button class="btn btn-cyan" onclick="copySID()">📋 Copy</button>
        <button class="btn btn-ghost" onclick="refreshSID()">🔄 Refresh</button>
        <a class="btn btn-green" href="/session" target="_blank">🔗 Pairing Page</a>
        <button class="btn btn-gold" onclick="window.location='/dashboard?tab=setup'">⚙️ Push to Heroku</button>
      </div>
    </div>

    <div class="nx-card">
      <div class="nx-glow-orb nx-glow-orb1"></div>
      <div class="nx-glow-orb nx-glow-orb2"></div>
      <div class="nx-card-body">
        <div class="nx-icon-cluster">
          <div class="nx-icon-orbit2"></div>
          <div class="nx-icon-orbit1"></div>
          <div class="nx-icon-core">⚡</div>
        </div>
        <div class="nx-card-main">
          <div class="nx-badge"><span class="nx-badge-dot"></span>Server Live &nbsp;·&nbsp; Official Pairing Portal</div>
          <div class="nx-title">NEXUS SESSION GENERATOR</div>
          <a class="nx-url-pill" href="https://nexus-session-76ah.onrender.com/" target="_blank">
            <span>🔗</span><span>nexus-session-76ah.onrender.com</span><i class="nx-url-arrow">↗</i>
          </a>
          <div class="nx-desc">Scan a QR code or enter your phone number — get a session key in under 30 seconds. Completely free, end-to-end encrypted, no account needed.</div>
          <div class="nx-chips">
            <span class="nx-chip nx-chip-cyan">⚡ Ready in &lt;30s</span>
            <span class="nx-chip nx-chip-purple">🔐 E2E Encrypted</span>
            <span class="nx-chip nx-chip-cyan">🌍 Always Free</span>
            <span class="nx-chip nx-chip-purple">🚫 No Login Required</span>
          </div>
        </div>
        <div class="nx-card-action">
          <a class="nx-cta" href="https://nexus-session-76ah.onrender.com/" target="_blank">
            <span class="nx-cta-sweep"></span>
            <span class="nx-cta-icon">⚡</span>
            <span class="nx-cta-label">Get Session ID</span>
            <span class="nx-cta-sub">nexus-session-76ah.onrender.com →</span>
          </a>
          <div class="nx-scan-hint">Scan QR · Enter phone · Copy key</div>
        </div>
      </div>
      <div class="nx-stats">
        <div class="nx-stat"><div class="nx-stat-val">100%</div><div class="nx-stat-lbl">Free Forever</div></div>
        <div class="nx-stat"><div class="nx-stat-val">&lt;30s</div><div class="nx-stat-lbl">Pair Time</div></div>
        <div class="nx-stat"><div class="nx-stat-val">E2E</div><div class="nx-stat-lbl">Encrypted</div></div>
        <div class="nx-stat"><div class="nx-stat-val">24/7</div><div class="nx-stat-lbl">Always Online</div></div>
        <div class="nx-stat"><div class="nx-stat-val">0</div><div class="nx-stat-lbl">Data Stored</div></div>
      </div>
    </div>

    <div class="section" style="background:rgba(0,0,0,0.3);border-color:rgba(0,212,255,0.08)">
      <div class="section-title" style="font-size:0.82rem">📖 How to use your Session ID</div>
      <div class="steps">
        <div class="step"><div class="step-num">1</div><div class="step-text">Click <strong>Copy</strong> above to copy the full <code>NEXUS-MD:~…</code> string</div></div>
        <div class="step"><div class="step-num">2</div><div class="step-text"><strong>Heroku:</strong> Use the <strong>Setup tab</strong> to auto-push your config vars with just your Heroku API key</div></div>
        <div class="step"><div class="step-num">3</div><div class="step-text"><strong>Render:</strong> Go to Environment → add <code>SESSION_ID</code> and paste</div></div>
        <div class="step"><div class="step-num">4</div><div class="step-text"><strong>Replit:</strong> Go to Secrets → add <code>SESSION_ID</code> and paste — bot auto-connects on next restart</div></div>
        <div class="step"><div class="step-num">5</div><div class="step-text"><strong>Universal:</strong> Any valid Baileys session accepted — <code>NEXUS-MD</code>, raw JSON, base64, Pastebin/Gist URL</div></div>
      </div>
    </div>

    <div class="section" style="background:rgba(0,0,0,0.3);border-color:rgba(0,212,255,0.08);margin-top:16px">
      <div class="section-title" style="font-size:0.82rem">🔌 Load Session from URL</div>
      <p style="font-size:0.78rem;color:var(--muted);margin-bottom:14px;line-height:1.5">Paste any public URL that returns session data (Pastebin, GitHub Gist, direct file link, API endpoint…)</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="sessionUrlInput" type="url" class="form-input" placeholder="https://pastebin.com/XxXxXx  or  https://gist.github.com/…" style="flex:1;min-width:220px" />
        <button class="btn btn-cyan" onclick="loadSessionFromUrl()">📡 Load</button>
      </div>
      <div id="sessionUrlResult" style="margin-top:10px;font-size:0.78rem;color:var(--muted)"></div>
    </div>
  </div>
</div>

<!-- ─── SETUP TAB ─────────────────────────────────────── -->
<div id="tabSetup" style="display:${activeTab==="setup"?"block":"none"}">

  <div id="setupBanner" class="alert alert-warn" style="display:none">
    ⚠️ <strong>Bot not connected</strong> — fill in your details below to get started.
  </div>

  <div class="form-section">
    <div class="form-section-title">🚀 Quick Setup</div>
    <div class="form-section-sub">Fill in your details — the bot will connect and optionally push all config vars to Heroku automatically.</div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">📱 Owner Phone Number</label>
        <input type="tel" id="setupPhone" class="form-input" placeholder="254706535581 (no + sign)" />
        <div class="form-hint">Country code + number, no spaces or + symbol</div>
      </div>
      <div class="form-group">
        <label class="form-label">🤖 Bot Name</label>
        <input type="text" id="setupBotname" class="form-input" placeholder="NEXUS-MD" value="NEXUS-MD" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">🔑 Session ID</label>
      <input type="text" id="setupSessionId" class="form-input" placeholder="NEXUS-MD:~… (get from nexus-session-76ah.onrender.com)" />
      <div class="nx-card">
        <div class="nx-glow-orb nx-glow-orb1"></div>
        <div class="nx-glow-orb nx-glow-orb2"></div>
        <div class="nx-card-body">
          <div class="nx-icon-cluster">
            <div class="nx-icon-orbit2"></div>
            <div class="nx-icon-orbit1"></div>
            <div class="nx-icon-core">⚡</div>
          </div>
          <div class="nx-card-main">
            <div class="nx-badge"><span class="nx-badge-dot"></span>Server Live &nbsp;·&nbsp; Official Pairing Portal</div>
            <div class="nx-title">NEXUS SESSION GENERATOR</div>
            <a class="nx-url-pill" href="https://nexus-session-76ah.onrender.com/" target="_blank">
              <span>🔗</span><span>nexus-session-76ah.onrender.com</span><i class="nx-url-arrow">↗</i>
            </a>
            <div class="nx-desc">Scan a QR code or enter your phone number — get a session key in under 30 seconds. Completely free, end-to-end encrypted, no account needed.</div>
            <div class="nx-chips">
              <span class="nx-chip nx-chip-cyan">⚡ Ready in &lt;30s</span>
              <span class="nx-chip nx-chip-purple">🔐 E2E Encrypted</span>
              <span class="nx-chip nx-chip-cyan">🌍 Always Free</span>
              <span class="nx-chip nx-chip-purple">🚫 No Login Required</span>
            </div>
          </div>
          <div class="nx-card-action">
            <a class="nx-cta" href="https://nexus-session-76ah.onrender.com/" target="_blank">
              <span class="nx-cta-sweep"></span>
              <span class="nx-cta-icon">⚡</span>
              <span class="nx-cta-label">Get Session ID</span>
              <span class="nx-cta-sub">nexus-session-76ah.onrender.com →</span>
            </a>
            <div class="nx-scan-hint">Scan QR · Enter phone · Copy key</div>
          </div>
        </div>
        <div class="nx-stats">
          <div class="nx-stat"><div class="nx-stat-val">100%</div><div class="nx-stat-lbl">Free Forever</div></div>
          <div class="nx-stat"><div class="nx-stat-val">&lt;30s</div><div class="nx-stat-lbl">Pair Time</div></div>
          <div class="nx-stat"><div class="nx-stat-val">E2E</div><div class="nx-stat-lbl">Encrypted</div></div>
          <div class="nx-stat"><div class="nx-stat-val">24/7</div><div class="nx-stat-lbl">Always Online</div></div>
          <div class="nx-stat"><div class="nx-stat-val">0</div><div class="nx-stat-lbl">Data Stored</div></div>
        </div>
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label class="form-label">🚫 Bad Words (comma-separated)</label>
        <input type="text" id="setupBadword" class="form-input" placeholder="fuck,pussy,slut,bitch" value="fuck,pussy,slut,bitch,cock,stupid" />
        <div class="form-hint">Members sending these words will be kicked</div>
      </div>
      <div class="form-group">
        <label class="form-label">📋 Menu Type</label>
        <select id="setupMenuType" class="form-select">
          <option value="VIDEO">VIDEO — animated video menu</option>
          <option value="IMAGE">IMAGE — static image menu</option>
          <option value="LINK">LINK — text link menu</option>
        </select>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">🌍 Deployment Platform</label>
      <select id="setupPlatform" class="form-select" onchange="onPlatformChange()">
        <option value="local">Local / Replit / VPS (apply session only)</option>
        <option value="heroku">Heroku (auto-push all config vars)</option>
      </select>
    </div>

    <div id="herokuFields" class="platform-section hidden">
      <div class="platform-section-title">🟣 Heroku Configuration</div>
      <div class="alert alert-warn" style="margin-bottom:14px">
        ⚠️ <strong>Disable GitHub auto-deploy on Heroku</strong> — Go to Deploy tab → Automatic deploys → <strong>Disable Automatic Deploys</strong>.
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Heroku API Key</label>
          <input type="password" id="herokuApiKey" class="form-input" placeholder="Your Heroku API key" />
          <div class="form-hint"><a href="https://dashboard.heroku.com/account" target="_blank">Get from Account Settings →</a></div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Heroku App Name</label>
          <div style="display:flex;gap:8px">
            <input type="text" id="herokuAppName" class="form-input" placeholder="your-app-name" style="flex:1" />
            <button class="btn btn-ghost" onclick="fetchHerokuApps()" style="padding:9px 12px;white-space:nowrap">🔍</button>
          </div>
        </div>
      </div>
      <div id="herokuAppList" style="margin-top:10px;font-size:0.78rem;color:var(--muted)"></div>
      <div style="margin-top:14px">
        <div class="form-row">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" style="text-transform:none;letter-spacing:0">NODE_ENV</label>
            <input type="text" id="cfgNodeEnv" class="form-input" value="production" />
          </div>
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label" style="text-transform:none;letter-spacing:0">PAIR_SITE_URL</label>
            <input type="text" id="cfgPairSite" class="form-input" value="https://nexus-session-76ah.onrender.com" />
          </div>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
      <button class="btn btn-green" onclick="applySetup()">✅ Apply Setup</button>
      <button class="btn btn-ghost" onclick="clearSetup()">🗑 Clear</button>
      <button class="btn btn-cyan" onclick="forceReconnect()" id="reconnectBtn">🔄 Force Reconnect</button>
    </div>
    <div class="setup-result" id="setupResult" style="margin-top:14px;font-size:0.82rem;min-height:20px;line-height:1.6"></div>
  </div>

  <div class="form-section">
    <div class="form-section-title">🌍 Platform Detection</div>
    <div class="form-section-sub">Detected deployment environment and status.</div>
    <div class="info-grid" id="platformInfoGrid">
      <div class="info-item"><div class="info-label">Platform</div><div class="info-val" id="piPlatform">—</div></div>
      <div class="info-item"><div class="info-label">Bot Status</div><div class="info-val" id="piBotStatus">—</div></div>
      <div class="info-item"><div class="info-label">Heroku App</div><div class="info-val" id="piHerokuApp">—</div></div>
      <div class="info-item"><div class="info-label">Mode</div><div class="info-val" id="piMode">—</div></div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title">📋 Heroku Deploy Form Auto-Fill</div>
    <div class="form-section-sub">Generate exact values to paste when deploying to Heroku via the deploy button form.</div>
    <div class="alert alert-info">ℹ️ Fill the Quick Setup fields above first, then click Generate.</div>
    <button class="btn btn-purple" onclick="generateHerokuFill()">📋 Generate Heroku Config Values</button>
    <div id="herokuFillOutput" style="margin-top:18px"></div>
  </div>

</div>

<!-- ─── ADD SESSION TAB ───────────────────────────────── -->
<div id="tabAdd" style="display:${activeTab==="add"?"block":"none"}">

  <div class="form-section">
    <div class="form-section-title">➕ Add Session / Deploy New App</div>
    <div class="form-section-sub">Create a brand-new Heroku app with your bot config, or just apply a session to this running bot.</div>
  </div>

  <div class="form-section">
    <div class="form-section-title" style="font-size:0.85rem;margin-bottom:4px">🏷 App Details</div>
    <div class="form-section-sub">Leave the app name blank and Heroku will auto-generate one.</div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">App Name</label>
        <input type="text" id="addAppName" class="form-input" placeholder="my-nexus-bot (optional)" />
        <div class="form-hint">Lowercase letters, numbers, hyphens only</div>
      </div>
      <div class="form-group">
        <label class="form-label">Heroku API Key <span class="req-badge">Required</span></label>
        <input type="password" id="addHerokuKey" class="form-input" placeholder="Your Heroku API key" />
        <div class="form-hint"><a href="https://dashboard.heroku.com/account" target="_blank">Get from Account Settings →</a></div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Location</label>
      <div style="display:flex;flex-direction:column;gap:10px">
        <label class="region-opt selected" id="usRegionLabel">
          <input type="radio" name="addRegion" value="us" checked onchange="updateRegionStyle()" />
          <span style="flex:1"><strong style="color:var(--text)">Common Runtime</strong><br><span class="resource-sub">CEDAR</span></span>
          <span>🇺🇸</span><span style="color:var(--muted);font-size:0.82rem">United States</span>
        </label>
        <label class="region-opt" id="euRegionLabel">
          <input type="radio" name="addRegion" value="eu" onchange="updateRegionStyle()" />
          <span style="flex:1"><strong style="color:var(--text)">Common Runtime</strong><br><span class="resource-sub">CEDAR</span></span>
          <span>🇮🇪</span><span style="color:var(--muted);font-size:0.82rem">Europe</span>
        </label>
      </div>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title" style="font-size:0.85rem;margin-bottom:4px">📦 Resources</div>
    <div class="form-section-sub">Provisioned when the app deploys. Prorated to the second.</div>
    <div class="resource-row">
      <div style="display:flex;align-items:center">
        <span class="resource-icon">🌐</span>
        <div><div class="resource-name">web</div><div class="resource-sub">Standard-1X dyno</div></div>
      </div>
      <span class="resource-price">~$0.035/hr</span>
    </div>
    <div class="resource-row">
      <div style="display:flex;align-items:center">
        <span class="resource-icon">🐘</span>
        <div><div class="resource-name">Heroku Postgres</div><div class="resource-sub">Essential 0 add-on</div></div>
      </div>
      <span class="resource-price">~$0.007/hr</span>
    </div>
  </div>

  <div class="form-section">
    <div class="form-section-title" style="font-size:0.85rem;margin-bottom:4px">⚙️ Config Vars</div>
    <div class="form-section-sub">Environment variables set on your new Heroku app. Required fields must be filled.</div>

    <div class="form-group">
      <label class="form-label">ADMIN_NUMBERS <span class="req-badge">Required</span></label>
      <div class="form-hint" style="margin-bottom:7px">Your WhatsApp number WITHOUT the + sign. Multiple: 254706535581,254781346242</div>
      <input type="tel" id="addAdminNumbers" class="form-input" placeholder="254706535581" />
    </div>

    <div class="form-group">
      <label class="form-label">SESSION_ID <span class="req-badge">Required</span></label>
      <input type="text" id="addSessionId" class="form-input" placeholder="NEXUS-MD:~…" />
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" style="font-size:0.78rem;padding:6px 12px" onclick="fillAddSessionFromBot()">📋 Use current bot session</button>
      </div>
      <div class="pair-bar" style="margin-top:12px">
        <div class="pair-bar-inner" style="padding:14px 16px;gap:14px">
          <div class="pair-bar-icon" style="width:38px;height:38px;min-width:38px;font-size:18px">⚡</div>
          <div class="pair-bar-text">
            <div class="pair-bar-label">Don't have a session?</div>
            <div class="pair-bar-heading" style="font-size:0.82rem">NEXUS Session Generator</div>
            <div class="pair-bar-url">nexus-session-76ah.onrender.com</div>
          </div>
          <a class="pair-bar-btn" href="https://nexus-session-76ah.onrender.com" target="_blank" style="padding:8px 16px;font-size:0.75rem">
            ⚡ Get Free
          </a>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">BOTNAME</label>
      <div class="form-hint" style="margin-bottom:7px">Your bot display name shown in menus and messages.</div>
      <input type="text" id="addBotname" class="form-input" value="NEXUS-MD" placeholder="NEXUS-MD" />
    </div>

    <div class="form-group">
      <label class="form-label">DATABASE_URL</label>
      <div class="form-hint" style="margin-bottom:7px">Auto-filled by Heroku Postgres add-on — leave blank.</div>
      <input type="text" id="addDatabaseUrl" class="form-input" placeholder="(auto-filled by Heroku Postgres)" disabled />
    </div>

    <div class="form-group">
      <label class="form-label">BAD_WORD</label>
      <div class="form-hint" style="margin-bottom:7px">Comma-separated — members sending these words get kicked.</div>
      <input type="text" id="addBadword" class="form-input" value="fuck,pussy,slut,bitch,cock,stupid" />
    </div>

    <div class="form-group">
      <label class="form-label">MENU_TYPE</label>
      <select id="addMenuType" class="form-select">
        <option value="VIDEO">VIDEO — animated video menu</option>
        <option value="IMAGE">IMAGE — static image menu</option>
        <option value="LINK">LINK — text link menu</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">PAIR_SITE_URL</label>
      <input type="text" id="addPairSite" class="form-input" value="https://nexus-session-76ah.onrender.com" />
    </div>

    <div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-solid-cyan" style="padding:11px 28px;font-size:0.92rem" onclick="deployHerokuApp()">🚀 Deploy App</button>
      <button class="btn btn-cyan" onclick="applyAddSessionLocal()">⚡ Apply Session to This Bot</button>
      <button class="btn btn-ghost" onclick="clearAddForm()">🗑 Clear</button>
    </div>

    <div id="addResult" style="margin-top:18px;font-size:0.85rem;min-height:24px;line-height:1.7"></div>
  </div>

  <div id="addSuccessBox" style="display:none" class="form-section">
    <div class="form-section-title" style="color:var(--green)">✅ App Deployed!</div>
    <div class="info-grid" style="margin-top:14px">
      <div class="info-item"><div class="info-label">App Name</div><div class="info-val" id="addSuccessName" style="color:var(--green)">—</div></div>
      <div class="info-item"><div class="info-label">App URL</div><div class="info-val" id="addSuccessUrl" style="font-size:0.88rem">—</div></div>
    </div>
    <div class="alert alert-success" style="margin-top:14px">✅ Your Heroku app is deploying. It may take 2-3 minutes to come online.</div>
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn btn-cyan" onclick="window.open(document.getElementById('addSuccessUrl').textContent,'_blank')">🌐 Open App</button>
      <a class="btn btn-ghost" href="https://dashboard.heroku.com" target="_blank">🟣 Heroku Dashboard</a>
    </div>
  </div>

</div>

</main>
</div>

<div class="toast" id="toast"></div>

<script>
function toast(msg, color) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.borderColor = color === '#b62324' ? 'rgba(239,68,68,0.4)' : color === '#d29922' ? 'rgba(245,158,11,0.4)' : 'rgba(0,212,255,0.3)';
  t.style.color = color === '#b62324' ? '#ef4444' : color === '#d29922' ? '#f59e0b' : 'var(--cyan)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ---- PLATFORM DETECTION ----
let platformInfo = {};
async function loadPlatform() {
  try {
    const d = await fetch('/api/platform').then(r=>r.json());
    platformInfo = d;
    const badge = document.getElementById('platformBadge');
    if (badge) badge.textContent = (d.icon||'') + ' ' + (d.platform||'Unknown');

    const connBadge = document.getElementById('connBadge');
    const pulse = document.getElementById('statusPulse');
    if (connBadge) {
      if (d.botStatus === 'connected') {
        connBadge.textContent = 'ONLINE';
        if (pulse) { pulse.className = 'pulse'; }
      } else if (d.waitingForSession) {
        connBadge.textContent = 'SETUP NEEDED';
        if (pulse) { pulse.className = 'pulse gold'; }
      } else {
        connBadge.textContent = 'OFFLINE';
        if (pulse) { pulse.className = 'pulse red'; }
      }
    }

    const piPlatform = document.getElementById('piPlatform');
    const piBotStatus = document.getElementById('piBotStatus');
    const piHerokuApp = document.getElementById('piHerokuApp');
    const piMode = document.getElementById('piMode');
    if (piPlatform) piPlatform.textContent = (d.icon||'') + ' ' + (d.platform||'Unknown');
    if (piBotStatus) {
      piBotStatus.innerHTML = d.botStatus === 'connected'
        ? '<span class="dot dot-green"></span>Connected'
        : (d.waitingForSession ? '<span class="dot dot-gold"></span>Waiting for session' : '<span class="dot dot-red"></span>Disconnected');
    }
    if (piHerokuApp) piHerokuApp.textContent = d.herokuAppName || (d.isHeroku ? 'Unknown' : 'N/A');
    if (piMode) piMode.textContent = d.isPanel ? 'Panel Mode' : (d.isHeroku ? 'Heroku Cloud' : 'Cloud / VPS');

    const platSel = document.getElementById('setupPlatform');
    if (platSel && d.isHeroku) {
      platSel.value = 'heroku';
      onPlatformChange();
      if (d.herokuAppName) {
        const appInp = document.getElementById('herokuAppName');
        if (appInp && !appInp.value) appInp.value = d.herokuAppName;
      }
    }

    const banner = document.getElementById('setupBanner');
    if (banner && d.waitingForSession) banner.style.display = 'flex';

    const phoneInp = document.getElementById('setupPhone');
    if (phoneInp && !phoneInp.value) {
      const sess = await fetch('/api/session').then(r=>r.json()).catch(()=>null);
      if (sess?.phone) phoneInp.value = sess.phone.replace('@s.whatsapp.net','').replace(':','');
    }
  } catch(e) {}
}

// ---- SESSION TAB ----
let currentSID = null;
async function loadSession() {
  try {
    const r = await fetch('/api/session');
    const d = await r.json();
    currentSID = d.sessionId;
    const box = document.getElementById('sessionIdBox');
    if (box) {
      if (d.sessionId) {
        box.textContent = d.sessionId;
        box.style.color = 'var(--cyan)';
      } else {
        box.textContent = '⏳ Session not ready — pair the bot first then refresh.';
        box.style.color = 'var(--gold)';
      }
    }
    const connEl = document.getElementById('sConnected');
    if (connEl) {
      connEl.innerHTML = d.connected
        ? '<span class="dot dot-green"></span>Connected'
        : '<span class="dot dot-red"></span>Disconnected';
    }
    const phoneEl = document.getElementById('sPhone');
    if (phoneEl) phoneEl.textContent = d.phone ? '+' + d.phone.replace('@s.whatsapp.net','').replace(':','') : '—';

    const setupSid = document.getElementById('setupSessionId');
    if (setupSid && !setupSid.value && d.sessionId) setupSid.value = d.sessionId;
  } catch(e) {
    const box = document.getElementById('sessionIdBox');
    if (box) box.textContent = '❌ Error loading session.';
  }
}

function copySID() {
  if (!currentSID) { toast('No session yet — pair the bot first', '#b62324'); return; }
  navigator.clipboard.writeText(currentSID)
    .then(() => toast('✅ Session ID copied!'))
    .catch(() => {
      const box = document.getElementById('sessionIdBox');
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(box);
      sel.removeAllRanges();
      sel.addRange(range);
      toast('Select & copy the text manually', '#d29922');
    });
}

function refreshSID() { loadSession(); toast('🔄 Refreshed'); }

async function loadSessionFromUrl() {
  const input = document.getElementById('sessionUrlInput');
  const result = document.getElementById('sessionUrlResult');
  const url = (input.value || '').trim();
  if (!url) { result.textContent = '⚠️ Please enter a URL first.'; result.style.color='var(--gold)'; return; }
  result.textContent = '⏳ Loading...'; result.style.color='var(--muted)';
  try {
    const r = await fetch('/session/url', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ url }) });
    const d = await r.json();
    if (d.ok) {
      result.textContent = '✅ ' + d.message;
      result.style.color = 'var(--green)';
      toast('✅ Session loaded from URL!');
      setTimeout(loadSession, 2000);
    } else {
      result.textContent = '❌ ' + (d.error || 'Unknown error');
      result.style.color = 'var(--red)';
    }
  } catch(e) {
    result.textContent = '❌ Network error: ' + e.message;
    result.style.color = 'var(--red)';
  }
}

// ---- SETUP TAB ----
function onPlatformChange() {
  const v = document.getElementById('setupPlatform').value;
  document.getElementById('herokuFields').classList.toggle('hidden', v !== 'heroku');
}

async function fetchHerokuApps() {
  const apiKey = (document.getElementById('herokuApiKey').value||'').trim();
  const listEl = document.getElementById('herokuAppList');
  if (!apiKey) { listEl.textContent = '⚠️ Enter your Heroku API key first.'; listEl.style.color='var(--gold)'; return; }
  listEl.textContent = '⏳ Fetching apps...'; listEl.style.color='var(--muted)';
  try {
    const r = await fetch('/api/heroku/apps?apiKey=' + encodeURIComponent(apiKey));
    const d = await r.json();
    if (d.ok && d.apps.length) {
      listEl.innerHTML = 'Found: ' + d.apps.map(a =>
        \`<a href="#" style="color:var(--cyan);margin-right:8px" onclick="document.getElementById('herokuAppName').value='\${a.name}';return false">\${a.name}</a>\`
      ).join('');
    } else if (d.ok) {
      listEl.textContent = 'No apps found on this account.';
    } else {
      listEl.textContent = '❌ ' + (d.error||'Unknown error');
      listEl.style.color='var(--red)';
    }
  } catch(e) {
    listEl.textContent = '❌ Network error: ' + e.message;
    listEl.style.color='var(--red)';
  }
}

async function forceReconnect() {
  const btn = document.getElementById('reconnectBtn');
  const resultEl = document.getElementById('setupResult');
  if (btn) btn.disabled = true;
  resultEl.innerHTML = '<span style="color:var(--muted)">⏳ Sending reconnect signal...</span>';
  try {
    const r = await fetch('/api/reconnect', { method: 'POST', headers: {'Content-Type':'application/json'} });
    const d = await r.json();
    if (d.ok) {
      resultEl.innerHTML = '<span style="color:var(--green)">✅ ' + d.message + ' — watch the console logs.</span>';
      toast('🔄 Reconnecting...');
    } else {
      resultEl.innerHTML = '<span style="color:var(--gold)">⚠️ ' + d.message + '</span>';
    }
  } catch(e) {
    resultEl.innerHTML = '<span style="color:var(--red)">❌ Network error: ' + e.message + '</span>';
  } finally {
    if (btn) setTimeout(() => { btn.disabled = false; }, 3000);
  }
}

async function applySetup() {
  const phone = (document.getElementById('setupPhone').value||'').replace(/\\D/g,'').trim();
  const sessionId = (document.getElementById('setupSessionId').value||'').trim();
  const botname = (document.getElementById('setupBotname').value||'NEXUS-MD').trim();
  const badword = (document.getElementById('setupBadword').value||'').trim();
  const menuType = (document.getElementById('setupMenuType').value||'VIDEO').trim();
  const platform = document.getElementById('setupPlatform').value;
  const resultEl = document.getElementById('setupResult');

  if (!sessionId) { resultEl.innerHTML='<span style="color:var(--red)">⚠️ Session ID is required.</span>'; return; }

  resultEl.innerHTML = '<span style="color:var(--muted)">⏳ Applying session to bot...</span>';

  try {
    const r = await fetch('/session', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ session: sessionId })
    });
    const d = await r.json();
    if (!d.ok && d.error) {
      resultEl.innerHTML = '<span style="color:var(--red)">❌ Session error: ' + d.error + '</span>';
      return;
    }
    resultEl.innerHTML = '<span style="color:var(--green)">✅ Session applied — bot reconnecting...</span>';
    toast('✅ Session applied!');
  } catch(e) {
    resultEl.innerHTML = '<span style="color:var(--red)">❌ Network error: ' + e.message + '</span>';
    return;
  }

  if (platform === 'heroku') {
    const apiKey = (document.getElementById('herokuApiKey').value||'').trim();
    const appName = (document.getElementById('herokuAppName').value||'').trim();
    if (!apiKey || !appName) {
      resultEl.innerHTML += '<br><span style="color:var(--gold)">⚠️ Enter Heroku API key and app name to push config vars.</span>';
      return;
    }
    resultEl.innerHTML += '<br><span style="color:var(--muted)">⏳ Pushing config vars to Heroku...</span>';
    const vars = {
      SESSION: sessionId,
      SESSION_ID: sessionId,
      BOTNAME: botname,
    };
    if (phone) { vars.ADMIN_NUMBERS = phone; }
    if (badword) vars.BAD_WORD = badword;
    vars.MENU_TYPE = menuType;
    vars.HEROKU_API = apiKey;
    const nodeEnv = (document.getElementById('cfgNodeEnv').value||'production').trim();
    const pairSite = (document.getElementById('cfgPairSite').value||'').trim();
    if (nodeEnv) vars.NODE_ENV = nodeEnv;
    if (pairSite) vars.PAIR_SITE_URL = pairSite;

    try {
      const r = await fetch('/api/heroku/config', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ apiKey, appName, vars })
      });
      const d = await r.json();
      if (d.ok) {
        resultEl.innerHTML += '<br><span style="color:var(--green)">✅ Heroku config updated on <strong>' + appName + '</strong>! Dyno will restart automatically.</span>';
        toast('✅ Heroku updated!');
      } else {
        resultEl.innerHTML += '<br><span style="color:var(--red)">❌ Heroku error: ' + (d.error||'Unknown') + '</span>';
      }
    } catch(e) {
      resultEl.innerHTML += '<br><span style="color:var(--red)">❌ Network error: ' + e.message + '</span>';
    }
  }
}

function clearSetup() {
  ['setupPhone','setupSessionId','herokuApiKey','herokuAppName','setupBadword'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const bn = document.getElementById('setupBotname');
  if (bn) bn.value = 'NEXUS-MD';
  document.getElementById('setupResult').innerHTML = '';
  document.getElementById('herokuAppList').innerHTML = '';
}

function generateHerokuFill() {
  const phone = (document.getElementById('setupPhone').value||'').replace(/\\D/g,'').trim();
  const sessionId = (document.getElementById('setupSessionId').value||'').trim();
  const botname = (document.getElementById('setupBotname').value||'NEXUS-MD').trim();
  const apiKey = (document.getElementById('herokuApiKey').value||'').trim();
  const out = document.getElementById('herokuFillOutput');

  if (!phone && !apiKey) {
    out.innerHTML = '<span style="color:var(--gold)">⚠️ Fill in at least your phone number above first.</span>';
    return;
  }

  const deployRows = [
    { key: 'HEROKU_API', val: apiKey || '(your Heroku API key from dashboard.heroku.com/account)' },
    { key: 'ADMIN_NUMBERS', val: phone || '(your WhatsApp number without +)' },
    { key: 'SESSION_ID', val: sessionId || '(get from nexus-session-76ah.onrender.com)' },
    { key: 'DATABASE_URL', val: '(auto-filled by Heroku Postgres — leave blank)' },
    { key: 'BOTNAME', val: botname },
  ];

  const postDeploySession = sessionId
    ? \`<span style="color:var(--green);font-family:'JetBrains Mono',monospace">.setvar SESSION=\${sessionId}</span>\`
    : \`<span style="color:var(--muted);font-family:'JetBrains Mono',monospace">.setvar SESSION=NEXUS-MD:~...&lt;your-session-id&gt;</span>\`;

  out.innerHTML = \`
    <p style="font-size:0.78rem;color:var(--muted);margin:0 0 12px">The Heroku deploy form shows these 4 fields — everything else is pre-configured automatically.</p>
    <div style="background:rgba(0,0,0,0.4);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:16px">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th>Field</th><th>Value to paste</th><th></th>
        </tr></thead>
        <tbody>
          \${deployRows.map(r => \`<tr>
            <td style="font-family:'JetBrains Mono',monospace;color:var(--cyan);font-size:0.8rem;white-space:nowrap">\${r.key}</td>
            <td style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text);word-break:break-all">\${r.val}</td>
            <td style="white-space:nowrap">
              \${r.val.startsWith('(') ? '' : \`<button class="btn btn-ghost" style="padding:4px 10px;font-size:0.72rem" onclick="navigator.clipboard.writeText('\${r.val.replace(/'/g,\\"\\\\'\\")}');toast('Copied!')">Copy</button>\`}
            </td>
          </tr>\`).join('')}
        </tbody>
      </table>
    </div>
    <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:16px">
      <p style="margin:0 0 8px;font-size:0.82rem;color:var(--blue);font-weight:600">📱 Step 2 — Connect WhatsApp after deploy</p>
      <p style="margin:0 0 10px;font-size:0.8rem;color:var(--muted)">
        Once your Heroku app is running, get a session ID from
        <a href="https://nexus-session-76ah.onrender.com" target="_blank" style="color:var(--cyan)">nexus-session-76ah.onrender.com</a>
        then send this command to the bot:
      </p>
      <div style="background:rgba(0,0,0,0.4);border-radius:8px;padding:10px 14px;font-size:0.82rem">
        \${postDeploySession}
      </div>
      \${sessionId ? \`<p style="margin:8px 0 0;font-size:0.75rem;color:var(--green)">✅ Your session ID is already filled in — just copy and send it!</p>\` : ''}
    </div>
  \`;
}

// ---- ADD SESSION TAB ----
function updateRegionStyle() {
  document.querySelectorAll('.region-opt').forEach(el => el.classList.remove('selected'));
  const checked = document.querySelector('input[name="addRegion"]:checked');
  if (checked) checked.closest('.region-opt').classList.add('selected');
}
document.querySelectorAll('input[name="addRegion"]').forEach(r => r.addEventListener('change', updateRegionStyle));

async function fillAddSessionFromBot() {
  try {
    const d = await fetch('/api/session').then(r => r.json());
    if (d.sessionId) {
      document.getElementById('addSessionId').value = d.sessionId;
      toast('✅ Session filled from bot!');
    } else {
      toast('⚠️ No active session yet — pair the bot first.', '#d29922');
    }
    if (d.phone) {
      const phone = d.phone.replace('@s.whatsapp.net', '').replace(':', '').replace(/\\D/g, '');
      const adminEl = document.getElementById('addAdminNumbers');
      if (adminEl && !adminEl.value) adminEl.value = phone;
    }
  } catch(e) {
    toast('❌ Could not load session: ' + e.message, '#b62324');
  }
}

async function deployHerokuApp() {
  const apiKey    = (document.getElementById('addHerokuKey').value || '').trim();
  const appName   = (document.getElementById('addAppName').value || '').trim();
  const region    = document.querySelector('input[name="addRegion"]:checked')?.value || 'us';
  const admin     = (document.getElementById('addAdminNumbers').value || '').replace(/\\D/g, '').trim();
  const sessionId = (document.getElementById('addSessionId').value || '').trim();
  const botname   = (document.getElementById('addBotname').value || 'NEXUS-MD').trim();
  const badword   = (document.getElementById('addBadword').value || '').trim();
  const menuType  = (document.getElementById('addMenuType').value || 'VIDEO');
  const pairSite  = (document.getElementById('addPairSite').value || '').trim();
  const resultEl  = document.getElementById('addResult');

  if (!apiKey) { resultEl.innerHTML = '<span style="color:var(--red)">❌ Heroku API key is required.</span>'; return; }
  if (!admin)  { resultEl.innerHTML = '<span style="color:var(--red)">❌ ADMIN_NUMBERS is required.</span>'; return; }
  if (!sessionId) { resultEl.innerHTML = '<span style="color:var(--red)">❌ SESSION_ID is required.</span>'; return; }

  resultEl.innerHTML = '<span style="color:var(--muted)">⏳ Creating Heroku app… this may take 15-30 seconds…</span>';
  document.getElementById('addSuccessBox').style.display = 'none';

  const vars = {
    ADMIN_NUMBERS: admin,
    SESSION_ID: sessionId,
    SESSION: sessionId,
    BOTNAME: botname,
    MENU_TYPE: menuType,
    HEROKU_API: apiKey,
  };
  if (badword) vars.BAD_WORD = badword;
  if (pairSite) vars.PAIR_SITE_URL = pairSite;

  try {
    const r = await fetch('/api/heroku/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, appName: appName || undefined, region, vars }),
    });
    const d = await r.json();
    if (d.ok) {
      resultEl.innerHTML = '<span style="color:var(--green)">✅ App created and deploying!</span>';
      const box = document.getElementById('addSuccessBox');
      box.style.display = 'block';
      const nameEl = document.getElementById('addSuccessName');
      const urlEl = document.getElementById('addSuccessUrl');
      if (nameEl) nameEl.textContent = d.appName || appName || '—';
      if (urlEl) urlEl.textContent = d.appUrl || ('https://' + (d.appName||appName) + '.herokuapp.com');
      toast('🚀 App deployed!');
    } else {
      resultEl.innerHTML = '<span style="color:var(--red)">❌ ' + (d.error || 'Unknown error') + '</span>';
    }
  } catch(e) {
    resultEl.innerHTML = '<span style="color:var(--red)">❌ Network error: ' + e.message + '</span>';
  }
}

async function applyAddSessionLocal() {
  const sessionId = (document.getElementById('addSessionId').value || '').trim();
  const resultEl  = document.getElementById('addResult');
  if (!sessionId) { resultEl.innerHTML = '<span style="color:var(--red)">❌ SESSION_ID is required.</span>'; return; }
  resultEl.innerHTML = '<span style="color:var(--muted)">⏳ Applying session...</span>';
  try {
    const r = await fetch('/session', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ session: sessionId }) });
    const d = await r.json();
    if (d.ok) {
      resultEl.innerHTML = '<span style="color:var(--green)">✅ Session applied — bot reconnecting...</span>';
      toast('✅ Session applied!');
    } else {
      resultEl.innerHTML = '<span style="color:var(--red)">❌ ' + (d.error||'Unknown error') + '</span>';
    }
  } catch(e) {
    resultEl.innerHTML = '<span style="color:var(--red)">❌ Network error: ' + e.message + '</span>';
  }
}

function clearAddForm() {
  ['addAppName','addHerokuKey','addAdminNumbers','addSessionId','addBadword'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const bn = document.getElementById('addBotname'); if (bn) bn.value = 'NEXUS-MD';
  const ps = document.getElementById('addPairSite'); if (ps) ps.value = 'https://nexus-session-76ah.onrender.com';
  document.getElementById('addResult').innerHTML = '';
  document.getElementById('addSuccessBox').style.display = 'none';
}

// ---- STATS CHART ----
async function loadStats() {
  try {
    const d = await fetch('/api/stats').then(r=>r.json());
    const s = d.stats || {};
    const el = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v ?? '—'; };
    el('totalMessages', s.totalMessages?.toLocaleString());
    el('totalCommands', s.totalCommands?.toLocaleString());
    el('uniqueUsers',   s.uniqueUsers?.toLocaleString());
    el('uptime',        s.uptimeMinutes ? s.uptimeMinutes + 'm' : '—');

    // Chart
    const bars   = document.getElementById('chartBars');
    const labels = document.getElementById('chartLabels');
    if (bars && d.hourly?.length) {
      const max = Math.max(...d.hourly.map(h=>h.count), 1);
      bars.innerHTML = d.hourly.map(h => {
        const pct = Math.max(4, Math.round((h.count/max)*100));
        return \`<div class="chart-bar" style="height:\${pct}%" title="\${h.hour}:00 — \${h.count} messages"></div>\`;
      }).join('');
      if (labels) labels.innerHTML = d.hourly.map(h => \`<span style="flex:1;text-align:center">\${h.hour}</span>\`).join('');
    }

    // Top commands
    const ct = document.getElementById('commandTable');
    if (ct && d.topCommands?.length) {
      const maxC = Math.max(...d.topCommands.map(c=>c.count), 1);
      ct.innerHTML = d.topCommands.map(c =>
        \`<tr><td style="font-family:'JetBrains Mono',monospace;color:var(--cyan)">.\${c.command}</td>
             <td style="color:var(--text)">\${c.count}</td>
             <td><div class="prog-wrap"><div class="prog-fill" style="width:\${Math.round(c.count/maxC*100)}%"></div></div></td></tr>\`
      ).join('');
    } else if (ct) {
      ct.innerHTML = '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:24px">No command data yet</td></tr>';
    }

    // Recent activity
    const at = document.getElementById('activityTable');
    if (at && s.recentActivity?.length) {
      at.innerHTML = s.recentActivity.slice(0,8).map(a =>
        \`<tr><td style="color:var(--muted);font-size:0.75rem;font-family:'JetBrains Mono',monospace">\${new Date(a.at).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</td>
             <td style="font-family:'JetBrains Mono',monospace;color:var(--text)">\${a.phone||'—'}</td>
             <td style="color:var(--muted)">\${a.action||'—'}</td></tr>\`
      ).join('');
    } else if (at) {
      at.innerHTML = '<tr><td colspan="3" style="color:var(--muted);text-align:center;padding:24px">No activity yet</td></tr>';
    }
  } catch(e) {}
}

// ---- BOOKINGS ----
async function loadBookings() {
  try {
    const data = await fetch('/api/bookings').then(r=>r.json());
    const bt = document.getElementById('bookingsTable');
    if (!bt) return;
    if (!data?.length) {
      bt.innerHTML = '<tr><td colspan="5" style="color:var(--muted);text-align:center;padding:24px">No bookings yet</td></tr>';
      return;
    }
    bt.innerHTML = data.map((b,i) =>
      \`<tr><td style="color:var(--muted)">\${i+1}</td>
           <td>\${b.service||'—'}</td>
           <td style="font-family:'JetBrains Mono',monospace;font-size:0.8rem">\${b.date||'—'}</td>
           <td style="font-family:'JetBrains Mono',monospace;font-size:0.8rem">\${b.time||'—'}</td>
           <td><span class="badge \${b.status||'pending'}">\${b.status||'pending'}</span></td></tr>\`
    ).join('');
  } catch(e) {}
}

// ---- BROADCASTS ----
async function loadBroadcasts() {
  try {
    const data = await fetch('/api/broadcasts').then(r=>r.json());
    const bt = document.getElementById('broadcastTable');
    if (!bt) return;
    if (!data?.length) {
      bt.innerHTML = '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:24px">No broadcasts yet</td></tr>';
      return;
    }
    bt.innerHTML = data.map(b =>
      \`<tr><td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${b.message||'—'}</td>
           <td style="color:var(--green)">\${b.sent??'—'}</td>
           <td style="color:var(--red)">\${b.failed??'—'}</td>
           <td style="color:var(--muted);font-size:0.78rem;font-family:'JetBrains Mono',monospace">\${b.at ? new Date(b.at).toLocaleString() : '—'}</td></tr>\`
    ).join('');
  } catch(e) {}
}

// ---- INIT ----
loadPlatform();
loadSession();
loadStats();
loadBookings();
loadBroadcasts();
setInterval(loadStats, 30000);
setInterval(loadPlatform, 15000);
</script>
</body>
</html>`;
}

module.exports = router;
