// Strikeline Admin: the server owner's control panel (npm run admin, or the "Strikeline Admin" shortcut).
// It finds the game server running from this folder through admin.json (port + a token the server makes on each
// start) and talks to its /admin API, which only answers this PC. When Strikeline isn't open it runs a server of
// its own, so bans, unbans and messages still reach every other server; when the game opens it switches over.
const { app, BrowserWindow, ipcMain, shell, Menu, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { fork } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APPDATA = process.env.APPDATA || path.join(require('os').homedir(), '.config');
const argData = (() => { const i = process.argv.indexOf('--data'); return i > 0 ? process.argv[i + 1] : ''; })();
const DATA_ENV = argData || process.env.STRIKELINE_DATA_DIR || '';
// the same rule the server uses: the game folder when it can be written to, else %APPDATA%\Strikeline
const dataDirs = () => (DATA_ENV ? [DATA_ENV] : [ROOT, path.join(APPDATA, 'Strikeline')]);

app.setPath('userData', path.join(APPDATA, 'Strikeline Admin')); // own profile: never collides with the game app
app.setAppUserModelId('com.strikeline.admin');
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null, own = null, ownPort = 0, cur = null, status = { mode: 'starting', text: 'Looking for your game server…' };
const setStatus = (mode, text) => { status = { mode, text, port: cur?.port || 0 }; };

async function api(target, p, opts = {}) {
  const r = await fetch(`http://127.0.0.1:${target.port}${p}`, { ...opts, headers: { 'x-admin-token': target.token, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(opts.timeout || 4000) });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
  return r.json();
}
function readTargets() {
  const out = [];
  for (const d of dataDirs()) {
    try { const j = JSON.parse(fs.readFileSync(path.join(d, 'admin.json'), 'utf8')); if (j.port && j.token) out.push({ ...j, dir: d }); } catch {}
  }
  return out.sort((a, b) => (b.at || 0) - (a.at || 0));
}
const alive = t => api(t, '/admin/state', { timeout: 2500 }).then(() => true, () => false);
function freePort(start) {
  return new Promise(res => {
    const tryP = p => { const s = net.createServer(); s.once('error', () => tryP(p + 1)); s.once('listening', () => s.close(() => res(p))); s.listen(p, '127.0.0.1'); };
    tryP(start);
  });
}
async function startOwn() {
  if (own) return;
  ownPort = await freePort(3095);
  const env = { ...process.env, PORT: String(ownPort) };
  if (DATA_ENV) env.STRIKELINE_DATA_DIR = DATA_ENV;
  own = fork(path.join(ROOT, 'server.js'), [], { cwd: ROOT, env, stdio: 'ignore' });
  const me = own;
  me.on('exit', () => { if (own === me) { own = null; ownPort = 0; } });
}
function stopOwn() { if (own) { try { own.kill(); } catch {} own = null; ownPort = 0; } }

let finding = false;
async function find() { // keep pointing at the best live server: the game's own, else ours
  if (finding) return; finding = true;
  try {
    if (cur && !(await alive(cur))) cur = null;
    const targets = readTargets();
    // prefer the game's server (not ours) when it's running
    for (const t of targets) {
      if (t.port === ownPort) continue;
      if (cur && cur.port === t.port && cur.token === t.token) break;
      if (await alive(t)) { cur = t; break; }
    }
    if (cur && cur.port !== ownPort) { if (own) stopOwn(); setStatus('game', 'Connected to your Strikeline game'); return; }
    // the game isn't open: use our own server
    if (!own) { await startOwn(); setStatus('starting', 'Strikeline isn\'t open: starting a server for the admin app…'); cur = null; return; }
    const mine = targets.find(t => t.port === ownPort);
    if (mine && (await alive(mine))) { cur = mine; setStatus('own', 'Strikeline isn\'t open: running the admin\'s own server. Bans, unbans, kicks and messages still reach every server.'); }
    else setStatus('starting', 'Starting a server for the admin app…');
  } catch (e) { setStatus('offline', e.message); }
  finally { finding = false; }
}

ipcMain.handle('adm-state', async () => {
  if (!cur) return { status, data: null };
  try { return { status, data: await api(cur, '/admin/state') }; }
  catch (e) { cur = null; find(); return { status: { mode: 'offline', text: 'Lost the game server, reconnecting…' }, data: null }; }
});
ipcMain.handle('adm-cmd', async (e, m) => {
  if (!cur) return { ok: false, msg: 'Not connected to a server yet.' };
  try { return await api(cur, '/admin/cmd', { method: 'POST', body: JSON.stringify(m || {}), timeout: 8000 }); }
  catch (err) { return { ok: false, msg: `Couldn't reach the server (${err.message}).` }; }
});
ipcMain.handle('adm-log', async (e, f) => {
  if (!cur) return { text: '' };
  try { return await api(cur, `/admin/log?f=${f === 'feedback' ? 'feedback' : 'errors'}`); } catch { return { text: '' }; }
});
ipcMain.handle('adm-open-folder', () => shell.openPath(cur?.dir || dataDirs()[0]));
ipcMain.handle('adm-copy', (e, t) => { clipboard.writeText(String(t || '')); return true; });

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1340, height: 860, minWidth: 1020, minHeight: 640, title: 'Strikeline Admin', backgroundColor: '#07090d',
    icon: path.join(__dirname, 'admin-icon.png'), show: false,
    webPreferences: { preload: path.join(__dirname, 'admin-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'admin.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  find(); setInterval(find, 3000);
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
app.on('before-quit', stopOwn);
process.on('exit', stopOwn);
