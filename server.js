// Strikeline server: serves the game files, hosts lobbies, and runs each lobby's matches
// (game modes, players, bots with navigation, rockets, grenades, scoring and XP).
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { buildMap, MAPS, MAP_ORDER } from './shared/maps.js';
import { WEAPONS, BOT_WEAPONS, THROWABLE_KINDS, LETHALS, TACTICALS, falloffMult } from './shared/weapons.js';
import { moveBody, raycastBoxes, PLAYER } from './shared/physics.js';
import { MODES, GUNGAME_LADDER, ZONE_RADIUS, ZONE_MOVE, targetScore, PICKUP_RESPAWN, POWER_TIME } from './shared/modes.js';
import { buildNav } from './shared/nav.js';
import { STREAKS, cleanPerks, cleanStreaks, streakCost } from './shared/loadout.js';
import { filterChat, BAN_MS } from './shared/chatfilter.js';

const PORT = Number(process.env.PORT) || 3080;
const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Where this server keeps its own files (errors.log, feedback). The game folder when it can be written to;
// an install under C:\Program Files can't be, so fall back to the app's data folder (%APPDATA%\Strikeline).
const DATA = (() => {
  if (process.env.STRIKELINE_DATA_DIR) { try { fs.mkdirSync(process.env.STRIKELINE_DATA_DIR, { recursive: true }); return process.env.STRIKELINE_DATA_DIR; } catch {} }
  try { const t = path.join(ROOT, `.wtest-${process.pid}`); fs.writeFileSync(t, ''); fs.unlinkSync(t); return ROOT; } catch {}
  const d = path.join(process.env.APPDATA || path.join(os.homedir(), '.config'), 'Strikeline');
  try { fs.mkdirSync(d, { recursive: true }); return d; } catch { return os.tmpdir(); }
})();
// A bug in one tick must never take the whole server (and everyone's match) down: log it and keep going.
function errLog(msg) { try { fs.appendFileSync(path.join(DATA, 'errors.log'), `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}\n`); } catch {} }
process.on('uncaughtException', (err) => { errLog(`server: ${err && err.stack || err}`); try { console.error(err); } catch {} });
process.on('unhandledRejection', (err) => errLog(`server (promise): ${err && err.stack || err}`));
const TICK = 1 / 30;

// ------------------------------------------------------------------ static files
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json' };
function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  return out;
}
let APP_VERSION = '0.0.0';
try { APP_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version || APP_VERSION; } catch {}
// ---------- feedback: every message ends up in feedback.txt in the developer's project folder (the one with .git).
// Other servers keep a copy in their own feedback.txt and hold the rest in feedback-outbox.json until the
// developer's app connects; players' apps also keep an outbox and hand it over when they join the developer's server.
const FB_OWNER = process.env.STRIKELINE_FB_OWNER ? process.env.STRIKELINE_FB_OWNER === '1' : fs.existsSync(path.join(ROOT, '.git'));
const FB_TXT = path.join(DATA, 'feedback.txt'), FB_OUT = path.join(DATA, 'feedback-outbox.json'), FB_SEEN = path.join(DATA, 'feedback-ids.json');
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
let fbOutbox = FB_OWNER ? [] : readJson(FB_OUT, null);
const fbSeen = new Set(readJson(FB_SEEN, []));
const saveOutbox = () => { try { fs.writeFileSync(FB_OUT, JSON.stringify(fbOutbox)); return true; } catch { return false; } };
const saveSeen = () => { try { fs.writeFileSync(FB_SEEN, JSON.stringify([...fbSeen].slice(-3000))); } catch {} };
if (!FB_OWNER && !fbOutbox) { // first run with relaying: pick up feedback written here before it existed
  fbOutbox = [];
  try {
    const old = fs.readFileSync(FB_TXT, 'utf8');
    const re = /^\[([0-9: -]{19})\] (.*?)(?: \(([^()\n]*)\))?:\n([\s\S]*?)(?=\n\n\[[0-9: -]{19}\] |\s*(?![\s\S]))/gm;
    let x, i = 0;
    while ((x = re.exec(old))) {
      const [mp, md] = (x[3] || '').split(' / ');
      fbOutbox.push({ id: `legacy-${os.hostname()}-${i++}-${x[1]}`, name: x[2].slice(0, 16), map: mp || '', mode: md || '', text: x[4].trim().slice(0, 1500), at: Date.parse(x[1].replace(' ', 'T') + 'Z') || Date.now() });
    }
  } catch {}
  for (const f of fbOutbox) fbSeen.add(f.id);
  saveOutbox(); saveSeen();
}
function cleanFb(f) {
  if (!f || typeof f !== 'object') return null;
  const text = String(f.text || '').replace(/\r/g, '').slice(0, 1500).trim();
  const id = String(f.id || '').replace(/[^\w:.-]/g, '').slice(0, 80);
  if (!text || !id) return null;
  const s = (v, n) => typeof v === 'string' ? cleanText(v, n) : '';
  return { id, name: s(f.name, 16) || 'Player', map: s(f.map, 20), mode: s(f.mode, 20), text, at: Number(f.at) || Date.now(), via: s(f.via, 40) };
}
function storeFeedback(items) {
  let added = 0;
  for (const f of items) {
    if (fbSeen.has(f.id)) continue;
    fbSeen.add(f.id); added++;
    const where = [f.map, f.mode].filter(Boolean).join(' / ');
    const when = new Date(f.at).toISOString().replace('T', ' ').slice(0, 19);
    try { fs.appendFileSync(FB_TXT, `[${when}] ${f.name}${where ? ` (${where})` : ''}:\n${f.text}\n\n`); } catch (err) { errLog(`feedback write: ${err.message}`); }
    if (!FB_OWNER) fbOutbox.push(f);
    console.log(`[feedback] ${f.name}: ${f.text.slice(0, 80)}`);
  }
  if (added) { saveSeen(); if (!FB_OWNER) saveOutbox(); }
  return added;
}
function setupFile() {
  const dir = process.env.STRIKELINE_SETUP_DIR;
  if (!dir) return null;
  const f = path.join(dir, `Strikeline Setup ${APP_VERSION}.exe`);
  return fs.existsSync(f) ? f : null;
}
const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  if (url === '/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ port: PORT, lan: lanAddresses() }));
    return;
  }
  // Desktop-app auto-update: this host's app version, and its newest installer (only on the developer's PC).
  if (url === '/app/version') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ version: APP_VERSION, setup: !!setupFile() }));
    return;
  }
  if (url === '/app/setup') {
    const f = setupFile();
    if (!f) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Length': fs.statSync(f).size, 'Content-Disposition': 'attachment; filename="Strikeline-Setup.exe"' });
    fs.createReadStream(f).pipe(res);
    return;
  }
  let base = path.join(ROOT, 'public');
  let rel = url === '/' ? '/index.html' : url;
  if (rel.startsWith('/shared/')) { base = path.join(ROOT, 'shared'); rel = rel.slice('/shared'.length); }
  const file = path.normalize(path.join(base, rel));
  if (!file.startsWith(base)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// ------------------------------------------------------------------ helpers
const BOT_NAMES = ['Viper', 'Ghost', 'Havoc', 'Reaper', 'Nova', 'Blitz', 'Talon', 'Raptor', 'Echo', 'Frost', 'Jinx', 'Onyx'];
const CHAR_SKINS = ['ranger', 'crimson', 'ghost', 'cobalt', 'shadow', 'desert', 'toxic', 'royal'];
const DEV_CHAR_SKINS = ['dev', 'devgold'], DEV_W_SKINS = ['dev', 'glitch']; // accepted from players, never given to bots
// Developer badge: a player who has entered the dev code (same code as the dev skins) shows a crown next to their name.
// Only the SHA-256 of the code is here, so the badge can't be faked by typing a name.
const DEV_CODE_SHA = '592825ecebd9678f878dfce975fbb0509465067ff1f8966038b7b36d7cf067e6';
const isDevCode = code => { const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 64); return c.length >= 12 && crypto.createHash('sha256').update(c).digest('hex') === DEV_CODE_SHA; };
const ename = e => (e.client?.dev ? '\u265B ' : '') + e.name;
const dname = c => (c?.dev ? '\u265B ' : '') + (c?.name || '?'); // name for plain-text system messages
const W_SKINS = ['factory', 'arctic', 'woodland', 'tiger', 'crimson', 'carbon', 'gold', 'neon', 'galaxy', 'inferno', 'desert', 'urban', 'jungle', 'hex', 'cobalt'];
const DIFFICULTY = { easy: 0.22, normal: 0.36, hard: 0.55 };
const DEFAULT_SETTINGS = { mode: 'ffa', map: 'town', bots: 4, difficulty: 'normal', scoreLimit: 30, timeLimit: 10, maxPlayers: 8 };
const STREAK_XP = { 3: 100, 5: 200, 7: 300, 10: 500, 15: 750 };
const UAV_STREAK = 4, UAV_TIME = 25, AIRSTRIKE_STREAK = 7;

const MORTAR = { dmg: 130, splash: 5.5 };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r2 = n => Math.round(n * 100) / 100;
const clampInt = (v, a, b, d) => { v = Math.round(Number(v)); return Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : d; };
const cleanText = (n, len) => String(n || '').replace(/[^\w \-\[\]\.!?']/g, '').trim().slice(0, len);
// names and lobby names: no slurs (→ fallback), swears starred out
const cleanName = (n, len, fallback) => { const t = cleanText(n, len); if (!t) return ''; const f = filterChat(t); return f.ban ? fallback : f.text; };

// ---------- chat bans: a slur in chat bans the player for 2 h. Kept by player id (the app's saved id, so it
// follows them between servers) and, for players coming in over the tunnel, their internet address.
const BANS_FILE = path.join(DATA, 'bans.json');
// entries: 'p:<player id>' / 'ip:<address>' → { until, name } (older files: just the time).
// 'lift:<player id>' → time: an unbanned player whose app may still carry the ban; it's ignored and cleared on connect.
const bans = readJson(BANS_FILE, {});
const banEnd = v => (typeof v === 'number' ? v : (v && v.until) || 0);
const saveBans = () => { const now = Date.now(); for (const k in bans) if (banEnd(bans[k]) <= now) delete bans[k]; try { fs.writeFileSync(BANS_FILE, JSON.stringify(bans)); } catch {} };
const banUntil = c => Math.max(c.banUntil || 0, banEnd(bans['p:' + c.pid]), c.ip ? banEnd(bans['ip:' + c.ip]) : 0);
// /unban: only the player sitting at the PC that runs the developer's server (not over the tunnel or the LAN)
const plainName = s => String(s || '').replace(/^♛\s*/, '').trim().toLowerCase();
function unban(byName) {
  const want = plainName(byName), all = want === 'all', names = new Set(), now = Date.now();
  const hit = (name) => all || (name && plainName(name).startsWith(want));
  for (const k of Object.keys(bans)) {
    if (k.startsWith('lift:')) continue;
    const v = bans[k], name = typeof v === 'number' ? '' : v.name;
    if (!hit(name)) continue;
    if (k.startsWith('p:')) bans['lift:' + k.slice(2)] = banEnd(v);
    if (name) names.add(name);
    delete bans[k];
  }
  for (const c of clients.values()) {
    if (!(c.banUntil > now) || !hit(c.name)) continue;
    c.banUntil = 0; names.add(c.name);
    if (c.pid) { bans['lift:' + c.pid] = now + BAN_MS; delete bans['p:' + c.pid]; }
    if (c.ip) delete bans['ip:' + c.ip];
  }
  saveBans();
  for (const c of clients.values()) if (!isBanned(c) && (names.has(c.name) || (all && c.pid && bans['lift:' + c.pid]))) sendTo(c, { t: 'unbanned' });
  return [...names];
}
const isBanned = c => banUntil(c) > Date.now();
function banMsg(c) { const mins = Math.max(1, Math.ceil((banUntil(c) - Date.now()) / 60000)); return `You're banned for using a slur in chat. Time left: ${mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`}.`; }
function banClient(c) {
  const until = Date.now() + BAN_MS;
  c.banUntil = until;
  if (c.pid) { bans['p:' + c.pid] = { until, name: c.name }; delete bans['lift:' + c.pid]; }
  if (c.ip) bans['ip:' + c.ip] = { until, name: c.name };
  saveBans();
  const room = c.room;
  console.log(`[ban] ${c.name} banned for 2 h (slur in chat)`);
  errLog(`chat ban: ${c.name} (2 h)`);
  sendTo(c, { t: 'banned', until }); // first, so the client has saved the ban before 'left' can send it home
  if (room) { leaveRoom(c); roomBroadcast(room, { t: 'chat', n: '', m: `${dname(c)} was banned for 2 hours for hate speech` }); }
}
const isVec = (v, n = 3) => Array.isArray(v) && v.length === n && v.every(x => typeof x === 'number' && Number.isFinite(x));
const wrapAngle = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

function sanitizeSettings(s, base) {
  return {
    mode: MODES[s.mode] ? s.mode : base.mode,
    map: MAP_ORDER.includes(s.map) || s.map === 'random' ? s.map : base.map,
    bots: clampInt(s.bots ?? base.bots, 0, 14, base.bots),
    difficulty: DIFFICULTY[s.difficulty] ? s.difficulty : base.difficulty,
    scoreLimit: clampInt(s.scoreLimit ?? base.scoreLimit, 5, 100, base.scoreLimit),
    timeLimit: clampInt(s.timeLimit ?? base.timeLimit, 3, 30, base.timeLimit),
    maxPlayers: clampInt(s.maxPlayers ?? base.maxPlayers, 2, 16, base.maxPlayers),
  };
}

let nextId = 1;
const clients = new Map();
const rooms = new Map();
function sendTo(c, msg) { if (c && c.ws && c.ws.readyState === 1) c.ws.send(JSON.stringify(msg)); }
function roomBroadcast(room, msg, exceptId) {
  const s = JSON.stringify(msg);
  for (const id of room.members) {
    if (id === exceptId) continue;
    const c = clients.get(id);
    if (c && c.ws.readyState === 1) c.ws.send(s);
  }
}
const teamsOn = room => MODES[room.settings.mode].teams;
const enemies = (room, a, b) => a !== b && (!teamsOn(room) || a.team !== b.team);

// ------------------------------------------------------------------ lobbies
function roomInfo(room) {
  return {
    id: room.id, code: room.code, name: room.name, hostId: room.hostId, private: room.private, state: room.state,
    settings: room.settings, mapId: room.mapId || null,
    members: [...room.members].map(id => { const c = clients.get(id); return { id, name: c.name, dev: c.dev ? 1 : 0, skin: c.skin, wskin: c.wskin, level: c.level, ready: room.ready.has(id) }; }),
  };
}
function sendRoom(room) { roomBroadcast(room, { t: 'room', room: roomInfo(room) }); scheduleLobbies(); }
function lobbyList() {
  return [...rooms.values()].filter(r => !r.private).map(r => ({
    id: r.id, name: r.name, host: clients.get(r.hostId)?.name || '?', hdev: clients.get(r.hostId)?.dev ? 1 : 0, map: r.state === 'lobby' ? r.settings.map : r.mapId, mode: r.settings.mode,
    players: r.members.size, max: r.settings.maxPlayers, state: r.state, bots: r.settings.bots,
  }));
}
// ------------------------------------------------------------------ lobbies across everyone's games
// Every desktop app runs its own server behind a Cloudflare quick tunnel. Each server posts its lobbies
// (code, name, map, players + its public address) to a shared relay topic, so a 4-letter code or the
// server browser works no matter whose game the lobby is in: the player is sent to that game.
const RELAY = process.env.STRIKELINE_RELAY || 'https://ntfy.sh/strikeline-lobbies-q8v3m1';
let publicUrl = process.env.STRIKELINE_PUBLIC_URL || '';
async function findPublicUrl() { // cloudflared reports its quick-tunnel hostname on its local metrics port
  if (process.env.STRIKELINE_PUBLIC_URL) return;
  for (let p = 20241; p <= 20245; p++) {
    try {
      const r = await fetch(`http://127.0.0.1:${p}/quicktunnel`, { signal: AbortSignal.timeout(1500) });
      const j = await r.json();
      // several games on one PC each have a tunnel: only take the one pointing at this server
      if (j.hostname) {
        const u = 'https://' + j.hostname;
        const mine = await fetch(`${u}/info`, { signal: AbortSignal.timeout(6000) }).then(x => x.json()).then(x => x.port === PORT).catch(() => false);
        if (!mine) continue;
        if (u !== publicUrl) { publicUrl = u; console.log(`  Public address: ${u}`); lastAnnounce = ''; announceSoon(0); }
        return;
      }
    } catch {}
  }
}
setInterval(findPublicUrl, 45000); setTimeout(findPublicUrl, 3000);
const relayRoom = r => ({ c: r.code, n: r.name, h: clients.get(r.hostId)?.name || '?', hd: clients.get(r.hostId)?.dev ? 1 : 0, m: r.state === 'lobby' ? r.settings.map : r.mapId, mo: r.settings.mode,
  p: r.members.size, x: r.settings.maxPlayers, s: r.state, b: r.settings.bots, pr: r.private ? 1 : 0 });
let lastAnnounce = '', lastAnnounceAt = 0, announceTimer = null;
function announceSoon(ms = 2500) { if (!announceTimer) announceTimer = setTimeout(announce, ms); }
async function announce() {
  announceTimer = null;
  if (!publicUrl) return;
  const r = [...rooms.values()].map(relayRoom);
  const body = JSON.stringify({ u: publicUrl, v: APP_VERSION, r });
  if (body === lastAnnounce && (!r.length || Date.now() - lastAnnounceAt < 150000)) return; // only on change, plus a heartbeat while lobbies exist
  lastAnnounce = body; lastAnnounceAt = Date.now();
  try { await fetch(RELAY, { method: 'POST', body, signal: AbortSignal.timeout(8000) }); } catch { lastAnnounce = ''; }
}
setInterval(() => { if (rooms.size) announceSoon(0); }, 160000);
let relayCache = { at: 0, list: [] }, relayPending = null;
async function remoteLobbies() { // latest announcement from every other game, ignoring ones that went quiet
  if (Date.now() - relayCache.at < 6000) return relayCache.list;
  if (relayPending) return relayPending;
  relayPending = (async () => {
    try {
      const txt = await (await fetch(`${RELAY}/json?poll=1&since=6m`, { signal: AbortSignal.timeout(6000) })).text();
      const latest = new Map();
      for (const line of txt.split('\n')) {
        let m; try { m = JSON.parse(line); } catch { continue; }
        if (m.event !== 'message' || !m.message) continue;
        let a; try { a = JSON.parse(m.message); } catch { continue; }
        if (!a || typeof a.u !== 'string' || !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(a.u) || !Array.isArray(a.r)) continue;
        if (a.u === publicUrl) continue;
        const prev = latest.get(a.u);
        if (!prev || m.time >= prev.time) latest.set(a.u, { time: m.time, a });
      }
      const now = Date.now() / 1000, list = [];
      for (const { time, a } of latest.values()) {
        if (now - time > 330) continue;
        for (const x of a.r.slice(0, 20)) if (x && typeof x.c === 'string' && /^[A-Z]{4}$/.test(x.c))
          list.push({ url: a.u, code: x.c, name: cleanText(x.n, 28) || 'Lobby', host: cleanText(x.h, 16) || '?', hdev: x.hd ? 1 : 0, map: String(x.m || '').slice(0, 24), mode: String(x.mo || 'ffa').slice(0, 16),
            players: clampInt(x.p, 0, 64, 0), max: clampInt(x.x, 1, 64, 8), state: x.s === 'lobby' ? 'lobby' : 'playing', bots: clampInt(x.b, 0, 32, 0), private: !!x.pr });
      }
      relayCache = { at: Date.now(), list };
    } catch { relayCache = { at: Date.now() - 3000, list: relayCache.list }; }
    relayPending = null;
    return relayCache.list;
  })();
  return relayPending;
}
// ---------- feedback straight to the developer over the relay: servers that aren't the developer's post what
// they hold to a feedback topic (again every 2 h until confirmed, since the relay only keeps messages ~12 h);
// the developer's server polls it, saves anything new and posts the ids back on an ack topic, which the
// others poll to clear their outbox. Joining each other's games still hands feedback over as a backup.
const FB_RELAY = `${RELAY}-fb`, FB_ACK = `${RELAY}-fback`;
const fbPosted = new Map(); // id -> when this server last posted it
const relayLines = (txt) => txt.split('\n').map(l => { try { const m = JSON.parse(l); return m.event === 'message' && m.message ? m : null; } catch { return null; } }).filter(Boolean);
async function fbPush() {
  if (FB_OWNER || !fbOutbox.length) return;
  for (const f of fbOutbox.slice(0, 20)) {
    if (Date.now() - (fbPosted.get(f.id) || 0) < 2 * 3600e3) continue;
    const g = { sfb: 1, ...f };
    while (Buffer.byteLength(JSON.stringify(g)) > 3900 && g.text.length > 50) g.text = g.text.slice(0, Math.floor(g.text.length * 0.8)); // relay message limit
    try {
      const r = await fetch(FB_RELAY, { method: 'POST', body: JSON.stringify(g), signal: AbortSignal.timeout(8000) });
      if (!r.ok) break;
      fbPosted.set(f.id, Date.now());
    } catch { break; }
  }
}
async function fbPollAcks() {
  if (FB_OWNER || !fbOutbox.length) return;
  try {
    const txt = await (await fetch(`${FB_ACK}/json?poll=1&since=12h`, { signal: AbortSignal.timeout(8000) })).text();
    const ids = new Set();
    for (const m of relayLines(txt)) { try { const j = JSON.parse(m.message); if (Array.isArray(j.acks)) for (const i of j.acks) ids.add(String(i)); } catch {} }
    const before = fbOutbox.length;
    fbOutbox = fbOutbox.filter(f => !ids.has(f.id));
    if (fbOutbox.length !== before) { saveOutbox(); console.log(`[feedback] ${before - fbOutbox.length} message(s) confirmed by the developer`); }
  } catch {}
}
let fbSince = '12h';
async function fbPull() { // developer's server only
  if (!FB_OWNER) return;
  try {
    const txt = await (await fetch(`${FB_RELAY}/json?poll=1&since=${fbSince}`, { signal: AbortSignal.timeout(8000) })).text();
    const items = [];
    for (const m of relayLines(txt)) {
      fbSince = m.id;
      let j; try { j = JSON.parse(m.message); } catch { continue; }
      const f = j && j.sfb ? cleanFb(j) : null;
      if (f) items.push(f);
    }
    if (!items.length) return;
    storeFeedback(items);
    const ids = [...new Set(items.map(f => f.id))];
    for (let i = 0; i < ids.length; i += 40)
      await fetch(FB_ACK, { method: 'POST', body: JSON.stringify({ acks: ids.slice(i, i + 40) }), signal: AbortSignal.timeout(8000) }).catch(() => {});
  } catch {}
}
if (FB_OWNER) { setTimeout(fbPull, 4000); setInterval(fbPull, 60000); }
else { setTimeout(fbPush, 6000); setInterval(fbPush, 60000); setTimeout(fbPollAcks, 90000); setInterval(fbPollAcks, 150000); }
// Is a friend's game still answering at that address? (dead quick tunnels give Cloudflare error 1033 / HTTP 530)
const aliveCache = new Map(); // url -> { at, ok }
async function gameAlive(u, maxAge = 0) {
  const k = aliveCache.get(u);
  if (k && Date.now() - k.at < maxAge) return k.ok;
  let ok = false;
  for (let i = 0; i < 2 && !ok; i++) {
    ok = await fetch(`${u}/info`, { signal: AbortSignal.timeout(5000) }).then(r => r.ok && r.json()).then(j => !!j && typeof j.port === 'number').catch(() => false);
  }
  aliveCache.set(u, { at: Date.now(), ok });
  if (aliveCache.size > 50) aliveCache.delete(aliveCache.keys().next().value);
  return ok;
}
async function sendLobbies(c) {
  sendTo(c, { t: 'lobbies', list: lobbyList(), online: clients.size });
  let remote = (await remoteLobbies()).filter(l => !l.private);
  // hide lobbies in games that have closed since they last announced (checked at most once a minute per game)
  const urls = [...new Set(remote.map(l => l.url))];
  const alive = new Set((await Promise.all(urls.map(async u => (await gameAlive(u, 60000)) ? u : null))).filter(Boolean));
  remote = remote.filter(l => alive.has(l.url));
  if (remote.length && clients.has(c.id) && !c.room) sendTo(c, { t: 'lobbies', list: lobbyList(), remote, online: clients.size });
}

let lobbyTimer = null;
function scheduleLobbies() {
  announceSoon();
  if (lobbyTimer) return;
  lobbyTimer = setTimeout(() => {
    lobbyTimer = null;
    const msg = JSON.stringify({ t: 'lobbies', list: lobbyList(), online: clients.size });
    for (const c of clients.values()) if (!c.room && c.ws.readyState === 1) c.ws.send(msg);
  }, 120);
}
function genCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (;;) {
    const code = Array.from({ length: 4 }, () => pick(L)).join('');
    if (![...rooms.values()].some(r => r.code === code)) return code;
  }
}
function createRoom(c, m) {
  if (isBanned(c)) { sendTo(c, { t: 'err', m: banMsg(c) }); return; }
  const room = {
    id: nextId++, code: genCode(), name: cleanName(m.name, 28, '') || `${c.name}'s lobby`, hostId: c.id, private: !!m.private,
    settings: sanitizeSettings(m.settings || {}, DEFAULT_SETTINGS), state: 'lobby', members: new Set(), ready: new Set(),
    ents: new Map(), map: null, mapId: null, nav: null, rockets: [], nades: [], fireZones: [], smokes: [], nextProjId: 1, timeLeft: 0, endTimer: 0, tick: 0,
    teamScore: [0, 0], zones: [], zone: null, firstBlood: false, hpAcc: 0, tags: [], strikes: [],
  };
  rooms.set(room.id, room);
  console.log(`[lobby] ${c.name} created "${room.name}" (code ${room.code})`);
  joinRoom(c, room);
}
function joinRoom(c, room) {
  if (c.room === room) return;
  if (isBanned(c)) { sendTo(c, { t: 'err', m: banMsg(c) }); return; }
  if (room.members.size >= room.settings.maxPlayers) { sendTo(c, { t: 'err', m: 'That lobby is full.' }); return; }
  if (c.room) leaveRoom(c, true);
  room.members.add(c.id);
  c.room = room;
  sendRoom(room);
  roomBroadcast(room, { t: 'chat', n: '', m: `${dname(c)} joined the lobby` });
  if (room.state !== 'lobby') {
    const e = addEnt(room, c);
    balanceBots(room);
    sendStart(room, c);
    roomBroadcast(room, { t: 'pj', p: publicInfo(e) }, c.id);
    sendScores(room);
  }
}
function leaveRoom(c, silent) {
  const room = c.room;
  if (!room) return;
  room.members.delete(c.id);
  room.ready.delete(c.id);
  c.room = null;
  if (room.ents.has(c.id)) { room.ents.delete(c.id); roomBroadcast(room, { t: 'pl', id: c.id }); }
  if (!silent) sendTo(c, { t: 'left' });
  if (room.members.size === 0) { rooms.delete(room.id); scheduleLobbies(); return; }
  if (room.hostId === c.id) {
    room.hostId = [...room.members][0];
    roomBroadcast(room, { t: 'chat', n: '', m: `${dname(clients.get(room.hostId))} is now the host` });
  }
  roomBroadcast(room, { t: 'chat', n: '', m: `${dname(c)} left` });
  sendRoom(room);
}

// ------------------------------------------------------------------ entities & lifecycle
function makeEnt(f) {
  return Object.assign({
    id: nextId++, name: 'Player', bot: false, skin: 'ranger', wskin: 'factory', client: null, team: -1,
    pos: [0, 0, 0], vel: [0, 0, 0], onGround: true, height: PLAYER.height, ry: 0, rx: 0, w: 'falcon', c: 0,
    hp: 100, alive: false, respawnAt: Date.now() + 400, protectUntil: 0, lastDmg: 0,
    perks: [], streaks: null, ready: [], armor: 0,
    kills: 0, deaths: 0, assists: 0, score: 0, streak: 0, gg: 0, nades: 2, tacs: 2, burnUntil: 0, lastFire: 0, lastNade: 0, lastKiller: 0, damagers: new Map(), ddUntil: 0, spdUntil: 0,
  }, f);
}
// Fire-rate check that tolerates network bunching: shots arriving in a clump are fine as long as the
// average rate stays within the weapon's fire rate (+25%). The old "min gap between packets" rule
// silently dropped real shots from players on bumpy connections.
function fireAllowed(e, def, now) {
  const rate = (def.rpm / 60) * 1.25, cap = 6;
  if (e.fireBudgetT === undefined) { e.fireBudget = cap; e.fireBudgetT = now; }
  e.fireBudget = Math.min(cap, e.fireBudget + ((now - e.fireBudgetT) / 1000) * rate);
  e.fireBudgetT = now;
  if (e.fireBudget < 1) return false;
  e.fireBudget -= 1; e.lastFire = now;
  return true;
}
function publicInfo(e) {
  return { id: e.id, name: e.name, dv: e.client?.dev ? 1 : 0, bot: e.bot, skin: e.skin, wskin: e.wskin, team: e.team, kills: e.kills, deaths: e.deaths, score: e.score, gg: e.gg, alive: e.alive, w: e.w, pk: e.perks };
}
function smallerTeam(room) {
  const n = [0, 0];
  for (const e of room.ents.values()) if (e.team >= 0) n[e.team]++;
  return n[0] <= n[1] ? 0 : 1;
}
function addEnt(room, c) {
  const e = makeEnt({ id: c.id, client: c, name: c.name, skin: c.skin, wskin: c.wskin, perks: c.perks || [], streaks: c.streaks || null });
  if (teamsOn(room)) e.team = room.settings.mode === 'infected' ? (room.infectStarted ? 1 : 0) : smallerTeam(room);
  if (e.team === 1 && room.settings.mode === 'infected') { e.w = 'knife'; e.skin = 'toxic'; }
  if (room.settings.mode === 'gungame') e.w = GUNGAME_LADDER[0];
  room.ents.set(e.id, e);
  return e;
}
function sendStart(room, c) {
  sendTo(c, { t: 'start', id: c.id, map: room.mapId, mode: room.settings.mode, time: room.timeLeft, scoreLimit: room.settings.scoreLimit,
    target: targetScore(room.settings.mode, room.settings.scoreLimit), phase: room.state, teamScore: room.teamScore,
    zone: room.zone ? [room.zone.x, room.zone.z, ZONE_RADIUS] : null, players: [...room.ents.values()].map(publicInfo) });
}
function sendScores(room) {
  roomBroadcast(room, { t: 'sc', s: [...room.ents.values()].map(e => [e.id, e.kills, e.deaths, e.score, e.team, e.gg, e.assists]), ts: room.teamScore });
}
function pickZones(room) {
  const map = room.map, lim = map.size * 0.33;
  const cands = map.spawns.concat(map.waypoints.filter((_, i) => i % 3 === 0)).filter(p => Math.abs(p[0]) < lim && Math.abs(p[2]) < lim);
  if (!cands.length) return [{ x: 0, z: 0 }];
  const out = [cands.reduce((a, c) => (Math.hypot(c[0], c[2]) < Math.hypot(a[0], a[2]) ? c : a))];
  while (out.length < 4) {
    let best = null, bd = -1;
    for (const c of cands) { let md = Infinity; for (const o of out) md = Math.min(md, Math.hypot(c[0] - o[0], c[2] - o[2])); if (md > bd) { bd = md; best = c; } }
    out.push(best);
  }
  return out.map(p => ({ x: p[0], z: p[2] }));
}
function startMatch(room) {
  const s = room.settings;
  room.mapId = s.map === 'random' ? pick(MAP_ORDER) : s.map;
  room.map = buildMap(room.mapId);
  room.nav = buildNav(room.map);
  room.state = 'playing';
  room.timeLeft = s.timeLimit * 60;
  room.rockets = []; room.nades = []; room.tags = []; room.strikes = []; room.fireZones = []; room.smokes = [];
  room.teamScore = [0, 0];
  room.firstBlood = false;
  room.ents = new Map();
  room.ready.clear();
  room.zone = null;
  if (s.mode === 'hardpoint') { room.zones = pickZones(room); room.zone = { ...room.zones[0], idx: 0, ttm: ZONE_MOVE, state: -1 }; }
  for (const id of room.members) addEnt(room, clients.get(id));
  room.infectStarted = false;
  room.pickups = room.map.pickups.map(p => ({ ...p, readyAt: 0 }));
  syncBots(room, true);
  for (const id of room.members) sendStart(room, clients.get(id));
  if (s.mode === 'infected') {
    const all = [...room.ents.values()].sort(() => Math.random() - 0.5);
    const zeros = Math.max(1, Math.round(all.length / 6));
    for (let i = 0; i < Math.min(zeros, all.length - 1 || 1); i++) infect(room, all[i], true);
    room.infectStarted = true;
  }
  sendRoom(room);
  sendScores(room);
  console.log(`[match] "${room.name}" started: ${MODES[s.mode].name} on ${MAPS[room.mapId].name}`);
}
function endMatch(room) {
  if (room.state !== 'playing') return;
  room.state = 'ended';
  room.endTimer = 12;
  room.rockets = []; room.nades = []; room.tags = []; room.strikes = []; room.fireZones = []; room.smokes = [];
  const mode = room.settings.mode;
  const all = [...room.ents.values()];
  let winTeam = -1, winId = 0;
  if (teamsOn(room)) winTeam = room.teamScore[0] === room.teamScore[1] ? -1 : room.teamScore[0] > room.teamScore[1] ? 0 : 1;
  if (mode === 'infected') winTeam = [...room.ents.values()].some(e => e.team === 0) ? 0 : 1;
  if (!teamsOn(room) && all.length) {
    const best = all.slice().sort((a, b) => mode === 'gungame' ? (b.gg - a.gg || b.kills - a.kills) : (b.kills - a.kills || a.deaths - b.deaths))[0];
    winId = best.id;
  }
  for (const e of all) {
    const won = teamsOn(room) ? e.team === winTeam : e.id === winId;
    if (won) giveXP(room, e, 500, 'VICTORY');
    giveXP(room, e, 150, 'MATCH BONUS');
  }
  const sorted = all.slice().sort((a, b) => mode === 'gungame' ? (b.gg - a.gg || b.score - a.score) : (b.score - a.score || b.kills - a.kills));
  const standings = sorted.map(e => [e.id, e.name, e.kills, e.deaths, e.bot ? 1 : 0, e.score, e.team, e.gg, e.assists, e.client?.dev ? 1 : 0]);
  roomBroadcast(room, { t: 'end', standings, mode, winTeam, winId, teamScore: room.teamScore, back: room.endTimer });
  sendRoom(room);
}
function backToLobby(room) {
  room.state = 'lobby';
  room.ents = new Map();
  room.rockets = []; room.nades = []; room.tags = []; room.strikes = []; room.fireZones = []; room.smokes = [];
  roomBroadcast(room, { t: 'lobby' });
  sendRoom(room);
}

// ------------------------------------------------------------------ scoring
function giveXP(room, e, amt, reason) {
  if (!e) return;
  e.score += amt;
  if (e.client) sendTo(e.client, { t: 'xp', a: amt, r: reason });
}
function chooseSpawn(room, p) {
  const others = [...room.ents.values()].filter(o => o.alive && enemies(room, o, p));
  const mates = teamsOn(room) ? [...room.ents.values()].filter(o => o !== p && o.alive && o.team === p.team) : [];
  if (room.settings.mode === 'infected' && p.team === 1 && others.length) { // zombies spawn 18-30m from a survivor
    const sc = room.map.spawns.map(s => { let md = 999; for (const o of others) md = Math.min(md, dist3(s, o.pos)); return { s, sc: -Math.abs(md - 24) }; }).sort((a, b) => b.sc - a.sc);
    return pick(sc.slice(0, 3)).s;
  }
  const scored = room.map.spawns.map(s => {
    let md = 999, mate = 0;
    for (const o of others) md = Math.min(md, dist3(s, o.pos));
    for (const o of mates) mate += Math.max(0, 25 - dist3(s, o.pos)) * 0.3;
    return { s, sc: Math.min(md, 40) + mate };
  }).sort((a, b) => b.sc - a.sc);
  return pick(scored.slice(0, 3)).s;
}
function spawn(room, p) {
  const s = chooseSpawn(room, p);
  p.pos = [s[0], s[1], s[2]];
  p.vel = [0, 0, 0];
  if (p.pt != null) { p.pt = Math.max(p.pt + 1, Math.round(performance.now())); if (p.hist) p.hist.length = 0; } // respawn shows at once
  if (p.client?.perks) p.perks = p.client.perks;                                     // perk changes apply from the next life
  p.hp = 100; p.armor = 0; p.alive = true; p.streak = 0; p.nades = 2; p.tacs = 2; p.burnUntil = 0; p.ddUntil = 0; p.spdUntil = 0;
  p.protectUntil = Date.now() + 2000;
  p.damagers.clear();
  if (room.settings.mode === 'gungame') p.w = GUNGAME_LADDER[Math.min(p.gg, GUNGAME_LADDER.length - 1)];
  if (room.settings.mode === 'infected' && p.team === 1) p.w = 'knife';
  else if (room.settings.mode === 'infected' && p.bot && p.w === 'knife') p.w = pick(BOT_WEAPONS);
  const toCentre = Math.atan2(s[0], s[2]);
  let bestRy = toCentre, bestScore = -1;
  for (let i = 0; i < 12; i++) {
    const ry = toCentre + (i / 12) * Math.PI * 2;
    const hit = raycastBoxes([s[0], 1.6, s[2]], [-Math.sin(ry), 0, -Math.cos(ry)], 40, room.map.boxes);
    const score = (hit ? hit.t : 40) * (1 - 0.3 * Math.min(i, 12 - i) / 6);
    if (score > bestScore) { bestScore = score; bestRy = ry; }
  }
  p.ry = bestRy;
  if (p.bot) Object.assign(p.ai, { target: null, path: null, mag: WEAPONS[p.w].mag, reloadUntil: 0, seenAt: 0, stuckT: 0, lastPos: [...p.pos], lastKnown: null });
  roomBroadcast(room, { t: 'spawn', id: p.id, p: p.pos, ry: p.ry, w: room.settings.mode === 'gungame' || room.settings.mode === 'infected' ? p.w : undefined });
}
function applyDamage(room, victim, attacker, amount, weaponId, head) {
  if (!victim.alive || room.state !== 'playing') return;
  if (Date.now() < victim.protectUntil) return;
  if (attacker && attacker !== victim && teamsOn(room) && attacker.team === victim.team) return; // no friendly fire
  if (attacker && attacker.ddUntil > Date.now()) amount *= 2; // double damage power-up
  if (room.settings.mode === 'infected' && victim.team === 1 && attacker !== victim) amount *= 0.5; // the horde is tough
  const def = WEAPONS[weaponId];
  if (victim.perks.includes('flak') && (def?.splash || def?.flame || ['molotov', 'flamer', 'airstrike', 'mortar'].includes(weaponId) || victim.burnUntil > Date.now())) amount *= 0.55;
  if (victim.armor > 0 && weaponId !== 'fall') {                                       // Armor Up killstreak
    const soak = Math.min(victim.armor, amount);
    victim.armor -= soak; amount -= soak;
    if (victim.client) sendTo(victim.client, { t: 'armor', v: Math.round(victim.armor) });
    if (amount < 0.5) { if (attacker?.client && attacker !== victim) sendTo(attacker.client, { t: 'dmg', id: victim.id, by: attacker.id, amt: 0, hp: victim.hp, h: head ? 1 : 0, armor: 1 }); return; }
  }
  amount = Math.max(1, Math.round(amount));
  victim.hp -= amount;
  victim.lastDmg = Date.now();
  if (attacker && attacker !== victim) victim.damagers.set(attacker.id, Date.now());
  roomBroadcast(room, { t: 'dmg', id: victim.id, by: attacker ? attacker.id : 0, amt: amount, hp: Math.max(0, victim.hp), h: head ? 1 : 0, from: attacker ? attacker.pos : null });
  if (victim.hp <= 0) kill(room, victim, attacker, weaponId, head);
}
function kill(room, victim, attacker, weaponId, head) {
  const now = Date.now(), mode = room.settings.mode;
  const self = !attacker || attacker === victim;
  const victimStreak = victim.streak;
  victim.alive = false; victim.hp = 0; victim.deaths++; victim.streak = 0;
  victim.respawnAt = now + (mode === 'infected' && victim.team === 1 ? 1500 : 3500);
  if (!self) { attacker.kills++; attacker.streak++; }
  else victim.kills = Math.max(0, victim.kills - 1);
  roomBroadcast(room, { t: 'kill', k: attacker ? attacker.id : 0, v: victim.id, w: weaponId, h: head ? 1 : 0, st: !self ? attacker.streak : 0 });
  if (!self) {
    giveXP(room, attacker, 100, 'KILL');
    if (head) giveXP(room, attacker, 50, 'HEADSHOT');
    if (!room.firstBlood) { room.firstBlood = true; giveXP(room, attacker, 100, 'FIRST BLOOD'); }
    if (weaponId === 'knife') giveXP(room, attacker, 50, 'MELEE');
    if (weaponId === 'frag') giveXP(room, attacker, 50, 'GRENADE');
    if (attacker.lastKiller === victim.id) { giveXP(room, attacker, 50, 'PAYBACK'); attacker.lastKiller = 0; }
    if (victimStreak >= 5) giveXP(room, attacker, 100, 'BUZZKILL');
    if (!WEAPONS[weaponId]?.splash && dist3(attacker.pos, victim.pos) > 40) giveXP(room, attacker, 50, 'LONGSHOT');
    if (STREAK_XP[attacker.streak]) giveXP(room, attacker, STREAK_XP[attacker.streak], `${attacker.streak} KILL STREAK`);
    if (attacker.streaks) {                                                           // chosen streaks: earned, then activated by the player
      for (const id of attacker.streaks) if (attacker.streak === streakCost(id, attacker.perks)) {
        attacker.ready.push(id);
        if (attacker.client) sendTo(attacker.client, { t: 'streakready', id, ready: attacker.ready });
      }
    } else {                                                                          // bots and older games: automatic
      if (attacker.streak === UAV_STREAK) activateStreak(room, attacker, 'radar', null, now);
      if (attacker.streak === AIRSTRIKE_STREAK) callAirstrike(room, attacker, now);
    }
    victim.lastKiller = attacker.id;
  }
  for (const [id, t] of victim.damagers) {
    if (attacker && id === attacker.id) continue;
    const a = room.ents.get(id);
    if (a && now - t < 8000 && a !== victim) { a.assists++; giveXP(room, a, 50, 'ASSIST'); }
  }
  victim.damagers.clear();

  // mode rules
  if (!self) {
    if (mode === 'tdm') room.teamScore[attacker.team]++;
    if (mode === 'infected' && victim.team === 0) {
      infect(room, victim);
      giveXP(room, attacker, 50, 'INFECTION');
      if (![...room.ents.values()].some(e => e.team === 0)) { sendScores(room); endMatch(room); return; }
    }
    if (mode === 'kc') {
      room.tags.push({ id: room.nextProjId++, x: victim.pos[0], y: victim.pos[1] + 0.6, z: victim.pos[2], team: victim.team, born: now });
      if (room.tags.length > 40) room.tags.shift();
    }
    if (mode === 'gungame') {
      if (weaponId === 'knife' && victim.gg > 0) { victim.gg--; victim.w = GUNGAME_LADDER[victim.gg]; roomBroadcast(room, { t: 'gg', id: victim.id, lvl: victim.gg, w: victim.w, demoted: 1 }); }
      attacker.gg++;
      if (attacker.gg >= GUNGAME_LADDER.length) { sendScores(room); endMatch(room); return; }
      attacker.w = GUNGAME_LADDER[attacker.gg];
      giveXP(room, attacker, 50, 'GUN UP');
      roomBroadcast(room, { t: 'gg', id: attacker.id, lvl: attacker.gg, w: attacker.w });
      if (attacker.bot) attacker.ai.mag = WEAPONS[attacker.w].mag;
    }
  }
  sendScores(room);
  if (!self) {
    if (mode === 'ffa' && attacker.kills >= room.settings.scoreLimit) endMatch(room);
    if (mode === 'tdm' && room.teamScore[attacker.team] >= room.settings.scoreLimit) endMatch(room);
  }
}

// ------------------------------------------------------------------ bots
function syncBots(room, silent) {
  const bots = [...room.ents.values()].filter(p => p.bot);
  while (bots.length < room.settings.bots) {
    const used = new Set(bots.map(b => b.name));
    const name = BOT_NAMES.find(n => !used.has('[BOT] ' + n)) || 'Bot' + nextId;
    const b = makeEnt({ bot: true, name: '[BOT] ' + name, skin: pick(CHAR_SKINS), wskin: pick(W_SKINS), w: pick(BOT_WEAPONS) });
    if (teamsOn(room)) b.team = room.settings.mode === 'infected' ? (room.infectStarted ? 1 : 0) : smallerTeam(room);
    if (room.settings.mode === 'gungame') b.w = GUNGAME_LADDER[0];
    b.ai = { strafe: 1, strafeT: 0, burst: 0, pauseUntil: 0, nextShot: 0, mag: WEAPONS[b.w].mag, reloadUntil: 0, seenAt: 0, stuckT: 0, lastPos: [0, 0, 0], path: null, nadeCd: 0 };
    room.ents.set(b.id, b);
    bots.push(b);
    if (!silent) roomBroadcast(room, { t: 'pj', p: publicInfo(b) });
  }
  while (bots.length > room.settings.bots) {
    const b = bots.pop();
    room.ents.delete(b.id);
    roomBroadcast(room, { t: 'pl', id: b.id });
  }
}
function balanceBots(room) {
  if (room.settings.mode === 'infected') { updateInfectedScore(room); return; }
  if (!teamsOn(room)) return;
  const n = [0, 0];
  for (const e of room.ents.values()) if (e.team >= 0) n[e.team]++;
  if (Math.abs(n[0] - n[1]) < 2) return;
  const big = n[0] > n[1] ? 0 : 1;
  const bot = [...room.ents.values()].find(e => e.bot && e.team === big);
  if (bot) { bot.team = 1 - big; roomBroadcast(room, { t: 'pj', p: publicInfo(bot) }); }
}
const eye = p => [p.pos[0], p.pos[1] + (p.c ? PLAYER.crouchEye : PLAYER.eye), p.pos[2]];
const chest = p => [p.pos[0], p.pos[1] + (p.c ? 0.8 : 1.15), p.pos[2]];
function hasLOS(room, a, b, throughSmoke = false) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  if (len < 0.01) return true;
  const dir = [d[0] / len, d[1] / len, d[2] / len];
  if (!throughSmoke && room.smokes?.length) for (const s of room.smokes) { // smoke clouds block sight
    const ox = s.x - a[0], oy = s.y + 1.2 - a[1], oz = s.z - a[2];
    const t = Math.max(0, Math.min(len, ox * dir[0] + oy * dir[1] + oz * dir[2]));
    if (Math.hypot(ox - dir[0] * t, oy - dir[1] * t, oz - dir[2] * t) < s.r * 0.8) return false;
  }
  return !raycastBoxes(a, dir, len, room.map.query(a[0], a[2], b[0], b[2]));
}

// Pick where a roaming bot should head next
function botGoal(room, b) {
  const nav = room.nav, ai = b.ai;
  if (room.settings.mode === 'infected' && b.team === 1) { // the horde hunts the closest survivor
    let best = null, bd = Infinity;
    for (const o of room.ents.values()) if (o.alive && o.team === 0) { const d = dist3(o.pos, b.pos); if (d < bd) { bd = d; best = o; } }
    if (best) { ai.repathAt = Date.now() + 3000; const id = nav.nearest(...best.pos); if (id >= 0) return id; }
  }
  if (ai.lastKnown) { const id = nav.nearest(...ai.lastKnown); ai.lastKnown = null; if (id >= 0) return id; }
  if (room.pickups && Math.random() < 0.8) { // go grab health when hurt / power-ups when nearby
    const now = Date.now();
    const want = room.pickups.filter(p => p.readyAt <= now && ((p.kind === 'health' && b.hp < 55) || ((p.kind === 'damage' || p.kind === 'speed') && Math.hypot(p.x - b.pos[0], p.z - b.pos[2]) < 25)));
    if (want.length) { const p = want.reduce((a, q) => (Math.hypot(q.x - b.pos[0], q.z - b.pos[2]) < Math.hypot(a.x - b.pos[0], a.z - b.pos[2]) ? q : a)); const id = nav.nearest(p.x, 0, p.z); if (id >= 0) return id; }
  }
  if (room.settings.mode === 'kc' && room.tags.length && Math.random() < 0.7) {
    const tg = room.tags.reduce((a, t) => (Math.hypot(t.x - b.pos[0], t.z - b.pos[2]) < Math.hypot(a.x - b.pos[0], a.z - b.pos[2]) ? t : a));
    const id = nav.nearest(tg.x, tg.y - 0.6, tg.z); if (id >= 0) return id;
  }
  if (room.settings.mode === 'hardpoint' && room.zone && Math.random() < 0.75)
    return nav.nearest(room.zone.x + rand(-3, 3), 0, room.zone.z + rand(-3, 3));
  // prefer interiors / upper floors / roofs sometimes
  return nav.randomNode(n => (n.y > 2 ? Math.random() < 0.9 : Math.random() < 0.45));
}
function followPath(room, b, now) {
  const nav = room.nav, ai = b.ai;
  const hasPath = ai.path && ai.pathIdx < ai.path.length;
  if (!hasPath || now > ai.repathAt) {
    // only a couple of route searches per server tick, so big bot lobbies don't cause hitches
    if (room.pathBudget <= 0) { if (!hasPath) return [0, 0]; }
    else {
    room.pathBudget--;
    const start = nav.nearest(b.pos[0], b.pos[1], b.pos[2]);
    ai.path = nav.path(start, botGoal(room, b));
    ai.pathIdx = 0;
    ai.repathAt = now + (room.settings.mode === 'infected' && b.team === 1 ? 3000 : 20000);
    if (!ai.path) return [rand(-1, 1), rand(-1, 1)];
    }
  }
  // skip nodes we're already close to
  while (ai.pathIdx < ai.path.length) {
    const n = nav.nodes[ai.path[ai.pathIdx]];
    const dy = n.y - b.pos[1];
    if (Math.hypot(n.x - b.pos[0], n.z - b.pos[2]) < 0.4 && dy < 0.3 && dy > -1.5) ai.pathIdx++;
    else break;
  }
  if (ai.pathIdx >= ai.path.length) return [0, 0];
  const look = nav.nodes[ai.path[Math.min(ai.pathIdx + 1, ai.path.length - 1)]];
  const n = nav.nodes[ai.path[ai.pathIdx]];
  const flat = Math.abs(look.y - n.y) < 0.05 && Math.abs(n.y - b.pos[1]) < 0.1; // only cut corners on flat ground
  const tx = flat ? (n.x * 2 + look.x) / 3 : n.x, tz = flat ? (n.z * 2 + look.z) / 3 : n.z;
  return [tx - b.pos[0], tz - b.pos[2]];
}
function botThrowNade(room, b, t) {
  const g = 18, s = eye(b), tc = chest(t);
  const dx = tc[0] - s[0], dz = tc[2] - s[2], dy = tc[1] - s[1], hd = Math.hypot(dx, dz);
  const time = Math.max(0.6, hd / 13);
  const v = [dx / time, (dy + 0.5 * g * time * time) / time, dz / time];
  room.nades.push({ id: room.nextProjId++, owner: b.id, pos: [...s], vel: v, fuse: WEAPONS.frag.fuse, kind: 'frag' });
  b.nades--;
}

function botThink(room, b, dt, now, losCheck) {
  const ai = b.ai, def = WEAPONS[b.w], me = eye(b), skill = DIFFICULTY[room.settings.difficulty];
  if (ai.blindUntil > now) { ai.target = null; losCheck = false; }   // flashbanged
  if (losCheck) {
    let best = null, bestD = 70;
    for (const o of room.ents.values()) {
      if (!o.alive || !enemies(room, b, o)) continue;
      const d = dist3(b.pos, o.pos);
      if (d < bestD && hasLOS(room, me, chest(o))) { best = o; bestD = d; }
    }
    if (best && best !== ai.target) { ai.target = best; ai.seenAt = now; }
    if (!best && ai.target) { ai.lastKnown = [...ai.target.pos]; ai.target = null; ai.path = null; }
  }
  if (ai.target && (!ai.target.alive || !room.ents.has(ai.target.id))) { ai.target = null; ai.path = null; }

  let moveX = 0, moveZ = 0, speed = 4.8 * (b.spdUntil > now ? 1.3 : 1) * (room.settings.mode === 'infected' && b.team === 1 ? 1.25 : 1) * (ai.slowUntil > now ? 0.5 : 1);
  const t = ai.target;
  if (t) {
    const tc = chest(t);
    const dx = tc[0] - me[0], dy = tc[1] - me[1], dz = tc[2] - me[2];
    const hd = Math.hypot(dx, dz), dist = Math.hypot(dx, dy, dz);
    const diff = wrapAngle(Math.atan2(-dx, -dz) - b.ry);
    b.ry += diff * Math.min(1, dt * 8);
    b.rx = Math.atan2(dy, hd);
    ai.strafeT -= dt;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = rand(0.6, 1.6); b.c = Math.random() < 0.2 ? 1 : 0; }
    const fx = -Math.sin(b.ry), fz = -Math.cos(b.ry), rx = Math.cos(b.ry), rz = -Math.sin(b.ry);
    const melee = def.melee;
    const closeIn = Math.min(18, def.range * 0.7);
    const fwd = melee ? 1 : hd > closeIn ? 1 : hd < Math.min(6, closeIn * 0.5) ? -0.6 : 0;
    moveX = fx * fwd + rx * ai.strafe * (melee ? 0.3 : 0.8);
    moveZ = fz * fwd + rz * ai.strafe * (melee ? 0.3 : 0.8);
    speed = melee ? 5.4 : 3.8;
    // grenade
    ai.nadeCd -= dt;
    if (b.nades > 0 && ai.nadeCd <= 0 && hd > 8 && hd < 22 && Math.random() < 0.006) { botThrowNade(room, b, t); ai.nadeCd = 8; }
    const reacted = now - ai.seenAt > 450 - skill * 300;
    if (reacted && now >= ai.reloadUntil && now >= ai.pauseUntil && now >= ai.nextShot && Math.abs(diff) < 0.35 && room.state === 'playing') {
      if (melee) {
        if (dist < 2.4) { ai.nextShot = now + 600; applyDamage(room, t, b, b.team === 1 && room.settings.mode === 'infected' ? 120 : def.dmg, 'knife', false); roomBroadcast(room, { t: 'fx', id: b.id, w: 'knife', e: [] }); }
      } else if (def.projectile) {
        ai.nextShot = now + 2200;
        const l = dist || 1;
        room.rockets.push({ id: room.nextProjId++, owner: b.id, pos: [...me], dir: [dx / l, dy / l, dz / l], speed: 34, life: 5, age: 0 });
        roomBroadcast(room, { t: 'fx', id: b.id, w: def.id, e: [] });
      } else {
        ai.nextShot = now + 60000 / def.rpm;
        ai.mag--; ai.burst++;
        if (ai.mag <= 0) { ai.reloadUntil = now + def.reload * 1000; ai.mag = def.mag; }
        if (ai.burst >= (def.auto ? 4 + Math.floor(Math.random() * 4) : 1)) { ai.burst = 0; ai.pauseUntil = now + rand(250, 650) + (def.auto ? 0 : 300); }
        let chance = dist > def.range ? 0 : skill * Math.max(0.25, 1 - dist / 70) * (def.cls === 'sniper' || def.cls === 'dmr' ? 1.6 : def.flame ? 2.2 : 1);
        if (t.c) chance *= 0.85;
        if (Math.hypot(t.vel?.[0] || 0, t.vel?.[2] || 0) > 6) chance *= 0.8;
        let end;
        if (Math.random() < chance) {
          const head = Math.random() < 0.12;
          end = head ? eye(t) : tc;
          const pelletMult = def.pellets > 1 ? def.pellets * Math.max(0.15, 0.7 - dist / 25) : 1;
          if (def.flame) burn(room, t, b, 'flamer', 2500, 12);
          applyDamage(room, t, b, def.dmg * pelletMult * falloffMult(def, dist) * (head ? def.head : 1), def.id, head);
        } else {
          const miss = [dx / dist + rand(-0.06, 0.06), dy / dist + rand(-0.05, 0.06), dz / dist + rand(-0.06, 0.06)];
          const ml = Math.hypot(...miss);
          miss[0] /= ml; miss[1] /= ml; miss[2] /= ml;
          const r = raycastBoxes(me, miss, 120, room.map.boxes);
          end = r ? r.point : [me[0] + miss[0] * 120, me[1] + miss[1] * 120, me[2] + miss[2] * 120];
        }
        roomBroadcast(room, { t: 'fx', id: b.id, w: def.id, e: [end.map(r2)] });
      }
    }
  } else {
    b.c = 0;
    [moveX, moveZ] = followPath(room, b, now);
    if (moveX || moveZ) b.ry += wrapAngle(Math.atan2(-moveX, -moveZ) - b.ry) * Math.min(1, dt * 6);
    b.rx *= 0.9;
  }
  const ml = Math.hypot(moveX, moveZ);
  if (ml > 0) { moveX /= ml; moveZ /= ml; }
  const accel = b.onGround ? 12 : 3;
  b.vel[0] += (moveX * speed - b.vel[0]) * Math.min(1, dt * accel);
  b.vel[2] += (moveZ * speed - b.vel[2]) * Math.min(1, dt * accel);
  b.height = b.c ? PLAYER.crouchHeight : PLAYER.height;
  moveBody(b, dt, room.map.query(b.pos[0] - 3, b.pos[2] - 3, b.pos[0] + 3, b.pos[2] + 3));
  ai.stuckT += dt;
  if (ai.stuckT > 1.2) {
    if (Math.hypot(b.pos[0] - ai.lastPos[0], b.pos[2] - ai.lastPos[2]) < 0.5) {
      ai.path = null;
      if (b.onGround) b.vel[1] = PLAYER.jump;
    }
    ai.lastPos = [...b.pos];
    ai.stuckT = 0;
  }
}

// ------------------------------------------------------------------ projectiles
function explode(room, ownerId, at, weaponId) {
  const def = weaponId === 'mortar' ? MORTAR : WEAPONS[weaponId], owner = room.ents.get(ownerId);
  roomBroadcast(room, { t: 'boom', p: at.map(r2) });
  for (const p of room.ents.values()) {
    if (!p.alive) continue;
    const c = chest(p), d = dist3(c, at);
    if (d > def.splash) continue;
    let dmg = def.dmg * (1 - d / def.splash) + 15;
    if (!hasLOS(room, [at[0], at[1] + 0.2, at[2]], c)) dmg *= 0.35;
    if (p === owner) dmg *= 0.85; // your own rockets/grenades can kill you at close range
    applyDamage(room, p, owner || null, dmg, weaponId, false);
  }
}
function stepRockets(room, dt) {
  for (let i = room.rockets.length - 1; i >= 0; i--) {
    const r = room.rockets[i];
    r.life -= dt;
    const step = r.speed * dt;
    const hit = raycastBoxes(r.pos, r.dir, step, room.map.query(r.pos[0] - step, r.pos[2] - step, r.pos[0] + step, r.pos[2] + step));
    let at = null;
    for (const p of room.ents.values()) {
      if (!p.alive || (p.id === r.owner && r.age < 0.25)) continue;
      const c = chest(p);
      const vx = c[0] - r.pos[0], vy = c[1] - r.pos[1], vz = c[2] - r.pos[2];
      const tt = Math.max(0, Math.min(step, vx * r.dir[0] + vy * r.dir[1] + vz * r.dir[2]));
      const px = r.pos[0] + r.dir[0] * tt, py = r.pos[1] + r.dir[1] * tt, pz = r.pos[2] + r.dir[2] * tt;
      if (Math.hypot(c[0] - px, c[1] - py, c[2] - pz) < 0.75 && (!hit || tt < hit.t)) { at = [px, py, pz]; break; }
    }
    if (!at && hit) at = hit.point.map((v, k) => v + hit.normal[k] * 0.1);
    if (at || r.life <= 0) { explode(room, r.owner, at || r.pos, 'thumper'); room.rockets.splice(i, 1); continue; }
    r.age += dt;
    r.pos = [r.pos[0] + r.dir[0] * step, r.pos[1] + r.dir[1] * step, r.pos[2] + r.dir[2] * step];
  }
}
// Thrown objects. frag: bounce + fuse · semtex: sticks to the first thing it touches · molotov: bursts into a fire pool
// on impact · tknife: fast, one-hit kill on a direct hit · smoke/flash/stun: bounce, then go off when the fuse ends.
function detonate(room, n, at) {
  const now = Date.now();
  const p = [at[0], at[1], at[2]];
  switch (n.kind) {
    case 'semtex': explode(room, n.owner, [p[0], p[1] + 0.1, p[2]], 'semtex'); break;
    case 'molotov': {
      const def = WEAPONS.molotov;
      room.fireZones.push({ id: room.nextProjId++, x: p[0], y: Math.max(0, p[1] - 0.1), z: p[2], r: def.splash, until: now + def.fuse * 1000, owner: n.owner, acc: 0 });
      roomBroadcast(room, { t: 'boom', p: p.map(r2), small: 1 });
      break;
    }
    case 'smoke': room.smokes.push({ id: room.nextProjId++, x: p[0], y: p[1], z: p[2], r: 5, until: now + 14000 }); break;
    case 'flash': case 'stun': {
      roomBroadcast(room, { t: n.kind, p: p.map(r2) });
      for (const b of room.ents.values()) {
        if (!b.bot || !b.alive) continue;
        const d = dist3(eye(b), p);
        if (d < (n.kind === 'flash' ? 18 : 10) && hasLOS(room, eye(b), p, true)) {
          if (n.kind === 'flash') b.ai.blindUntil = now + 2600 * (1.1 - d / 18); else b.ai.slowUntil = now + 4000;
        }
      }
      break;
    }
    case 'tknife': break;
    default: explode(room, n.owner, [p[0], p[1] + 0.15, p[2]], 'frag');
  }
}
function stepNades(room, dt) {
  for (let i = room.nades.length - 1; i >= 0; i--) {
    const n = room.nades[i], kind = n.kind || 'frag';
    n.fuse -= dt;
    if (n.stuckTo) { // semtex stuck on a player follows them
      const t = room.ents.get(n.stuckTo);
      if (t && t.alive) n.pos = [t.pos[0] + n.off[0], t.pos[1] + n.off[1], t.pos[2] + n.off[2]];
    }
    if (n.fuse <= 0) { detonate(room, n, n.pos); room.nades.splice(i, 1); continue; }
    if (n.stuck) continue;
    n.vel[1] -= (kind === 'tknife' ? 6 : 18) * dt;
    const step = [n.vel[0] * dt, n.vel[1] * dt, n.vel[2] * dt];
    const len = Math.hypot(...step);
    if (len < 1e-5) continue;
    const dir = step.map(v => v / len);
    // direct hits on players (throwing knife kills, semtex sticks)
    if (kind === 'tknife' || kind === 'semtex' || kind === 'molotov') {
      let victim = null;
      for (const p of room.ents.values()) {
        if (!p.alive || (p.id === n.owner && n.age < 0.3)) continue;
        const c = chest(p);
        const vx = c[0] - n.pos[0], vy = c[1] - n.pos[1], vz = c[2] - n.pos[2];
        const tt = Math.max(0, Math.min(len, vx * dir[0] + vy * dir[1] + vz * dir[2]));
        const off = Math.hypot(c[0] - (n.pos[0] + dir[0] * tt), c[1] - (n.pos[1] + dir[1] * tt), c[2] - (n.pos[2] + dir[2] * tt));
        if (off < 0.55 && p.id !== n.owner) { victim = { p, at: [n.pos[0] + dir[0] * tt, n.pos[1] + dir[1] * tt, n.pos[2] + dir[2] * tt] }; break; }
      }
      if (victim) {
        const owner = room.ents.get(n.owner);
        if (kind === 'tknife') {
          const head = victim.at[1] > victim.p.pos[1] + (victim.p.c ? 1.0 : 1.45);
          applyDamage(room, victim.p, owner || null, WEAPONS.tknife.dmg, 'tknife', head);
          room.nades.splice(i, 1); continue;
        }
        if (kind === 'semtex') { n.stuck = true; n.stuckTo = victim.p.id; n.off = [victim.at[0] - victim.p.pos[0], victim.at[1] - victim.p.pos[1], victim.at[2] - victim.p.pos[2]]; continue; }
        detonate(room, n, victim.at); room.nades.splice(i, 1); continue; // molotov
      }
    }
    n.age = (n.age || 0) + dt;
    const hit = raycastBoxes(n.pos, dir, len + 0.08, room.map.query(n.pos[0] - 1, n.pos[2] - 1, n.pos[0] + 1, n.pos[2] + 1));
    if (hit) {
      const at = hit.point.map((v, k) => v + hit.normal[k] * 0.09);
      if (kind === 'tknife') { room.nades.splice(i, 1); continue; }
      if (kind === 'molotov') { detonate(room, n, at); room.nades.splice(i, 1); continue; }
      n.pos = at;
      if (kind === 'semtex') { n.stuck = true; continue; }
      const dot = n.vel[0] * hit.normal[0] + n.vel[1] * hit.normal[1] + n.vel[2] * hit.normal[2];
      n.vel = n.vel.map((v, k) => (v - 2 * dot * hit.normal[k]) * 0.42);
      if (hit.normal[1] > 0.5 && Math.abs(n.vel[1]) < 1.2) { n.vel[1] = 0; n.vel[0] *= 0.8; n.vel[2] *= 0.8; }
    } else n.pos = n.pos.map((v, k) => v + step[k]);
    if (n.pos[1] < -2 || n.age > 8) room.nades.splice(i, 1);
  }
}
// Fire pools (molotov) and burning (flamethrower / incendiary rounds / standing in fire)
function burn(room, v, by, weapon, ms, dps) {
  const now = Date.now();
  if (!v.alive) return;
  const until = now + ms;
  if (until > (v.burnUntil || 0)) { v.burnUntil = until; v.burnBy = by ? by.id : 0; v.burnW = weapon; v.burnDps = dps; roomBroadcast(room, { t: 'burn', id: v.id, dur: ms }); }
}
function tickFire(room, now, dt) {
  for (let i = room.fireZones.length - 1; i >= 0; i--) {
    const f = room.fireZones[i];
    if (now > f.until) { room.fireZones.splice(i, 1); continue; }
    f.acc += dt;
    if (f.acc < 0.25) continue;
    f.acc = 0;
    const owner = room.ents.get(f.owner);
    for (const p of room.ents.values()) {
      if (!p.alive || Math.hypot(p.pos[0] - f.x, p.pos[2] - f.z) > f.r || Math.abs(p.pos[1] - f.y) > 1.3) continue;
      applyDamage(room, p, owner || null, WEAPONS.molotov.dmg, 'molotov', false);
      burn(room, p, owner, 'molotov', 1500, 10);
    }
  }
  for (let i = room.smokes.length - 1; i >= 0; i--) if (now > room.smokes[i].until) room.smokes.splice(i, 1);
  for (const p of room.ents.values()) {
    if (!p.alive || !(p.burnUntil > now)) continue;
    p.burnAcc = (p.burnAcc || 0) + dt;
    if (p.burnAcc >= 0.25) { p.burnAcc = 0; applyDamage(room, p, room.ents.get(p.burnBy) || null, (p.burnDps || 10) / 4, p.burnW || 'flamer', false); }
  }
}

// ------------------------------------------------------------------ infected
function infect(room, e, first) {
  e.team = 1; e.w = 'knife'; e.skin = 'toxic';
  if (e.bot) e.ai.target = null;
  roomBroadcast(room, { t: 'pj', p: publicInfo(e) });
  roomBroadcast(room, { t: 'infected', id: e.id, first: first ? 1 : 0 });
  roomBroadcast(room, { t: 'chat', n: '', m: first ? `${ename(e)} is PATIENT ZERO — run!` : `${ename(e)} has been infected!` });
  updateInfectedScore(room);
}
function updateInfectedScore(room) {
  const n = [0, 0];
  for (const e of room.ents.values()) if (e.team >= 0) n[e.team]++;
  room.teamScore = n;
  sendScores(room);
}

// ------------------------------------------------------------------ pickups & power-ups
function tickPickups(room, now) {
  if (!room.pickups) return;
  for (const p of room.pickups) {
    if (p.readyAt > now) continue;
    for (const e of room.ents.values()) {
      if (!e.alive || Math.hypot(e.pos[0] - p.x, e.pos[2] - p.z) > 1.3 || Math.abs(e.pos[1] - p.y) > 1.5) continue;
      if (p.kind === 'health' && e.hp >= 100) continue;
      if (room.settings.mode === 'infected' && e.team === 1 && p.kind !== 'speed') continue;
      if (p.kind === 'health') e.hp = Math.min(100, e.hp + 50);
      if (p.kind === 'ammo') { e.nades = 2; e.tacs = 2; if (e.bot) e.ai.mag = WEAPONS[e.w].mag; }
      if (p.kind === 'damage') e.ddUntil = now + POWER_TIME * 1000;
      if (p.kind === 'speed') e.spdUntil = now + POWER_TIME * 1000;
      p.readyAt = now + PICKUP_RESPAWN[p.kind] * 1000;
      roomBroadcast(room, { t: 'pick', id: p.id, by: e.id, kind: p.kind, dur: POWER_TIME });
      if (p.kind === 'damage') roomBroadcast(room, { t: 'chat', n: '', m: `${ename(e)} has DOUBLE DAMAGE!` });
      break;
    }
  }
}

// ------------------------------------------------------------------ killstreaks
function activateStreak(room, e, id, aim, now) {
  roomBroadcast(room, { t: 'streak', id, by: e.id, team: e.team });
  if (id === 'radar' || id === 'aradar') {
    const dur = id === 'aradar' ? 40 : UAV_TIME;
    roomBroadcast(room, { t: 'uav', by: e.id, team: e.team, dur, adv: id === 'aradar' ? 1 : 0 });
  } else if (id === 'jammer') roomBroadcast(room, { t: 'jam', by: e.id, team: e.team, dur: 20 });
  else if (id === 'armor') { e.armor = 60; if (e.client) sendTo(e.client, { t: 'armor', v: 60 }); }
  else if (id === 'airstrike') callAirstrike(room, e, now);
  else if (id === 'mortar') {
    let p = isVec(aim) ? aim.map(Number) : [e.pos[0], 0, e.pos[2]];
    if (Math.hypot(p[0] - e.pos[0], p[2] - e.pos[2]) > 150) p = [e.pos[0], 0, e.pos[2]];
    roomBroadcast(room, { t: 'mortar', by: e.id, p: p.map(r2) });
    for (let i = 0; i < 6; i++) room.strikes.push({ owner: e.id, at: now + 2200 + i * 450, pos: [p[0] + rand(-5, 5), p[1] + 0.2, p[2] + rand(-5, 5)], w: 'mortar' });
  }
}

// ------------------------------------------------------------------ airstrike + kill confirmed
function callAirstrike(room, owner, now) {
  roomBroadcast(room, { t: 'airstrike', by: owner.id, team: owner.team });
  const targets = [...room.ents.values()].filter(e => e.alive && enemies(room, owner, e));
  for (let i = 0; i < 7; i++) {
    const t = targets.length ? pick(targets) : null;
    const base = t ? t.pos : [rand(-20, 20), 0, rand(-20, 20)];
    room.strikes.push({ owner: owner.id, at: now + 1800 + i * 380, pos: [base[0] + rand(-4, 4), base[1] + 0.2, base[2] + rand(-4, 4)] });
  }
}
function tickStrikes(room, now) {
  for (let i = room.strikes.length - 1; i >= 0; i--) {
    const s = room.strikes[i];
    if (now < s.at) continue;
    room.strikes.splice(i, 1);
    if (room.state === 'playing') explode(room, s.owner, s.pos, s.w === 'mortar' ? 'mortar' : 'airstrike');
  }
}
function tickTags(room, now) {
  for (let i = room.tags.length - 1; i >= 0; i--) {
    const tg = room.tags[i];
    if (now - tg.born > 30000) { room.tags.splice(i, 1); continue; }
    for (const e of room.ents.values()) {
      if (!e.alive || Math.hypot(e.pos[0] - tg.x, e.pos[2] - tg.z) > 1.3 || Math.abs(e.pos[1] + 0.6 - tg.y) > 1.6) continue;
      const confirm = e.team !== tg.team;
      if (confirm) { room.teamScore[e.team]++; giveXP(room, e, 100, 'KILL CONFIRMED'); }
      else giveXP(room, e, 50, 'KILL DENIED');
      roomBroadcast(room, { t: 'tag', id: tg.id, by: e.id, confirm: confirm ? 1 : 0 });
      room.tags.splice(i, 1);
      sendScores(room);
      if (confirm && room.teamScore[e.team] >= room.settings.scoreLimit) endMatch(room);
      break;
    }
  }
}

// ------------------------------------------------------------------ hardpoint
function tickHardpoint(room) {
  const z = room.zone; if (!z) return;
  room.hpAcc += TICK;
  if (room.hpAcc < 1) return;
  room.hpAcc -= 1;
  const present = [0, 0];
  const holders = [];
  for (const e of room.ents.values()) {
    if (!e.alive || e.team < 0) continue;
    if (Math.hypot(e.pos[0] - z.x, e.pos[2] - z.z) < ZONE_RADIUS && e.pos[1] < 4) { present[e.team]++; holders.push(e); }
  }
  z.state = present[0] && present[1] ? 2 : present[0] ? 0 : present[1] ? 1 : -1;
  if (z.state === 0 || z.state === 1) {
    room.teamScore[z.state]++;
    for (const e of holders) giveXP(room, e, 10, 'ZONE');
    if (room.teamScore[z.state] >= targetScore('hardpoint', room.settings.scoreLimit)) { sendScores(room); endMatch(room); return; }
  }
  z.ttm--;
  if (z.ttm <= 0) {
    z.idx = (z.idx + 1) % room.zones.length;
    Object.assign(z, room.zones[z.idx], { ttm: ZONE_MOVE, state: -1 });
    roomBroadcast(room, { t: 'chat', n: '', m: 'The hardpoint has moved!' });
  }
  if (room.tick % 30 === 0) sendScores(room);
}

function tickRoom(room, now) {
  room.tick++;
  room.pathBudget = 2;
  if (room.state === 'ended') {
    room.endTimer -= TICK;
    if (room.endTimer <= 0) { backToLobby(room); return; }
  } else {
    syncBots(room);
    room.timeLeft -= TICK;
    if (room.timeLeft <= 0) { room.timeLeft = 0; endMatch(room); }
    if (room.settings.mode === 'hardpoint') tickHardpoint(room);
    if (room.settings.mode === 'kc') tickTags(room, now);
    tickPickups(room, now);
  }
  for (const p of room.ents.values()) {
    if (!p.alive) { if (now >= p.respawnAt && room.state === 'playing') spawn(room, p); continue; }
    if (now - p.lastDmg > 5000 && p.hp < 100) p.hp = Math.min(100, p.hp + 20 * TICK);
    if (p.bot) botThink(room, p, TICK, now, room.tick % 3 === (p.id % 3));
  }
  stepRockets(room, TICK);
  stepNades(room, TICK);
  tickFire(room, now, TICK);
  tickStrikes(room, now);
  {
    const ps = [], k = Math.round(performance.now());
    // [.., pt, jit]: when that player was actually at this position (server clock) and how bumpy their upload is
    // [.., hist]: the earlier updates that arrived since the last snapshot (only when a burst came in)
    for (const p of room.ents.values()) {
      const e = [p.id, r2(p.pos[0]), r2(p.pos[1]), r2(p.pos[2]), r2(p.ry), r2(p.rx), p.w, p.c, Math.ceil(p.hp), p.alive ? 1 : 0,
        p.pt != null ? Math.round(p.pt) : k, Math.round(p.kjit || 0)];
      if (p.hist && p.hist.length > 1) e.push(p.hist.slice(0, -1));
      if (p.hist) p.hist.length = 0;
      ps.push(e);
    }
    const msg = { t: 'snap', k, ps, r: room.rockets.map(r => [r.id, r2(r.pos[0]), r2(r.pos[1]), r2(r.pos[2]), r2(r.dir[0]), r2(r.dir[1]), r2(r.dir[2])]),
      g: room.nades.map(n => [n.id, r2(n.pos[0]), r2(n.pos[1]), r2(n.pos[2]), Math.max(0, THROWABLE_KINDS.indexOf(n.kind || 'frag'))]), time: Math.ceil(room.timeLeft), ts: room.teamScore };
    if (room.smokes.length) msg.sm = room.smokes.map(s => [s.id, r2(s.x), r2(s.y), r2(s.z), s.r]);
    if (room.fireZones.length) msg.fz = room.fireZones.map(f => [f.id, r2(f.x), r2(f.y), r2(f.z), f.r]);
    if (room.zone) msg.z = [room.zone.x, room.zone.z, ZONE_RADIUS, room.zone.state, room.zone.ttm];
    if (room.tags.length) msg.tg = room.tags.map(t => [t.id, r2(t.x), r2(t.y), r2(t.z), t.team]);
    if (room.pickups) msg.pk = room.pickups.map(p => (p.readyAt <= now ? 1 : 0)).join('');
    roomBroadcast(room, msg);
  }
}

// ------------------------------------------------------------------ networking
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  // players over the Cloudflare tunnel all arrive from localhost; their real address is in this header
  const ip = String(req?.headers?.['cf-connecting-ip'] || '').slice(0, 64);
  // the player at this PC on the developer's own server (not over the Cloudflare tunnel or the LAN): may use /unban
  const local = /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(String(req?.socket?.remoteAddress || ''));
  const owner = FB_OWNER && local && !ip && !req?.headers?.['cf-ray'] && !req?.headers?.['x-forwarded-for'];
  const c = { id: nextId++, ws, ip, owner, name: 'Player', skin: 'ranger', wskin: 'factory', level: 1, room: null };
  clients.set(c.id, c);
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = c.room;
    const e = room && room.state !== 'lobby' ? room.ents.get(c.id) : null;
    switch (m.t) {
      case 'hello':
        c.name = cleanName(m.name, 16, 'Player') || 'Player';
        c.dev = isDevCode(m.dev);
        c.pid = /^[a-z0-9]{8,32}$/.test(m.pid || '') ? m.pid : '';
        // a ban from another server travels with the player's app — unless they've been unbanned here
        if (c.pid && bans['lift:' + c.pid] && !(banEnd(bans['p:' + c.pid]) > Date.now())) { delete bans['lift:' + c.pid]; saveBans(); sendTo(c, { t: 'unbanned' }); }
        else if (Number(m.ban) > Date.now()) c.banUntil = Math.min(Number(m.ban), Date.now() + BAN_MS);
        if (CHAR_SKINS.includes(m.skin) || DEV_CHAR_SKINS.includes(m.skin)) c.skin = m.skin;
        if (W_SKINS.includes(m.wskin) || DEV_W_SKINS.includes(m.wskin)) c.wskin = m.wskin;
        c.level = clampInt(m.level, 1, 99, 1);
        sendTo(c, { t: 'hi', id: c.id, fbOwner: FB_OWNER });
        if (isBanned(c)) sendTo(c, { t: 'banned', until: banUntil(c) });
        sendLobbies(c);
        scheduleLobbies();
        break;
      case 'list': sendLobbies(c); break;
      case 'create': createRoom(c, m); break;
      case 'join': {
        const code = m.code ? String(m.code).toUpperCase().trim().slice(0, 4) : '';
        const target = code ? [...rooms.values()].find(r => r.code === code) : rooms.get(m.id);
        if (target) { joinRoom(c, target); break; }
        if (!code) { sendTo(c, { t: 'err', m: 'That lobby no longer exists.' }); break; }
        // not in this game: look for it in friends' games
        remoteLobbies().then(async list => {
          const hit = list.find(l => l.code === code);
          // the relay can still list a game that just closed (or whose tunnel changed address): only send the
          // player there if it answers, otherwise they land on Cloudflare's "Error 1033" page with no way back
          if (hit && await gameAlive(hit.url)) sendTo(c, { t: 'goto', url: hit.url, code });
          else if (hit) sendTo(c, { t: 'err', m: `Lobby "${code}" is in a friend's game that has just closed or gone offline. Ask them to make a new lobby and try again.` });
          else sendTo(c, { t: 'err', m: `No lobby with code "${code}". Check the code, and that your friend's game is open and online.` });
        });
        break;
      }
      case 'leave': leaveRoom(c); sendTo(c, { t: 'lobbies', list: lobbyList(), online: clients.size }); break;
      case 'set':
        if (room && room.hostId === c.id && room.state === 'lobby') {
          room.settings = sanitizeSettings({ ...room.settings, ...(m.settings || {}) }, room.settings);
          if (typeof m.name === 'string') room.name = cleanName(m.name, 28, '') || room.name;
          if (typeof m.private === 'boolean') room.private = m.private;
          room.ready.clear();
          sendRoom(room);
        }
        break;
      case 'ready':
        if (room && room.state === 'lobby') { room.ready.has(c.id) ? room.ready.delete(c.id) : room.ready.add(c.id); sendRoom(room); }
        break;
      case 'start': if (room && room.hostId === c.id && room.state === 'lobby') startMatch(room); break;
      case 'stop': if (room && room.hostId === c.id && room.state === 'playing') endMatch(room); break;
      case 'ping': if (typeof m.c === 'number') sendTo(c, { t: 'pong', c: m.c }); break;
      case 'loadout': // perks + chosen killstreaks (apply from the next life; streaks list straight away)
        c.perks = cleanPerks(m.perks); c.streaks = cleanStreaks(m.streaks);
        if (e) { e.streaks = c.streaks; if (!e.alive) e.perks = c.perks; e.ready = e.ready.filter(id => c.streaks.includes(id)); }
        break;
      case 'usestreak': {
        if (!e || !e.alive || room.state !== 'playing' || !STREAKS[m.id]) return;
        const i = e.ready.indexOf(m.id); if (i < 0) return;
        e.ready.splice(i, 1);
        sendTo(c, { t: 'streakready', ready: e.ready });
        activateStreak(room, e, m.id, m.aim, Date.now());
        break;
      }
      case 'feedback': // older clients: send a single message
        m = { items: [{ id: `old-${c.id}-${Date.now()}`, name: c.name, text: m.m, map: m.map, mode: m.mode, at: Date.now() }] };
        // falls through
      case 'fbsync': { // the client's feedback outbox; the developer's server keeps it, others hold it for relay
        const now = Date.now();
        if (now - (c.lastFeedback || 0) < 1500) break;
        c.lastFeedback = now;
        const items = (Array.isArray(m.items) ? m.items : []).slice(0, 50).map(cleanFb).filter(Boolean);
        if (!items.length) break;
        const added = storeFeedback(items);
        // this server now holds it (the developer's, or one that relays it): the player's app can let it go
        if (FB_OWNER || saveOutbox()) sendTo(c, { t: 'fback', ids: items.map(f => f.id) });
        if (added) sendTo(c, { t: 'toast', m: 'Feedback sent — thanks!' });
        if (!FB_OWNER) fbPush();
        break;
      }
      case 'fbowner': // the developer's app connected here: hand over the feedback held for them
        if (!FB_OWNER && fbOutbox.length) sendTo(c, { t: 'fbrelay', items: fbOutbox.slice(0, 50) });
        break;
      case 'fbrelayack': {
        const ids = new Set(Array.isArray(m.ids) ? m.ids.map(String) : []);
        const before = fbOutbox.length;
        fbOutbox = fbOutbox.filter(f => !ids.has(f.id));
        if (fbOutbox.length !== before) saveOutbox();
        break;
      }
      case 'fall': { // client reports a hard landing; damage from a ~4.5 m drop up, ~17 m is lethal
        if (!e || !e.alive || room.state !== 'playing') return;
        const v = Math.min(40, Math.max(0, +m.v || 0)), now = Date.now();
        if (v < 14 || now - (e.lastFall || 0) < 400) break;
        e.lastFall = now;
        const amount = (v - 14) * 8;
        // a lethal fall within 4 s of being shot gives the kill to whoever shot you
        let credit = null, best = now - 4000;
        if (e.hp - amount <= 0) for (const [id, t] of e.damagers) if (t > best) { const a = room.ents.get(id); if (a && a !== e) { credit = a; best = t; } }
        applyDamage(room, e, credit, amount, 'fall', false);
        break;
      }
      case 'clienterr': { // errors from players' games, so crashes on a friend's PC can be diagnosed here
        const now = Date.now();
        if (now - (c.lastErr || 0) < 2000 || (c.errCount = (c.errCount || 0) + 1) > 40) break;
        c.lastErr = now;
        errLog(`client ${c.name || 'Player'} (${cleanText(String(m.v || ''), 12)}): ${String(m.m || '').replace(/\r/g, '').slice(0, 1200)}`);
        break;
      }
      case 'chat': {
        const text = String(m.m || '').slice(0, 120).trim();
        const cmd = /^\/unban(?:\s+(.+))?$/i.exec(text);
        if (cmd) { // never shown in chat
          if (!c.owner) { sendTo(c, { t: 'toast', m: 'Only the server owner can unban players.' }); break; }
          if (!cmd[1]) { sendTo(c, { t: 'toast', m: 'Type /unban <name>, or /unban all' }); break; }
          const names = unban(cmd[1]);
          sendTo(c, { t: 'toast', m: names.length ? `Unbanned ${names.join(', ')}` : (cmd[1].trim().toLowerCase() === 'all' ? 'All bans cleared' : `No banned player called "${cmd[1].trim()}"`) });
          if (room && names.length) roomBroadcast(room, { t: 'chat', n: '', m: `${names.join(', ')} ${names.length > 1 ? 'were' : 'was'} unbanned` });
          break;
        }
        if (!text || !room) break;
        if (isBanned(c)) { sendTo(c, { t: 'err', m: banMsg(c) }); break; }
        const f = filterChat(text);
        if (f.ban) { banClient(c); break; }
        roomBroadcast(room, { t: 'chat', n: c.name, dv: c.dev ? 1 : 0, m: f.text });
        break;
      }
      case 'look':
        c.name = cleanName(m.name, 16, 'Player') || c.name;
        if (m.dev !== undefined) c.dev = isDevCode(m.dev);
        if (CHAR_SKINS.includes(m.skin) || DEV_CHAR_SKINS.includes(m.skin)) c.skin = m.skin;
        if (W_SKINS.includes(m.wskin) || DEV_W_SKINS.includes(m.wskin)) c.wskin = m.wskin;
        if (m.level) c.level = clampInt(m.level, 1, 99, c.level);
        if (room) sendRoom(room);
        if (e) { e.name = c.name; e.skin = c.skin; e.wskin = c.wskin; roomBroadcast(room, { t: 'pj', p: publicInfo(e) }); }
        break;

      // ---------------- in-match
      case 's': {
        if (!e || !isVec(m.p)) return;
        const half = room.map.size / 2 + 1;
        if (e.alive) {
          const np = [Math.max(-half, Math.min(half, m.p[0])), Math.max(0, Math.min(40, m.p[1])), Math.max(-half, Math.min(half, m.p[2]))];
          e.vel = [(np[0] - e.pos[0]) * 30, 0, (np[2] - e.pos[2]) * 30];
          e.pos = np;
        }
        // Put this position on the server clock at the moment the player was actually there (their send time),
        // not when it happened to arrive: bursty uploads then play back smoothly on everyone else's screen.
        if (typeof m.k === 'number' && isFinite(m.k)) {
          const now = performance.now(), target = now - m.k;
          // Re-base only when their game restarted (clock went backwards) or after a very long stall. Re-basing on
          // every 1.5 s hiccup made the times jump ahead then snap back, freezing that player for seconds.
          if (e.koff == null || m.k < (e.lastK ?? -Infinity) || target - e.koff > 5000) { e.koff = target; e.kjit = 0; }
          else if (target < e.koff) e.koff = target;          // quickest arrival so far: tighten
          else e.koff += (target - e.koff) * 0.01;            // otherwise drift slowly (clock skew)
          e.lastK = m.k;
          e.kjit = e.kjit * 0.95 + Math.abs(target - e.koff) * 0.05;
          const pt = Math.round(Math.min(now, m.k + e.koff));
          // always moving forward; a big step back means a re-base, which other players' games start over from
          e.pt = e.pt == null || pt > e.pt || e.pt - pt > 300 ? pt : e.pt + 1;
          // keep every update since the last snapshot: a burst of 8 then all reach other players, not just the newest
          if (e.alive) { (e.hist || (e.hist = [])).push([Math.round(e.pt), r2(e.pos[0]), r2(e.pos[1]), r2(e.pos[2]), r2(+m.ry || 0), r2(+m.rx || 0), m.c ? 1 : 0]); if (e.hist.length > 16) e.hist.shift(); }
        } else e.pt = undefined;
        e.ry = +m.ry || 0; e.rx = +m.rx || 0; e.c = m.c ? 1 : 0;
        if (WEAPONS[m.w] && WEAPONS[m.w].slot !== 'grenade') e.w = m.w;
        break;
      }
      case 'fire': {
        const def = WEAPONS[m.w];
        if (!e || !def || def.slot === 'grenade' || !e.alive || room.state !== 'playing') return;
        const zombie = room.settings.mode === 'infected' && e.team === 1;
        if (zombie && def.id !== 'knife') return;
        const now = Date.now();
        if (!fireAllowed(e, def, now)) return;
        e.w = m.w;
        const ends = Array.isArray(m.e) ? m.e.filter(x => isVec(x)).slice(0, 12).map(x => x.map(r2)) : [];
        roomBroadcast(room, { t: 'fx', id: e.id, w: def.id, e: ends, s: m.s ? 1 : 0 }, c.id);
        if (Array.isArray(m.hits)) {
          // allow for attachments: up to +25% damage (hollow points) and +60% range (long barrel / FMJ)
          const cap = def.dmg * def.head * def.pellets * 1.25 * (e.perks.includes('stopping') ? 1.15 : 1), maxRange = def.range * 1.6 + 4;
          for (const h of m.hits.slice(0, 12)) {
            const v = room.ents.get(h.id);
            if (!v || v === e || !v.alive || dist3(v.pos, e.pos) > maxRange) continue;
            if (def.flame) burn(room, v, e, 'flamer', 2500, 12);
            else if (m.inc) burn(room, v, e, def.id, 1500, 8);
            applyDamage(room, v, e, zombie ? 120 : Math.min(cap, Math.max(0, +h.dmg || 0)), def.id, !!h.h);
          }
        }
        break;
      }
      case 'rocket': {
        const def = WEAPONS.thumper;
        if (!e || !e.alive || room.state !== 'playing' || !isVec(m.o) || !isVec(m.d)) return;
        const now = Date.now();
        if (!fireAllowed(e, def, now)) return;
        const l = Math.hypot(...m.d) || 1;
        const o = dist3(m.o, eye(e)) < 2 ? m.o : eye(e);
        room.rockets.push({ id: room.nextProjId++, owner: e.id, pos: [...o], dir: m.d.map(v => v / l), speed: 34, life: 5, age: 0 });
        roomBroadcast(room, { t: 'fx', id: e.id, w: 'thumper', e: [] }, c.id);
        break;
      }
      case 'nade': {
        if (!e || !e.alive || room.state !== 'playing' || !isVec(m.o) || !isVec(m.v)) return;
        const kind = THROWABLE_KINDS.includes(m.k) ? m.k : 'frag';
        const tactical = TACTICALS.includes(kind);
        if (room.settings.mode === 'infected' && e.team === 1) return;
        if (tactical ? e.tacs <= 0 : e.nades <= 0) return;
        const now = Date.now();
        if (now - e.lastNade < 500) return;
        e.lastNade = now;
        if (tactical) e.tacs--; else e.nades--;
        const maxSp = kind === 'tknife' ? 32 : 20;
        const sp = Math.hypot(...m.v), k = sp > maxSp ? maxSp / sp : 1;
        const o = dist3(m.o, eye(e)) < 2 ? m.o : eye(e);
        room.nades.push({ id: room.nextProjId++, owner: e.id, pos: [...o], vel: m.v.map(v => v * k), fuse: kind === 'tknife' ? 3 : (WEAPONS[kind].fuse || 2.4), kind, age: 0 });
        break;
      }
    }
  });
  ws.on('close', () => {
    leaveRoom(c, true);
    clients.delete(c.id);
    scheduleLobbies();
  });
});

const perf = { max: 0, sum: 0, n: 0 };
// Windows timers only fire every ~15.6 ms, so setInterval(33) really ran every ~46 ms: the whole game (bots,
// grenades, the match clock) went at ~72% speed with fewer updates. Instead, check often and run each tick
// when it's due, catching up if one was late, for a true 30 ticks a second.
let nextTick = performance.now();
setInterval(() => {
  let n = 0;
  while (performance.now() >= nextTick && n++ < 4) {
    const now = Date.now(), t0 = performance.now();
    for (const room of rooms.values()) if (room.state !== 'lobby') tickRoom(room, now);
    const dt = performance.now() - t0;
    perf.max = Math.max(perf.max, dt); perf.sum += dt; perf.n++;
    nextTick += TICK * 1000;
  }
  if (performance.now() - nextTick > 500) nextTick = performance.now(); // after a long stall, don't fast-forward
}, 4);
if (process.env.STRIKE_PERF) setInterval(() => { console.log(`tick avg ${(perf.sum / Math.max(1, perf.n)).toFixed(2)}ms max ${perf.max.toFixed(1)}ms`); perf.max = perf.sum = perf.n = 0; }, 5000);

// pre-build bot navigation for every map in the background so match starts are instant
// one map at a time with gaps in between, so the server stays responsive while the big maps build
{
  const queue = [...MAP_ORDER].sort((a, b) => (MAPS[a].size || 0) - (MAPS[b].size || 0));
  const next = () => {
    const id = queue.shift();
    if (!id) { console.log('  Bot navigation ready for all maps.'); return; }
    try { buildNav(buildMap(id)); } catch (err) { errLog(`nav build ${id}: ${err && err.stack || err}`); }
    setTimeout(next, 250);
  };
  setTimeout(next, 200);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  =========================================');
  console.log('              S T R I K E L I N E');
  console.log('  =========================================');
  console.log(`  You:            http://localhost:${PORT}`);
  for (const ip of lanAddresses()) console.log(`  Friend (LAN):   http://${ip}:${PORT}`);
  console.log('  Keep this window open while playing.');
  console.log('');
});
