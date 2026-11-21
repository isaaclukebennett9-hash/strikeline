// Bridges the game/splash pages to the desktop app without exposing Node.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('strikelineStore', {
  get: (key) => ipcRenderer.sendSync('store-get', key),
  set: (key, value) => ipcRenderer.sendSync('store-set', key, value),
});
contextBridge.exposeInMainWorld('desktop', {
  state: () => ipcRenderer.invoke('state'),
  retry: () => ipcRenderer.invoke('retry'),
  rejoin: (url) => ipcRenderer.invoke('rejoin', url),
  crashReport: () => ipcRenderer.invoke('crash-report'),     // crash.log lines not yet handed to the developer
  crashReportSent: (n) => ipcRenderer.invoke('crash-report-sent', n),
  openCrashLog: () => ipcRenderer.invoke('open-crash-log'),
  regret: () => ipcRenderer.invoke('regret'),                // secret "don't press this" prank: fake crash popup
  onStatus: (fn) => ipcRenderer.on('status', (e, t) => fn(t)),
  onBootError: (fn) => ipcRenderer.on('boot-error', (e, t) => fn(t)),
  presence: (p) => ipcRenderer.send('presence', p),        // Discord Rich Presence
});

// ---------------------------------------------------------------- home-screen panel inside the game
// Shows your join code, a box to join a friend, "back to my game" when on a friend's server, and app updates.
if (location.protocol.startsWith('http')) {
  window.addEventListener('DOMContentLoaded', async () => {
    const css = document.createElement('style');
    css.textContent = `
      #dkBadge{position:fixed;right:16px;bottom:26px;z-index:99999;display:none;flex-direction:column;gap:8px;width:330px;
        font:600 13px Rajdhani,'Segoe UI',sans-serif;letter-spacing:.5px;color:#cfd6e4;background:rgba(10,13,20,.88);
        border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;backdrop-filter:blur(6px)}
      #dkBadge .hd{font:800 11px 'Segoe UI',sans-serif;letter-spacing:2px;color:#8a93a6}
      #dkBadge .code{font:700 15px Orbitron,'Segoe UI',sans-serif;color:#ffb066;word-break:break-all;user-select:text}
      #dkBadge .row{display:flex;gap:6px;align-items:center}
      #dkBadge input{flex:1;min-width:0;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);border-radius:6px;color:#e8ecf4;
        font:700 13px Rajdhani,sans-serif;padding:6px 8px;outline:none}
      #dkBadge input:focus{border-color:#ff7a1a}
      #dkBadge button{cursor:pointer;background:#ff7a1a;color:#111;border:0;border-radius:6px;padding:6px 10px;font:800 11px 'Segoe UI',sans-serif;letter-spacing:1px;white-space:nowrap}
      #dkBadge button.g{background:rgba(255,255,255,.12);color:#fff}
      #dkBadge .msg{font-size:12px;color:#8a93a6;min-height:0}
      #dkBadge .msg.err{color:#ff6a6a}
      #dkBadge .upd{background:rgba(92,255,157,.1);border:1px solid rgba(92,255,157,.35);border-radius:8px;padding:8px;display:flex;gap:8px;align-items:center}
      #dkBadge .upd b{color:#5cff9d}
      #dkBadge .sep{height:1px;background:rgba(255,255,255,.08)}`;
    document.head.appendChild(css);
    const badge = document.createElement('div');
    badge.id = 'dkBadge';
    document.body.appendChild(badge);
    // stop game hotkeys while typing in the panel
    badge.addEventListener('keydown', (e) => e.stopPropagation());
    badge.addEventListener('keyup', (e) => e.stopPropagation());

    let st = await ipcRenderer.invoke('state');
    let joinMsg = '', joinErr = false, busy = false;
    const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function render() {
      const onFriend = !!st.joined;
      let h = '';
      if (st.gameUpdate && st.gameUpdate.state !== 'error') {
        const gu = st.gameUpdate;
        h += gu.state === 'ready'
          ? `<div class="upd"><div style="flex:1">Game update <b>v${esc(gu.version)}</b> ready</div><button id="dkRestart">RESTART</button></div>`
          : `<div class="upd"><div style="flex:1">Downloading game update <b>v${esc(gu.version)}</b>… ${gu.pct || 0}%</div></div>`;
      }
      if (st.update) {
        const u = st.update;
        const label = u.state === 'downloading' ? `Downloading… ${u.pct}%` : u.state === 'installing' ? 'Installing — restarting…' : u.state === 'error' ? 'Update failed — retry' : 'INSTALL';
        h += `<div class="upd"><div style="flex:1">Update available: <b>v${esc(u.version)}</b></div><button id="dkUpd" ${u.state === 'downloading' || u.state === 'installing' ? 'disabled' : ''}>${label}</button></div>`;
      }
      if (onFriend) {
        h += `<div class="hd">PLAYING ON A FRIEND'S GAME</div><div class="row"><button class="g" id="dkBack">‹ BACK TO MY GAME</button></div>`;
      } else {
        h += `<div class="hd">YOUR JOIN CODE</div>`;
        if (st.code) h += `<div class="row"><div class="code" style="flex:1">${esc(st.code)}</div><button id="dkCopy">COPY LINK</button></div>`;
        else h += `<div class="msg">${st.online === 'offline' ? 'No internet — retrying… (friends on your Wi-Fi can still join)' : 'Going online…'}</div>`;
        h += `<div class="sep"></div><div class="hd">JOIN A FRIEND</div>
              <div class="row"><input id="dkCode" placeholder="Paste their code or link" spellcheck="false" autocomplete="off"><button id="dkJoin" ${busy ? 'disabled' : ''}>${busy ? '…' : 'JOIN'}</button></div>`;
        if (joinMsg) h += `<div class="msg ${joinErr ? 'err' : ''}">${esc(joinMsg)}</div>`;
      }
      if (st.discord) { // Discord Rich Presence status, so it's clear why your status does or doesn't show
        const d = st.discord;
        const t = d.state === 'connected' ? `Connected${d.user ? ' as ' + d.user : ''} — your status shows "Playing Strikeline"`
          : d.state === 'error' ? `Discord said: ${d.error}` : `Looking for Discord… (is the Discord app open? Discord in a browser can't show game status)`;
        h += `<div class="sep"></div><div class="hd">DISCORD</div><div class="msg ${d.state === 'error' ? 'err' : ''}">${esc(t)}</div>`;
      }
      const keep = badge.querySelector('#dkCode')?.value || '';
      badge.innerHTML = h;
      const ci = badge.querySelector('#dkCode'); if (ci) ci.value = keep;
      const q = (id) => badge.querySelector(id);
      if (q('#dkCopy')) q('#dkCopy').onclick = async () => { await ipcRenderer.invoke('copy', st.url || st.code); q('#dkCopy').textContent = 'COPIED!'; setTimeout(() => q('#dkCopy') && (q('#dkCopy').textContent = 'COPY LINK'), 1500); };
      if (q('#dkBack')) q('#dkBack').onclick = () => ipcRenderer.invoke('back');
      if (q('#dkUpd')) q('#dkUpd').onclick = () => ipcRenderer.invoke('install-update');
      if (q('#dkRestart')) q('#dkRestart').onclick = () => ipcRenderer.invoke('restart-app');
      const doJoin = async () => {
        const v = q('#dkCode').value.trim(); if (!v || busy) return;
        busy = true; joinMsg = 'Connecting…'; joinErr = false; render();
        const r = await ipcRenderer.invoke('join', v);
        busy = false; joinMsg = r.ok ? '' : r.error; joinErr = !r.ok; render();
      };
      if (q('#dkJoin')) q('#dkJoin').onclick = doJoin;
      if (ci) ci.addEventListener('keydown', (e) => { if (e.key === 'Enter') doJoin(); });
    }
    render();
    ipcRenderer.on('state', (e, s) => { st = s; if (!badge.contains(document.activeElement)) render(); });
    setInterval(() => {
      const home = document.getElementById('scr-home');
      const ui = document.getElementById('ui');
      badge.style.display = home && home.classList.contains('active') && !(ui && ui.classList.contains('hidden')) ? 'flex' : 'none';
    }, 300);
  });
}
