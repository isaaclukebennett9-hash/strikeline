// Strikeline desktop app.
// Opens straight into the game: starts this PC's game server, goes online in the background (join code),
// lets you join a friend by code from the home screen, and updates itself from whichever host has a newer version.
const { app, BrowserWindow, ipcMain, clipboard, shell, net: enet } = require('electron');
const { fork, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const os = require('os');
const { createPresence } = require('./discord.cjs');

if (process.env.STRIKELINE_SELFTEST) app.setPath('userData', path.join(os.tmpdir(), 'strikeline-selftest'));
const BUNDLED_ROOT = path.join(__dirname, '..');
const STORE_FILE = () => path.join(app.getPath('userData'), 'save.json');

// ---------------------------------------------------------------- crash safety
// A packaged Windows app has no console: writing to stdout can throw EPIPE and take the whole app down.
// Never let that (or any stray error) close the game; note it in crash.log in the app's data folder instead.
function crashLog(msg) {
  try {
    const f = path.join(app.getPath('userData'), 'crash.log');
    try { if (fs.statSync(f).size > 512 * 1024) fs.renameSync(f, f + '.old'); } catch {}
    fs.appendFileSync(f, `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}\n`);
  } catch {}
}
function safeWrite(stream, d) { try { if (stream && stream.writable) stream.write(d); } catch {} }
for (const s of [process.stdout, process.stderr]) { try { s.on('error', () => {}); } catch {} }
process.on('uncaughtException', (err) => crashLog(`main: ${err && err.stack || err}`));
process.on('unhandledRejection', (err) => crashLog(`main (promise): ${err && err.stack || err}`));
app.on('child-process-gone', (e, d) => { if (d.reason !== 'clean-exit') crashLog(`${d.type} process gone: ${d.reason} (exit ${d.exitCode})`); });

// On the developer's PC the app runs the game straight from the project folder (so every change is live)
// and offers the newest installer to friends for auto-update. Everyone else uses the bundled copy.
function devConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'source.json'), 'utf8'));
    if (cfg.source && fs.existsSync(path.join(cfg.source, 'server.js')) && fs.existsSync(path.join(cfg.source, 'node_modules', 'ws'))) return cfg;
  } catch {}
  return null;
}
function cloudflaredPath() {
  const p = app.isPackaged ? path.join(process.resourcesPath, 'cloudflared.exe') : path.join(__dirname, 'bin', 'cloudflared.exe');
  return fs.existsSync(p) ? p : null;
}

// ---------------------------------------------------------------- game updates from GitHub
// Each GitHub release has: version.json ({ version, shell }), game.zip (game files) and the installer.
// Game updates are downloaded into the app's data folder and used from then on; app (shell) updates use the installer.
const REPO = 'isaaclukebennett9-hash/strikeline';
const RELEASE = `https://github.com/${REPO}/releases/latest/download`;
const GAME_DIR = () => path.join(app.getPath('userData'), 'game');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const pkgVersion = (root) => readJson(path.join(root, 'package.json'))?.version || '0.0.0';
// newest usable copy of the game: a downloaded update if it's newer than the one bundled with the app
function installedGame() {
  const cur = readJson(path.join(GAME_DIR(), 'current.json'));
  const bundled = { root: BUNDLED_ROOT, version: pkgVersion(BUNDLED_ROOT) };
  if (cur && fs.existsSync(path.join(cur.dir, 'server.js')) && fs.existsSync(path.join(cur.dir, 'node_modules', 'ws')) && newerV(cur.version, bundled.version)) return { root: cur.dir, version: cur.version };
  return bundled;
}
function newerV(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
}
async function download(url, file, onPct) {
  const r = await enet.fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`download failed (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(file);
  const reader = r.body.getReader();
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    got += value.length;
    if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res));
    if (total && onPct) onPct(Math.round(got / total * 100));
  }
  await new Promise(res => out.end(res));
  if (total && got < total) throw new Error('incomplete download');
  return got;
}
let githubInfo = null;
async function checkGithub() {
  if (devConfig() && !process.env.STRIKELINE_SELFTEST_GITHUB) return; // the developer's PC runs the live project folder
  try {
    const r = await Promise.race([enet.fetch(`${RELEASE}/version.json`, { cache: 'no-store' }), sleep(15000).then(() => { throw new Error('timeout'); })]);
    if (!r.ok) return;
    const v = githubInfo = await r.json();
    // app (shell) update available → offer the installer
    if (v.shell && newerV(v.shell, appVersion()) && v.setup) {
      update = { version: v.shell, from: 'github', url: /^https:\/\/github\.com\//.test(v.setup) ? v.setup : `${RELEASE}/${v.setup}`, state: 'available', pct: 0 };
      pushState();
    }
    // game update → download it in the background, then offer a quick restart
    const have = process.env.STRIKELINE_SELFTEST_GAMEVER || installedGame().version; // test hook: pretend to be older
    if (v.version && newerV(v.version, have) && v.game) {
      const dir = path.join(GAME_DIR(), v.version), zip = path.join(GAME_DIR(), `game-${v.version}.zip`);
      fs.mkdirSync(dir, { recursive: true });
      gameUpdate = { version: v.version, state: 'downloading', pct: 0 }; pushState();
      await download(`${RELEASE}/${v.game}`, zip, (p) => { gameUpdate.pct = p; });
      await new Promise((res, rej) => { const t = spawn('tar', ['-xf', zip, '-C', dir], { windowsHide: true }); t.on('exit', c => (c === 0 ? res() : rej(new Error('unzip failed')))); t.on('error', rej); });
      fs.rmSync(zip, { force: true });
      if (!fs.existsSync(path.join(dir, 'server.js'))) throw new Error('bad game package');
      fs.writeFileSync(path.join(GAME_DIR(), 'current.json'), JSON.stringify({ version: v.version, dir }));
      gameUpdate = { version: v.version, state: 'ready' }; pushState();
    }
  } catch (err) {
    if (gameUpdate && gameUpdate.state === 'downloading') { gameUpdate.state = 'error'; pushState(); }
  }
}
let gameUpdate = null;

// ---------------------------------------------------------------- save data (stable across hosts)
let store = {};
try { store = JSON.parse(fs.readFileSync(STORE_FILE(), 'utf8')); } catch {}
let saveTimer = null;
function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { fs.writeFileSync(STORE_FILE(), JSON.stringify(store)); } catch {} }, 300);
}
ipcMain.on('store-get', (e, key) => { e.returnValue = typeof key === 'string' && key.startsWith('strikeline') && key in store ? store[key] : null; });
ipcMain.on('store-set', (e, key, value) => {
  if (typeof key === 'string' && key.startsWith('strikeline') && typeof value === 'string' && value.length < 2e6) { store[key] = value; saveStore(); }
  e.returnValue = true;
});

// ---------------------------------------------------------------- helpers
const host = { server: null, port: 0, tunnel: null, url: '', code: '', root: '', online: 'starting' }; // online: starting|online|offline
let win = null, joined = '', update = null; // update: { version, from, state, pct }
const send = (ch, data) => { if (win && !win.isDestroyed()) win.webContents.send(ch, data); };
const status = (text) => send('status', text);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function freePort(start) {
  return new Promise((resolve) => {
    const tryPort = (p) => {
      const s = net.createServer();
      s.once('error', () => tryPort(p + 1));
      s.once('listening', () => s.close(() => resolve(p)));
      s.listen(p, '0.0.0.0');
    };
    tryPort(start);
  });
}
async function fetchT(url, ms = 5000) {
  return Promise.race([enet.fetch(url, { cache: 'no-store' }), sleep(ms).then(() => { throw new Error('timeout'); })]);
}
async function waitFor(url, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetchT(url); if (r.ok) return true; } catch {}
    await sleep(700);
  }
  return false;
}
const newer = (a, b) => { // is version a newer than b?
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false; }
  return false;
};
const localUrl = () => `http://localhost:${host.port}/`;
const appVersion = () => process.env.STRIKELINE_SELFTEST_VERSION || app.getVersion(); // test hook: pretend to be older

// ---------------------------------------------------------------- this PC's game server + online link
async function startServer() {
  if (host.server) return;
  const dev = devConfig();
  host.root = dev ? dev.source : installedGame().root;
  host.port = await freePort(3085);
  status('Starting game serverâ€¦');
  const env = { ...process.env, PORT: String(host.port) };
  if (dev && dev.setupDir) env.STRIKELINE_SETUP_DIR = dev.setupDir;
  host.server = fork(path.join(host.root, 'server.js'), [], { cwd: host.root, env, stdio: 'pipe' });
  host.server.stdout.on('data', d => safeWrite(process.stdout, d));
  host.server.stderr.on('data', d => { safeWrite(process.stderr, d); crashLog(`server: ${String(d).trim().slice(0, 600)}`); });
  const me = host.server;
  me.on('exit', (code) => {
    if (host.server !== me) return;
    host.server = null;
    if (!quitting) { crashLog(`game server exited (${code}) — restarting`); setTimeout(() => startServer().catch(e => crashLog(`server restart failed: ${e.message}`)), 1000); }
  });
  if (!(await waitFor(`http://127.0.0.1:${host.port}/info`, 20000))) throw new Error('The game server did not start.');
}

function startTunnel() {
  return new Promise((resolve, reject) => {
    const exe = cloudflaredPath();
    if (!exe) return reject(new Error('cloudflared missing'));
    const t = spawn(exe, ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${host.port}`], { windowsHide: true });
    host.tunnel = t;
    let done = false, found = null;
    const onData = (d) => {
      const s = String(d);
      const m = s.match(/https:\/\/([a-z0-9-]+)\.trycloudflare\.com/);
      if (m && m[1] !== 'api') found = m;
      if (found && !done && /Registered tunnel connection/i.test(s)) { // ready once Cloudflare confirms
        done = true; host.url = found[0]; host.code = found[1];
        setTimeout(resolve, 2500);
      }
    };
    t.stdout.on('data', onData);
    t.stderr.on('data', onData);
    t.on('exit', () => {
      if (host.tunnel === t) { host.tunnel = null; host.url = ''; host.code = ''; }
      if (!done) { done = true; reject(new Error('tunnel exited')); }
      else if (!quitting) { host.online = 'starting'; pushState(); setTimeout(goOnline, 5000); } // dropped: reconnect
    });
    setTimeout(() => { if (!done) { done = true; t.kill(); reject(new Error('timeout')); } }, 45000);
  });
}
let goingOnline = false, quitting = false;
async function goOnline() {
  if (goingOnline || host.tunnel || quitting) return;
  goingOnline = true;
  host.online = 'starting'; pushState();
  try { await startTunnel(); host.online = 'online'; }
  catch { host.online = 'offline'; setTimeout(goOnline, 15000); } // no internet yet: keep trying quietly
  goingOnline = false;
  pushState(); updateTitle();
}
function stopAll() { quitting = true; if (presence) { try { presence.stop(); } catch {} presence = null; } if (host.tunnel) { try { host.tunnel.kill(); } catch {} } if (host.server) { try { host.server.kill(); } catch {} } }

function hostState() {
  return { port: host.port, code: host.code, url: host.url, online: host.online, joined, update, gameUpdate, version: appVersion(), gameVersion: devConfig() ? 'dev' : installedGame().version };
}
function pushState() { send('state', hostState()); }
function updateTitle() {
  if (!win || win.isDestroyed()) return;
  win.setTitle(joined ? 'Strikeline  â€”  playing on a friend\'s game' : host.code ? `Strikeline  â€”  Join code: ${host.code}` : 'Strikeline');
}

// ---------------------------------------------------------------- joining a friend
// Accepts a join code ("lucky tiger river blue" / "lucky-tiger-river-blue"), a full link, or a LAN address.
function joinUrl(input) {
  let s = String(input || '').trim().replace(/^join\s*code\s*:?\s*/i, '');
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s.replace(/\s+/g, '').replace(/\/+$/, '');
  if (/^[\d.]+(:\d+)?$/.test(s)) return `http://${s.includes(':') ? s : s + ':3080'}`;
  s = s.toLowerCase().replace(/\.trycloudflare\.com.*$/, '').replace(/[\s_]+/g, '-').replace(/[^a-z0-9.\-:]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s.includes('.') ? `https://${s}` : `https://${s}.trycloudflare.com`;
}
async function doJoin(input) {
  const url = joinUrl(input);
  if (!url) return { ok: false, error: 'Enter a join code.' };
  if (host.url && url === host.url) return { ok: false, error: "That's your own code â€” you're already in your game." };
  let ok = await waitFor(`${url}/info`, 20000);
  if (!ok) { // secure DNS might be blocked on this network: retry with normal DNS
    try { app.configureHostResolver({ secureDnsMode: 'off' }); } catch {}
    ok = await waitFor(`${url}/info`, 12000);
  }
  if (!ok) return { ok: false, error: `Couldn't reach that game. Check the code and that your friend has Strikeline open.` };
  joined = url; updateTitle();
  win.loadURL(url + '/');
  checkUpdate(url);
  return { ok: true, url };
}
function backToMine() { joined = ''; updateTitle(); win.loadURL(localUrl()); checkUpdate(`http://127.0.0.1:${host.port}`); }

// ---------------------------------------------------------------- auto-update from a host with a newer version
async function checkUpdate(base) {
  try {
    const r = await fetchT(`${base}/app/version`, 8000);
    if (!r.ok) return;
    const v = await r.json();
    if (v.setup && newer(v.version, appVersion()) && (!update || newer(v.version, update.version))) {
      update = { version: v.version, from: base, state: 'available', pct: 0 };
      pushState();
    }
  } catch {}
}
async function installUpdate() {
  if (!update || update.state === 'downloading') return;
  update.state = 'downloading'; update.pct = 0; pushState();
  try {
    const r = await enet.fetch(update.url || `${update.from}/app/setup`, { cache: 'no-store' });
    if (!r.ok) throw new Error('download failed');
    const total = Number(r.headers.get('content-length')) || 0;
    const file = path.join(os.tmpdir(), `Strikeline-Setup-${update.version}.exe`);
    const out = fs.createWriteStream(file);
    const reader = r.body.getReader();
    let got = 0, lastPush = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res));
      if (total && Date.now() - lastPush > 300) { update.pct = Math.round((got / total) * 100); pushState(); lastPush = Date.now(); }
    }
    await new Promise(res => out.end(res));
    if (total && got < total) throw new Error('incomplete download');
    if (process.env.STRIKELINE_SELFTEST) { update.state = 'tested'; update.bytes = got; pushState(); return; }
    update.state = 'installing'; update.pct = 100; pushState();
    // silent install over the top, then start the new version
    spawn(file, ['/S', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 800);
  } catch (err) {
    update.state = 'error'; pushState();
  }
}

// ---------------------------------------------------------------- IPC
ipcMain.handle('state', () => hostState());
ipcMain.handle('join', (e, input) => doJoin(input));
ipcMain.handle('back', () => backToMine());
ipcMain.handle('copy', (e, text) => { clipboard.writeText(String(text)); return true; });
ipcMain.handle('install-update', () => installUpdate());
ipcMain.handle('restart-app', () => { stopAll(); app.relaunch(); setTimeout(() => app.exit(0), 300); });
ipcMain.handle('retry', () => boot());
// Discord Rich Presence: the game page reports what you're doing (menus / lobby / mode, map and score)
let presence = null;
ipcMain.on('presence', (e, p) => { if (presence && e.sender === win?.webContents) presence.set(p); });
// crash.log entries the developer hasn't seen yet: the game sends them to the developer's server when playing there
ipcMain.handle('crash-report', () => {
  try {
    const txt = fs.readFileSync(path.join(app.getPath('userData'), 'crash.log'), 'utf8');
    let from = Number(store.strikeline_crash_sent) || 0;
    if (from > txt.length) from = 0; // log was rotated
    return { text: txt.slice(from).slice(-1100), end: txt.length };
  } catch { return { text: '', end: 0 }; }
});
ipcMain.handle('crash-report-sent', (e, n) => { store.strikeline_crash_sent = String(Number(n) || 0); saveStore(); });
ipcMain.handle('rejoin', async (e, url) => { if (/^https?:\/\//.test(url) && !url.startsWith(localUrl().slice(0, -1)) && !(await waitFor(`${new URL(url).origin}/info`, 6000))) url = localUrl() + '?lost=1'; if (/^https?:\/\//.test(url)) { joined = url.startsWith(localUrl().slice(0, -1)) ? '' : url.replace(/\/+$/, ''); win.loadURL(url); updateTitle(); } });

// ---------------------------------------------------------------- window
function createWindow() {
  win = new BrowserWindow({
    width: 1400, height: 860, minWidth: 960, minHeight: 600,
    backgroundColor: '#0b0e14', title: 'Strikeline', autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    // DevTools (Ctrl+Shift+I) only on the developer's PC: otherwise players could edit their progress from the console.
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false, backgroundThrottling: false, devTools: !!devConfig() },
  });
  win.setMenuBarVisibility(false);
  win.setFullScreen(true); // start fullscreen (F11 still toggles)
  win.on('page-title-updated', (e) => { e.preventDefault(); updateTitle(); });
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  // A friend's game address that has gone away shows Cloudflare's "Error 1033" page (HTTP 530) with no way
  // back into the game: send the player back to their own game instead.
  const deadFriend = (url) => { if (!/\.trycloudflare\.com/i.test(url)) return; crashLog(`friend's game unreachable: ${url.replace(/\?.*$/, '')}`); joined = ''; updateTitle(); win.loadURL(localUrl() + '?lost=1'); };
  win.webContents.on('did-navigate', (e, url, code) => { if (code >= 500) deadFriend(url); });
  win.webContents.on('did-fail-load', (e, code, desc, url, isMain) => { if (isMain && code !== -3) deadFriend(url); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  // Crash recovery: if the game page dies, show a screen with a one-click rejoin.
  win.webContents.on('render-process-gone', (e, d) => {
    crashLog(`game page gone: ${d.reason} (exit ${d.exitCode})`);
    if (d.reason === 'clean-exit') return;
    const cur = win.webContents.getURL();
    win.loadFile(path.join(__dirname, 'launcher.html'), { query: { crashed: d.reason, rejoin: /^https?:/.test(cur) ? cur : localUrl() } });
  });
  win.loadFile(path.join(__dirname, 'launcher.html'));
}
async function boot() {
  try {
    await startServer();
    win.loadURL(localUrl());
    goOnline();
    checkUpdate(`http://127.0.0.1:${host.port}`); // the developer's own app updates from its own project build
    checkGithub();                                 // everyone else: new game versions / app versions from GitHub
  } catch (err) {
    send('boot-error', err.message);
  }
}

// ---------------------------------------------------------------- automated checks used during development
async function selfTest() {
  const log = (o) => fs.appendFileSync(process.env.STRIKELINE_SELFTEST, JSON.stringify(o) + '\n');
  const js = (s) => win.webContents.executeJavaScript(s);
  try {
    // wait until the game loaded and the online code appeared
    for (let i = 0; i < 60 && !(host.code && /^http/.test(win.webContents.getURL())); i++) await sleep(1000);
    await sleep(3000);
    log({ step: 'boot', url: win.webContents.getURL().replace(/:\d+/, ':PORT'), online: host.online, code: !!host.code, update: update && update.version });
    if (process.env.STRIKELINE_SELFTEST_SHOT) fs.writeFileSync(process.env.STRIKELINE_SELFTEST_SHOT, (await win.webContents.capturePage()).toPNG());
    log({ step: 'badge', ...(await js(`(() => { const b = document.getElementById('dkBadge'); return { badge: !!b, visible: b && b.style.display !== 'none', text: b && b.innerText.replace(/\\s+/g, ' ').slice(0, 160) }; })()`)) });
    if (process.env.STRIKELINE_SELFTEST_GITHUB) {
      for (let i = 0; i < 60 && !(gameUpdate && (gameUpdate.state === 'ready' || gameUpdate.state === 'error')); i++) await sleep(1000);
      const cur = readJson(path.join(GAME_DIR(), 'current.json'));
      log({ step: 'github', info: githubInfo, gameUpdate, installed: installedGame().version, hasServer: !!cur && fs.existsSync(path.join(cur.dir, 'server.js')), hasWs: !!cur && fs.existsSync(path.join(cur.dir, 'node_modules', 'ws', 'index.js')), shellUpdate: update && update.version });
    }
    if (update) { await installUpdate(); log({ step: 'update', state: update.state, bytes: update.bytes, from: update.from.replace(/:\d+/, ':PORT') }); }
    if (process.env.STRIKELINE_SELFTEST_JOIN) {
      const j = await doJoin(process.env.STRIKELINE_SELFTEST_JOIN);
      await sleep(7000);
      log({ step: 'join', ok: j.ok, error: j.error, update: update && update.version, ...(j.ok ? await js(`({ home: !!document.querySelector('#scr-home.active'), badge: (document.getElementById('dkBadge')||{}).innerText?.replace(/\\s+/g,' ').slice(0,120) })`) : {}) });
    }
  } catch (err) { log({ step: 'error', error: String(err) }); }
  app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    // Look up join links with secure DNS so ISP/home DNS filters and stale Windows DNS caches can't block joining.
    try { app.configureHostResolver({ secureDnsMode: 'secure', secureDnsServers: ['https://cloudflare-dns.com/dns-query', 'https://dns.google/dns-query'] }); } catch {}
    createWindow();
    if (!process.env.STRIKELINE_SELFTEST) { try { presence = createPresence(crashLog); presence.set({ details: 'Starting up', start: Date.now() }); } catch (err) { crashLog(`discord presence: ${err.message}`); } }
    win.webContents.once('did-finish-load', boot);
    if (process.env.STRIKELINE_SELFTEST) selfTest();
  });
  app.on('window-all-closed', () => { stopAll(); app.quit(); });
  app.on('before-quit', stopAll);
}
