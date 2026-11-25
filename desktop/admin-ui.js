// Strikeline Admin: the page. Polls the game server's /admin/state through the preload bridge and sends commands.
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PERM = 50 * 365 * 864e5;
const DURS = [['15m', 15], ['1h', 60], ['2h', 120], ['1d', 1440], ['7d', 10080], ['30d', 43200], ['Permanent', 0]];
const TITLES = { dash: 'DASHBOARD', players: 'PLAYERS', lobbies: 'LOBBIES', bans: 'BANS & MUTES', chat: 'CHAT LOG', console: 'CONSOLE', logs: 'LOGS & FEEDBACK' };

let S = null, status = null, page = 'dash', selKey = '', pFilter = 'online', chatSeen = 0, lastChatCount = 0;

// ------------------------------------------------------------------ helpers
const plain = n => String(n || '').replace(/^♛\s*/, '').trim();
const left = ms => { if (ms > PERM) return 'permanent'; const m = Math.max(1, Math.ceil(ms / 60000)); return m >= 1440 ? `${Math.floor(m / 1440)}d ${Math.floor(m % 1440 / 60)}h` : m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const ago = t => { if (!t) return '—'; const s = (Date.now() - t) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : `${Math.floor(s / 86400)} d ago`; };
const hhmm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const clock = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const upt = ms => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const durLabel = mins => (mins ? DURS.find(d => d[1] === mins)?.[0] || `${mins}m` : 'permanently');
const nameHtml = (n, dev) => `${dev ? '<span class="crown">♛</span>' : ''}${esc(plain(n))}`;

function toast(msg, err, sub) {
  const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : '');
  el.innerHTML = esc(msg) + (sub ? `<small>${esc(sub)}</small>` : '');
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; }, err ? 6000 : 4000);
  setTimeout(() => el.remove(), err ? 6500 : 4500);
}
function confirmBox(title, text, yes = 'CONFIRM') {
  return new Promise(res => {
    $('mTitle').textContent = title; $('mText').textContent = text; $('mYes').textContent = yes;
    $('modal').classList.remove('hidden');
    const done = v => { $('modal').classList.add('hidden'); $('mYes').onclick = $('mNo').onclick = null; res(v); };
    $('mYes').onclick = () => done(true); $('mNo').onclick = () => done(false);
  });
}
async function send(m, quiet) {
  const r = await window.admin.cmd(m);
  if (!quiet) toast(r.msg || (r.ok ? 'Done' : 'Failed'), !r.ok, r.ok && r.global ? 'Sent to every Strikeline server' : '');
  setTimeout(refresh, 150);
  return r;
}

// one list of players: everyone online on this server + everyone this server has seen
function people() {
  if (!S) return [];
  const map = new Map();
  for (const c of S.online) {
    const key = c.pid || 'c' + c.cid;
    const prev = map.get(key);
    if (prev && prev.room && !c.room) continue;
    map.set(key, { key, pid: c.pid, cid: c.cid, name: c.name, dev: c.dev, online: 1, room: c.room, roomName: c.roomName, host: c.host, alive: c.alive, hp: c.hp, k: c.k, d: c.d, level: c.level, ban: c.ban, mute: c.mute, lastSeen: Date.now(), ip: c.ip, owner: c.owner, since: c.since });
  }
  for (const p of S.players) {
    const cur = map.get(p.pid);
    if (cur) { cur.ban = cur.ban || p.ban; cur.mute = cur.mute || p.mute; continue; }
    map.set(p.pid, { key: p.pid, pid: p.pid, cid: 0, name: p.name, online: 0, ban: p.ban, mute: p.mute, lastSeen: p.lastSeen, hasIp: p.ip });
  }
  return [...map.values()];
}
const who = p => (p.cid ? { cid: p.cid, pid: p.pid, name: plain(p.name) } : { pid: p.pid, name: plain(p.name) });

// ------------------------------------------------------------------ navigation
function go(p) {
  page = p;
  for (const b of document.querySelectorAll('#nav button')) b.classList.toggle('on', b.dataset.p === p);
  for (const s of document.querySelectorAll('.page')) s.classList.toggle('on', s.id === 'p-' + p);
  $('title').textContent = TITLES[p];
  if (p === 'chat') chatSeen = S ? S.chat.length : 0;
  if (p === 'console') setTimeout(() => $('tIn').focus(), 30);
  if (p === 'logs') loadLog();
  render();
}
for (const b of document.querySelectorAll('#nav button')) b.onclick = () => go(b.dataset.p);
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) go(g.dataset.go); });

// ------------------------------------------------------------------ polling
let busy = false;
async function refresh() {
  if (busy) return; busy = true;
  try {
    const r = await window.admin.state();
    status = r.status;
    if (r.data) S = r.data;
    renderTop(!!r.data);
    if (r.data) render();
  } catch (e) { console.error(e); }
  busy = false;
}
setInterval(refresh, 1500); refresh();

function renderTop(ok) {
  const conn = $('conn'), mode = status?.mode;
  conn.className = 'pill ' + (ok && mode === 'game' ? 'ok' : ok && mode === 'own' ? 'warn' : 'bad');
  conn.querySelector('span:last-child').textContent = ok ? (mode === 'game' ? 'Connected to your game' : 'Admin server (game closed)') : 'Not connected';
  conn.title = status?.text || '';
  $('offline').classList.toggle('hidden', ok);
  $('offText').textContent = status?.text || 'Looking for your game server…';
  if (!ok || !S) return;
  const sv = S.server;
  $('meta').innerHTML = `<span>v<b>${esc(sv.v)}</b></span><span>Up <b>${upt(sv.uptime)}</b></span><span><b>${sv.online}</b> connected</span>`;
  const pub = $('pub');
  pub.classList.toggle('hidden', !sv.publicUrl);
  if (sv.publicUrl) { pub.className = 'pill link ok'; pub.querySelector('span:last-child').textContent = sv.publicUrl.replace('https://', ''); }
  $('keyWarn').classList.toggle('hidden', !!sv.signer);
  $('sideFoot').innerHTML = `${mode === 'own' ? '<b>Strikeline is closed.</b> The admin app is running its own server, so global commands still work.' : '<b>Live:</b> changes apply to your running game.'}<br>Global commands: <b>${sv.signer ? 'ON' : 'this server only'}</b><br>Data: <span class="mono" style="font-size:10.5px">${esc(sv.data)}</span>`;
  const ppl = people();
  $('bPlayers').textContent = ppl.filter(p => p.online).length;
  $('bPlayers').className = 'badge' + (ppl.some(p => p.online && !p.owner) ? ' hot' : '');
  $('bLobbies').textContent = S.rooms.length;
  $('bBans').textContent = S.bans.filter(b => b.kind === 'player').length;
  $('bBans').className = 'badge' + (S.bans.length ? ' red' : '');
  const unread = page === 'chat' ? 0 : Math.max(0, S.chat.length - chatSeen);
  if (page === 'chat') chatSeen = S.chat.length;
  $('bChat').textContent = unread > 99 ? '99+' : unread;
  $('bChat').className = 'badge' + (unread ? ' hot' : '');
}
$('pub').onclick = () => { if (S?.server.publicUrl) { window.admin.copy(S.server.publicUrl); toast('Public address copied'); } };

function render() {
  if (!S) return;
  if (page === 'dash') renderDash();
  else if (page === 'players') renderPlayers();
  else if (page === 'lobbies') renderLobbies();
  else if (page === 'bans') renderBans();
  else if (page === 'chat') renderChat();
}

// ------------------------------------------------------------------ dashboard
const QUICK = ['Server restarting in 5 minutes', 'New update out: restart the game to get it', 'Be nice in chat', 'GG everyone!'];
$('annQuick').innerHTML = QUICK.map(q => `<button class="btn sm">${esc(q)}</button>`).join('');
for (const b of $('annQuick').children) b.onclick = () => { $('annText').value = b.textContent; $('annText').focus(); };
$('annSend').onclick = async () => { const t = $('annText').value.trim(); if (!t) return; const r = await send({ cmd: 'announce', text: t }); if (r.ok) $('annText').value = ''; };
$('annText').onkeydown = e => { if (e.key === 'Enter') $('annSend').click(); };
$('qFolder').onclick = $('lgFolder').onclick = () => window.admin.openFolder();
$('qUnbanAll').onclick = $('bUnbanAll') ? async () => { if (await confirmBox('UNBAN EVERYONE?', 'Every ban on every server is cleared, including slur bans.', 'UNBAN ALL')) send({ cmd: 'unbanall' }); } : null;
$('bUnbanAll').onclick = $('qUnbanAll').onclick;

function renderDash() {
  const ppl = people(), on = ppl.filter(p => p.online);
  const playing = S.rooms.filter(r => r.state === 'playing').length;
  const tiles = [
    ['Online now', on.length, 'var(--green)'], ['Lobbies', S.rooms.length, 'var(--accent)'], ['Matches running', playing, 'var(--cyan)'],
    ['Players seen', S.players.length, 'var(--blue)'], ['Banned', S.bans.filter(b => b.kind === 'player').length, 'var(--red)'], ['Muted', ppl.filter(p => p.mute).length, 'var(--yellow)'],
  ];
  $('stats').innerHTML = tiles.map(([l, v, c]) => `<div class="card stat" style="--c:${c}"><b>${v}</b><span>${l}</span></div>`).join('');
  $('dOnline').innerHTML = on.length ? on.map(p => `<div><span>${p.room ? `<span class="tag orange">${esc(p.room)}</span>` : '<span class="dim">menu</span>'}</span><span class="click" data-sel="${esc(p.key)}" style="cursor:pointer">${nameHtml(p.name, p.dev)} ${p.owner ? '<span class="tag grey">YOU</span>' : ''}${p.ban ? ' <span class="tag red">BANNED</span>' : ''}${p.mute ? ' <span class="tag yellow">MUTED</span>' : ''}</span></div>`).join('') : '<div class="empty">Nobody online on this server.</div>';
  const ch = S.chat.slice(-10).reverse();
  $('dChat').innerHTML = ch.length ? ch.map(c => `<div><span>${hhmm(c.at)}</span><span><b class="click" data-sel="${esc(c.pid || 'c' + c.cid)}" style="cursor:pointer">${esc(plain(c.name))}</b>: <span class="${c.flagged ? 'tag red' : ''}">${esc(c.flagged ? 'BLOCKED' : c.shown || c.text)}</span>${c.flagged ? ` <span class="dim">${esc(c.text)}</span>` : ''}</span></div>`).join('') : '<div class="empty">No chat yet.</div>';
  const lg = S.log.slice(-12).reverse();
  $('dLog').innerHTML = lg.length ? lg.map(l => `<div><span>${hhmm(l.at)}</span><span>${esc(l.msg)}</span></div>`).join('') : '<div class="empty">Nothing yet this session.</div>';
  $('dRemote').innerHTML = remoteHtml();
}
function remoteHtml() {
  if (!S.remote.length) return '<div class="empty">No public lobbies in friends\' games right now.</div>';
  return `<table><thead><tr><th>CODE</th><th>LOBBY</th><th>HOST</th><th>MODE</th><th>MAP</th><th class="r">PLAYERS</th><th>STATE</th></tr></thead><tbody>${S.remote.map(l => `<tr><td><span class="tag orange">${esc(l.code)}</span></td><td class="name">${esc(l.name)}</td><td>${esc(l.host)}</td><td>${esc((S.modes.find(m => m.id === l.mode) || {}).name || l.mode)}</td><td>${esc(l.mapName)}</td><td class="r">${l.players}/${l.max}</td><td>${l.state === 'lobby' ? '<span class="tag grey">LOBBY</span>' : '<span class="tag green">PLAYING</span>'}</td></tr>`).join('')}</tbody></table>`;
}
document.addEventListener('click', e => { const s = e.target.closest('[data-sel]'); if (s) { selKey = s.dataset.sel; drawerKey = ''; if (pFilter === 'online' && !people().find(p => p.key === selKey)?.online) setFilter('all'); go('players'); } });

// ------------------------------------------------------------------ players
function setFilter(f) { pFilter = f; for (const b of $('pFilter').children) b.classList.toggle('on', b.dataset.f === f); }
for (const b of $('pFilter').children) b.onclick = () => { setFilter(b.dataset.f); renderPlayers(); };
$('pSearch').oninput = () => renderPlayers();
let drawerKey = '';
function renderPlayers() {
  const q = $('pSearch').value.trim().toLowerCase();
  let list = people();
  if (pFilter === 'online') list = list.filter(p => p.online);
  if (pFilter === 'banned') list = list.filter(p => p.ban);
  if (pFilter === 'muted') list = list.filter(p => p.mute);
  if (q) list = list.filter(p => plain(p.name).toLowerCase().includes(q) || (p.pid || '').includes(q));
  list.sort((a, b) => b.online - a.online || (b.room ? 1 : 0) - (a.room ? 1 : 0) || b.lastSeen - a.lastSeen);
  $('pCount').textContent = `${list.length} shown`;
  $('pRows').innerHTML = list.length ? list.map(p => {
    const st = [p.owner ? '<span class="tag grey">YOU</span>' : '', p.host ? '<span class="tag orange">HOST</span>' : '', p.ban ? `<span class="tag red">BANNED · ${left(p.ban.until - Date.now())}</span>` : '', p.mute ? `<span class="tag yellow">MUTED · ${left(p.mute - Date.now())}</span>` : '', p.alive === 0 ? '<span class="tag grey">DEAD</span>' : ''].join(' ');
    const hp = p.hp == null ? '<span class="dim">—</span>' : `<span class="hpbar"><i style="width:${Math.min(100, p.hp)}%;background:${p.hp > 50 ? 'var(--green)' : p.hp > 25 ? 'var(--yellow)' : 'var(--red)'}"></i></span> <span class="muted">${p.hp}</span>`;
    return `<tr class="click${p.key === selKey ? ' sel' : ''}" data-k="${esc(p.key)}"><td><span class="sdot ${p.ban ? 'ban' : p.online ? 'on' : ''}"></span></td><td class="name">${nameHtml(p.name, p.dev)}</td><td>${st}</td><td>${p.room ? `<span class="tag orange">${esc(p.room)}</span> <span class="muted">${esc(p.roomName)}</span>` : p.online ? '<span class="dim">main menu</span>' : '<span class="dim">offline</span>'}</td><td class="r">${p.k == null ? '<span class="dim">—</span>' : `${p.k} / ${p.d}`}</td><td>${hp}</td><td class="r">${p.level || '<span class="dim">—</span>'}</td><td class="muted">${p.online ? '<span style="color:var(--green)">online</span>' : ago(p.lastSeen)}</td></tr>`;
  }).join('') : `<tr><td colspan="8"><div class="empty">${pFilter === 'online' ? 'Nobody is online on this server right now. Try "Everyone seen".' : 'No players match.'}</div></td></tr>`;
  for (const tr of $('pRows').querySelectorAll('tr[data-k]')) tr.onclick = () => { selKey = tr.dataset.k; renderPlayers(); };
  renderDrawer();
}
function renderDrawer() {
  const p = people().find(x => x.key === selKey);
  const el = $('drawer');
  if (!p) { if (drawerKey !== '-') { el.innerHTML = '<div class="empty">Pick a player to see what you can do.</div>'; drawerKey = '-'; } return; }
  if (drawerKey !== p.key) {
    drawerKey = p.key;
    el.innerHTML = `
      <div class="who"><div class="av">${esc(plain(p.name).slice(0, 1).toUpperCase() || '?')}</div><div><b id="dwName"></b><span id="dwSub" class="muted"></span></div></div>
      <div class="facts" id="dwFacts"></div>
      <div class="sec"><span class="lbl">MESSAGE</span><div class="stack"><input id="dwMsg" maxlength="300" placeholder="Pops up on their screen"><button class="btn" id="dwMsgGo">SEND</button></div></div>
      <div class="sec"><span class="lbl">IN THE GAME</span><div class="row"><button class="btn" id="dwKick">KICK</button><button class="btn" id="dwSlay">SLAY</button><button class="btn" id="dwHost">MAKE HOST</button></div></div>
      <div class="sec"><span class="lbl">MUTE / BAN FOR</span><div class="durs" id="dwDur">${DURS.map(([l, v]) => `<button data-v="${v}"${v === 120 ? ' class="on"' : ''}>${l}</button>`).join('')}</div>
        <input id="dwReason" maxlength="120" placeholder="Reason (optional, they see it)" style="margin-bottom:8px">
        <div class="row"><button class="btn warn" id="dwMute">MUTE</button><button class="btn danger" id="dwBan">BAN</button><button class="btn good" id="dwUnmute">UNMUTE</button><button class="btn good" id="dwUnban">UNBAN</button></div></div>
      <div class="sec row"><button class="btn sm" id="dwCopy">COPY PLAYER ID</button><button class="btn sm" id="dwForget">REMOVE FROM LIST</button></div>`;
    let mins = 120;
    for (const b of $('dwDur').children) b.onclick = () => { mins = Number(b.dataset.v); for (const x of $('dwDur').children) x.classList.toggle('on', x === b); };
    const cur = () => people().find(x => x.key === drawerKey) || p;
    $('dwMsgGo').onclick = async () => { const t = $('dwMsg').value.trim(); if (!t) return; const r = await send({ cmd: 'msg', ...who(cur()), text: t }); if (r.ok) $('dwMsg').value = ''; };
    $('dwMsg').onkeydown = e => { if (e.key === 'Enter') $('dwMsgGo').click(); };
    $('dwKick').onclick = () => send({ cmd: 'kick', ...who(cur()), reason: $('dwReason').value.trim() });
    $('dwSlay').onclick = () => send({ cmd: 'slay', ...who(cur()) });
    $('dwHost').onclick = () => send({ cmd: 'host', ...who(cur()) });
    $('dwMute').onclick = () => send({ cmd: 'mute', ...who(cur()), mins });
    $('dwUnmute').onclick = () => send({ cmd: 'unmute', ...who(cur()) });
    $('dwBan').onclick = async () => { const c = cur(); if (c.owner) { toast("That's you!", true); return; } if (await confirmBox(`BAN ${plain(c.name).toUpperCase()}?`, `${plain(c.name)} is banned ${mins ? 'for ' + durLabel(mins) : 'permanently'} on every Strikeline server${$('dwReason').value.trim() ? ` (reason: ${$('dwReason').value.trim()})` : ''}. You can unban them any time.`, 'BAN')) send({ cmd: 'ban', ...who(c), mins, reason: $('dwReason').value.trim() }); };
    $('dwUnban').onclick = () => send({ cmd: 'unban', ...who(cur()) });
    $('dwCopy').onclick = () => { window.admin.copy(cur().pid || ''); toast('Player id copied'); };
    $('dwForget').onclick = async () => { if (await confirmBox('REMOVE FROM LIST?', `${plain(cur().name)} disappears from the player list until they play again. Bans stay.`, 'REMOVE')) { await send({ cmd: 'forget', pid: cur().pid }); selKey = ''; } };
  }
  $('dwName').innerHTML = nameHtml(p.name, p.dev);
  $('dwSub').innerHTML = p.online ? `<span style="color:var(--green)">● online</span>${p.room ? ` · in <b style="color:var(--text)">${esc(p.roomName)}</b> (${esc(p.room)})` : ' · main menu'}` : `offline · last seen ${ago(p.lastSeen)}`;
  $('dwFacts').innerHTML = [
    ['Status', [p.ban ? `<span class="tag red">BANNED${p.ban.r ? ' · ' + esc(p.ban.r) : ''} · ${left(p.ban.until - Date.now())}</span>` : '<span class="tag green">NOT BANNED</span>', p.mute ? `<span class="tag yellow">MUTED · ${left(p.mute - Date.now())}</span>` : ''].join(' ')],
    p.online && p.level ? ['Level', p.level] : null,
    p.k != null ? ['Match', `${p.k} kills · ${p.d} deaths · ${p.alive ? `${p.hp} HP` : 'dead'}`] : null,
    p.online ? ['Connected', ago(p.since)] : null,
    p.online ? ['From', esc(p.ip)] : null,
    ['Player id', `<span class="mono" style="font-size:12px">${esc(p.pid || 'none (old game version)')}</span>`],
  ].filter(Boolean).map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('');
  $('dwSlay').disabled = !(p.online && p.alive === 1);
  $('dwHost').disabled = !(p.online && p.room && !p.host);
  $('dwKick').disabled = !p.online && !p.pid;
  $('dwUnban').disabled = !p.ban; $('dwUnmute').disabled = !p.mute;
  $('dwBan').disabled = $('dwMute').disabled = !p.pid || !!p.owner;
}

// ------------------------------------------------------------------ lobbies
const cards = new Map();
function lobbyCard(r) {
  const el = document.createElement('div'); el.className = 'card lobby'; el.style.marginBottom = '14px';
  const opt = (list, v) => list.map(x => `<option value="${esc(x.id ?? x)}"${(x.id ?? x) === v ? ' selected' : ''}>${esc(x.name ?? x)}</option>`).join('');
  el.innerHTML = `
    <div class="lobby-head"><span class="code" title="Copy code"></span><div><div class="nm"></div><div class="sub"></div></div><div class="clock"></div></div>
    <div class="lobby-body">
      <div><h3 class="rh"></h3><table><thead class="thd"></thead><tbody class="roster"></tbody></table>
        <div class="row nowrap" style="margin-top:12px"><input class="say" maxlength="300" placeholder="Say something in this lobby's chat" style="flex:1"><button class="btn sayGo">SAY</button></div></div>
      <div><h3>SETTINGS</h3><div class="sets">
        <label class="f wide">Lobby name<input data-s="name" maxlength="28"></label>
        <label class="f">Mode<select data-s="mode">${opt(S.modes, r.settings.mode)}</select></label>
        <label class="f">Map<select data-s="map"><option value="random">Random</option>${opt(S.maps, r.settings.map)}</select></label>
        <label class="f">Bots<input data-s="bots" type="number" min="0" max="14"></label>
        <label class="f">Bot skill<select data-s="difficulty">${opt(S.difficulties.map(d => ({ id: d, name: d[0].toUpperCase() + d.slice(1) })), r.settings.difficulty)}</select></label>
        <label class="f">Score limit<input data-s="scoreLimit" type="number" min="5" max="100"></label>
        <label class="f">Time (min)<input data-s="timeLimit" type="number" min="3" max="30"></label>
        <label class="f">Max players<input data-s="maxPlayers" type="number" min="2" max="16"></label>
        <label class="f">Visibility<select data-s="private"><option value="0">Public</option><option value="1">Private</option></select></label>
      </div><div class="row" style="margin-top:10px"><button class="btn apply">APPLY</button><button class="btn primary applyR">APPLY + RESTART</button></div></div>
    </div>
    <div class="lobby-actions"><button class="btn good aStart">START MATCH</button><button class="btn aEnd">END MATCH</button><button class="btn aLobby">BACK TO LOBBY</button><button class="btn aRestart">RESTART</button><div style="flex:1"></div><button class="btn danger aClose">CLOSE LOBBY</button></div>`;
  const q = s => el.querySelector(s);
  for (const f of el.querySelectorAll('[data-s]')) f.addEventListener('input', () => { f.dataset.dirty = '1'; });
  const sets = () => {
    const o = {};
    for (const f of el.querySelectorAll('[data-s]')) {
      const k = f.dataset.s;
      o[k] = k === 'private' ? f.value === '1' : f.type === 'number' ? Number(f.value) : f.value;
    }
    return o;
  };
  const clean = () => { for (const f of el.querySelectorAll('[data-s]')) delete f.dataset.dirty; };
  q('.apply').onclick = async () => { const r2 = await send({ cmd: 'set', room: el.dataset.code, settings: sets() }); if (r2.ok) clean(); };
  q('.applyR').onclick = async () => { if (!(await confirmBox('APPLY AND RESTART?', 'The current match ends straight away (no XP for it) and a new one starts with these settings.', 'RESTART'))) return; const r2 = await send({ cmd: 'restart', room: el.dataset.code, settings: sets() }); if (r2.ok) clean(); };
  q('.aStart').onclick = () => send({ cmd: 'start', room: el.dataset.code });
  q('.aEnd').onclick = () => send({ cmd: 'end', room: el.dataset.code });
  q('.aLobby').onclick = () => send({ cmd: 'lobby', room: el.dataset.code });
  q('.aRestart').onclick = async () => { if (await confirmBox('RESTART THE MATCH?', 'Scores reset and everyone respawns.', 'RESTART')) send({ cmd: 'restart', room: el.dataset.code }); };
  q('.aClose').onclick = async () => { if (await confirmBox('CLOSE THIS LOBBY?', 'Everyone in it goes back to the main menu.', 'CLOSE')) send({ cmd: 'close', room: el.dataset.code }); };
  q('.sayGo').onclick = async () => { const t = q('.say').value.trim(); if (!t) return; const r2 = await send({ cmd: 'say', room: el.dataset.code, text: t }); if (r2.ok) q('.say').value = ''; };
  q('.say').onkeydown = e => { if (e.key === 'Enter') q('.sayGo').click(); };
  q('.code').onclick = () => { window.admin.copy(el.dataset.code); toast(`Lobby code ${el.dataset.code} copied`); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act, cid = Number(b.dataset.cid), pl = people().find(x => x.cid === cid);
    if (!pl) return;
    if (act === 'open') { selKey = pl.key; drawerKey = ''; go('players'); return; }
    send({ cmd: act, ...who(pl) });
  });
  return el;
}
function renderLobbies() {
  const list = $('lList');
  if (!S.rooms.length) { list.innerHTML = '<div class="card"><div class="empty">No lobbies on this server right now. Lobbies in friends\' games are listed below.</div></div>'; cards.clear(); }
  else if (list.querySelector('.empty')) list.innerHTML = '';
  const ids = new Set(S.rooms.map(r => r.id));
  for (const [id, el] of cards) if (!ids.has(id)) { el.remove(); cards.delete(id); }
  for (const r of S.rooms) {
    let el = cards.get(r.id);
    if (!el) { el = lobbyCard(r); cards.set(r.id, el); list.appendChild(el); }
    el.dataset.code = r.code;
    const q = s => el.querySelector(s);
    q('.code').textContent = r.code;
    q('.nm').innerHTML = `${esc(r.name)} ${r.private ? '<span class="tag grey">PRIVATE</span>' : '<span class="tag blue">PUBLIC</span>'} ${r.state === 'playing' ? '<span class="tag green">PLAYING</span>' : r.state === 'ended' ? '<span class="tag yellow">MATCH OVER</span>' : '<span class="tag grey">IN LOBBY</span>'}`;
    q('.sub').textContent = `${r.modeName} · ${r.mapName} · host ${plain(r.host)} · ${r.members.length}/${r.settings.maxPlayers} players · ${r.settings.bots} bots (${r.settings.difficulty})`;
    q('.clock').innerHTML = r.state === 'playing' ? (r.teams ? `<span class="score"><span class="a">${r.teamScore[0]}</span><span class="dim">:</span><span class="b">${r.teamScore[1]}</span></span> ` : '') + `<span${r.timeLeft < 60 ? ' style="color:var(--red)"' : ''}>${r.settings.mode === 'range' ? 'PRACTICE' : clock(r.timeLeft)}</span>` : '';
    const inMatch = r.state !== 'lobby' && r.ents.length;
    q('.rh').textContent = inMatch ? `SCOREBOARD · ${r.ents.filter(e => !e.bot).length} PLAYERS, ${r.ents.filter(e => e.bot).length} BOTS` : `PLAYERS IN THE LOBBY · ${r.members.length}`;
    const acts = cid => `<button class="btn sm icon" data-act="open" data-cid="${cid}" title="Player actions">⋯</button> <button class="btn sm" data-act="kick" data-cid="${cid}">KICK</button>`;
    if (inMatch) {
      q('.thd').innerHTML = '<tr><th>NAME</th><th class="r">K</th><th class="r">D</th><th class="r">SCORE</th><th>HEALTH</th><th></th></tr>';
      const sorted = r.ents.slice().sort((a, b) => (r.teams ? a.team - b.team : 0) || b.s - a.s || b.k - a.k);
      q('.roster').innerHTML = sorted.map(e => {
        const m = r.members.find(x => x.cid === e.id);
        return `<tr class="${r.teams && e.team >= 0 ? 'team' + e.team : ''}"><td class="name">${e.bot ? `<span class="dim">${esc(e.name)}</span> <span class="tag grey">BOT</span>` : nameHtml(e.name, m?.dev)}${m?.host ? ' <span class="tag orange">HOST</span>' : ''}</td><td class="r">${e.k}</td><td class="r">${e.d}</td><td class="r">${e.s}</td><td>${e.alive ? `<span class="hpbar"><i style="width:${Math.min(100, e.hp)}%"></i></span>` : '<span class="tag grey">DEAD</span>'}</td><td class="r">${e.bot ? '' : `${e.alive ? `<button class="btn sm" data-act="slay" data-cid="${e.id}">SLAY</button> ` : ''}${acts(e.id)}`}</td></tr>`;
      }).join('');
    } else {
      q('.thd').innerHTML = '<tr><th>NAME</th><th>READY</th><th></th></tr>';
      q('.roster').innerHTML = r.members.map(m => `<tr><td class="name">${nameHtml(m.name, m.dev)}${m.host ? ' <span class="tag orange">HOST</span>' : ''}</td><td>${m.ready ? '<span class="tag green">READY</span>' : '<span class="dim">—</span>'}</td><td class="r">${m.host ? '' : `<button class="btn sm" data-act="host" data-cid="${m.cid}">MAKE HOST</button> `}${acts(m.cid)}</td></tr>`).join('') || '<tr><td colspan="3"><div class="empty">Empty</div></td></tr>';
    }
    for (const f of el.querySelectorAll('[data-s]')) {
      if (f.dataset.dirty || document.activeElement === f) continue;
      const k = f.dataset.s, v = k === 'name' ? r.name : k === 'private' ? (r.private ? '1' : '0') : r.settings[k];
      if (String(f.value) !== String(v)) f.value = v;
    }
    q('.aStart').disabled = r.state !== 'lobby';
    q('.aEnd').disabled = r.state !== 'playing';
    q('.aLobby').disabled = r.state === 'lobby';
    q('.aRestart').disabled = r.state === 'lobby';
  }
  $('lRemote').innerHTML = remoteHtml();
}

// ------------------------------------------------------------------ bans & mutes
let bnMins = 120;
$('bnDur').innerHTML = DURS.map(([l, v]) => `<button data-v="${v}"${v === 120 ? ' class="on"' : ''}>${l}</button>`).join('');
for (const b of $('bnDur').children) b.onclick = () => { bnMins = Number(b.dataset.v); for (const x of $('bnDur').children) x.classList.toggle('on', x === b); };
function findByName(n) {
  const want = plain(n).toLowerCase(); if (!want) throw new Error('Type a player name.');
  const ppl = people();
  const exact = ppl.filter(p => plain(p.name).toLowerCase() === want);
  const pool = exact.length ? exact : ppl.filter(p => plain(p.name).toLowerCase().startsWith(want));
  if (!pool.length) throw new Error(`No player called "${n}".`);
  pool.sort((a, b) => b.online - a.online || b.lastSeen - a.lastSeen);
  const names = new Set(pool.map(p => plain(p.name).toLowerCase()));
  if (names.size > 1) throw new Error(`"${n}" could be: ${[...names].slice(0, 8).join(', ')}. Type more of the name.`);
  return pool[0];
}
$('bnGo').onclick = async () => {
  let p; try { p = findByName($('bnName').value); } catch (e) { toast(e.message, true); return; }
  if (p.owner) { toast("That's you!", true); return; }
  if (await confirmBox(`BAN ${plain(p.name).toUpperCase()}?`, `Banned ${bnMins ? 'for ' + durLabel(bnMins) : 'permanently'} on every server.`, 'BAN')) { const r = await send({ cmd: 'ban', ...who(p), mins: bnMins, reason: $('bnReason').value.trim() }); if (r.ok) { $('bnName').value = ''; $('bnReason').value = ''; } }
};
$('bnMute').onclick = async () => { let p; try { p = findByName($('bnName').value); } catch (e) { toast(e.message, true); return; } const r = await send({ cmd: 'mute', ...who(p), mins: bnMins }); if (r.ok) $('bnName').value = ''; };
function renderBans() {
  const now = Date.now();
  const list = S.bans.slice().sort((a, b) => a.until - b.until);
  const byName = new Map(); // one row per player: their id ban + any address bans with the same name
  for (const b of list) { const k = b.pid || 'n:' + b.name; if (b.kind === 'address' && [...byName.values()].some(x => x.name === b.name)) continue; if (!byName.has(k)) byName.set(k, b); }
  $('banRows').innerHTML = byName.size ? [...byName.values()].map(b => `<tr><td class="name">${esc(plain(b.name))}${b.kind === 'address' ? ' <span class="tag grey">BY ADDRESS</span>' : ''}</td><td class="wrap">${b.r ? esc(b.r) : '<span class="muted">slur in chat</span>'}</td><td>${b.until - now > PERM ? '<span class="tag red">PERMANENT</span>' : left(b.until - now)}</td><td class="r"><button class="btn sm good" data-unban="${esc(b.pid)}" data-name="${esc(plain(b.name))}">UNBAN</button></td></tr>`).join('') : '<tr><td colspan="4"><div class="empty">Nobody is banned. 🎉</div></td></tr>';
  for (const b of $('banRows').querySelectorAll('[data-unban]')) b.onclick = () => send({ cmd: 'unban', pid: b.dataset.unban || undefined, name: b.dataset.name });
  const muted = people().filter(p => p.mute);
  $('muteRows').innerHTML = muted.length ? muted.map(p => `<tr><td class="name">${nameHtml(p.name, p.dev)}</td><td>${left(p.mute - now)}</td><td class="r"><button class="btn sm good" data-unmute="${esc(p.pid)}">UNMUTE</button></td></tr>`).join('') : '<tr><td colspan="3"><div class="empty">Nobody is muted.</div></td></tr>';
  for (const b of $('muteRows').querySelectorAll('[data-unmute]')) b.onclick = () => send({ cmd: 'unmute', pid: b.dataset.unmute });
  const names = [...new Set(people().map(p => plain(p.name)))].sort((a, b) => a.localeCompare(b));
  const dl = names.map(n => `<option value="${esc(n)}">`).join('');
  if ($('knownNames').dataset.v !== dl) { $('knownNames').innerHTML = dl; $('knownNames').dataset.v = dl; }
}

// ------------------------------------------------------------------ chat
$('cSearch').oninput = () => renderChat(true); $('cFlag').onchange = () => renderChat(true);
function renderChat(force) {
  const box = $('cList'), q = $('cSearch').value.trim().toLowerCase(), only = $('cFlag').checked;
  let list = S.chat;
  if (only) list = list.filter(c => c.flagged);
  if (q) list = list.filter(c => (c.text + ' ' + c.name).toLowerCase().includes(q));
  const sig = list.length + ':' + (list.at(-1)?.at || 0) + q + only;
  if (!force && box.dataset.sig === sig) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.dataset.sig = sig;
  box.innerHTML = list.length ? list.map(c => `<div class="cl${c.flagged ? ' flag' : ''}"><span class="t">${hhmm(c.at)}</span><span class="rm">${esc(c.room)}</span><span class="n" data-sel="${esc(c.pid || 'c' + c.cid)}" title="${esc(c.rn)}">${esc(plain(c.name))}</span><span class="m">${c.flagged ? `<span class="tag red">BLOCKED · AUTO-BANNED</span> ${esc(c.text)}` : !c.shown ? `<span class="tag yellow">MUTED</span> <span class="muted">${esc(c.text)}</span>` : esc(c.shown)}${!c.flagged && c.shown && c.shown !== c.text ? `<span class="orig">typed: ${esc(c.text)}</span>` : ''}</span></div>`).join('') : '<div class="empty">No chat messages yet on this server.</div>';
  if (atBottom || force) box.scrollTop = box.scrollHeight;
}

// ------------------------------------------------------------------ logs
let lgFile = 'errors';
for (const b of $('lgTabs').children) b.onclick = () => { lgFile = b.dataset.f; for (const x of $('lgTabs').children) x.classList.toggle('on', x === b); loadLog(); };
$('lgRefresh').onclick = () => loadLog();
$('lgClear').onclick = async () => { if (await confirmBox('CLEAR errors.log?', 'The log file is emptied. This cannot be undone.', 'CLEAR')) { await send({ cmd: 'clearlog' }); loadLog(); } };
async function loadLog() {
  const r = await window.admin.log(lgFile);
  const t = (r.text || '').trimEnd();
  const box = $('lgBox');
  box.innerHTML = t ? esc(t).replace(/^(\[[^\]]+\])/gm, '<span class="d">$1</span>').replace(/(error|Error|exception|failed|kicked|flagged)/g, '<span class="e">$1</span>') : `<span class="d">${lgFile === 'errors' ? 'errors.log is empty. 👍' : 'No feedback yet.'}</span>`;
  box.scrollTop = box.scrollHeight;
}

// ------------------------------------------------------------------ console
const HELP = [
  ['players', 'who is online (add "all" for everyone seen)'], ['lobbies', 'every lobby on this server'], ['bans', 'active bans and mutes'], ['whois <name>', 'everything about a player'],
  ['ban <name> [time] [reason…]', 'ban everywhere. time: 30m 2h 1d 7d perm (default 2h)'], ['unban <name|all>', 'lift a ban everywhere'],
  ['kick <name> [reason…]', 'kick from their lobby (1 min before they can rejoin)'], ['mute <name> [time]', 'stop them chatting'], ['unmute <name>', ''],
  ['msg <name> <text…>', 'private message that pops up on their screen'], ['announce <text…>', 'banner for every player on every server'],
  ['slay <name>', 'kill them in their match'], ['host <name>', 'make them host of their lobby'],
  ['say <code> <text…>', 'message in one lobby\'s chat'], ['start / end / lobby / close <code>', 'run a lobby'], ['restart <code> [mode] [map]', 'restart a match, optionally on a new mode/map'],
  ['bots <code> <n>', 'number of bots (0-14)'], ['skill <code> <easy|normal|hard>', 'bot difficulty'], ['map <code> <map>', 'map for the next match'], ['mode <code> <mode>', 'mode for the next match'],
  ['score <code> <n>', 'score limit'], ['time <code> <minutes>', 'time limit'], ['max <code> <n>', 'max players'], ['private <code> on|off', ''], ['rename <code> <name…>', 'rename a lobby'],
  ['maps / modes', 'list the ids'], ['clearlog', 'empty errors.log'], ['clear', 'clear this screen'],
];
const CMDS = ['help', 'players', 'lobbies', 'bans', 'whois', 'ban', 'unban', 'kick', 'mute', 'unmute', 'msg', 'announce', 'slay', 'host', 'say', 'start', 'end', 'lobby', 'close', 'restart', 'bots', 'skill', 'map', 'mode', 'score', 'time', 'max', 'private', 'rename', 'maps', 'modes', 'clearlog', 'clear'];
const NAME_CMDS = new Set(['whois', 'ban', 'unban', 'kick', 'mute', 'unmute', 'msg', 'slay', 'host']);
const ROOM_CMDS = new Set(['say', 'start', 'end', 'lobby', 'close', 'restart', 'bots', 'skill', 'map', 'mode', 'score', 'time', 'max', 'private', 'rename']);
const out = (text, cls = 'info') => { const d = document.createElement('div'); d.className = cls; d.textContent = text; $('tOut').appendChild(d); $('tOut').scrollTop = $('tOut').scrollHeight; };
out('Strikeline Admin console. Type "help" for every command. Tab completes names, ↑ / ↓ go through history.', 'h');
function tokens(s) { const r = []; s.replace(/"([^"]*)"|(\S+)/g, (m, a, b) => { r.push(a ?? b); return m; }); return r; }
function parseTime(t) {
  if (!t) return null; t = t.toLowerCase();
  if (['perm', 'permanent', 'forever', 'never'].includes(t)) return 0;
  const m = /^(\d+(?:\.\d+)?)(s|m|min|h|hr|d|w)?$/.exec(t); if (!m) return null;
  const n = Number(m[1]), u = m[2] || 'm';
  return Math.max(1, Math.round(n * ({ s: 1 / 60, m: 1, min: 1, h: 60, hr: 60, d: 1440, w: 10080 })[u]));
}
function findRoom(code) {
  if (!code) throw new Error('Which lobby? Give its 4-letter code.');
  const c = code.toUpperCase();
  const r = S.rooms.find(x => x.code === c) || S.rooms.find(x => x.name.toLowerCase().startsWith(code.toLowerCase()));
  if (!r) throw new Error(`No lobby "${code}" on this server. Lobbies: ${S.rooms.map(x => x.code).join(', ') || 'none'}`);
  return r;
}
async function run(line) {
  const t = tokens(line); if (!t.length) return;
  const cmd = t[0].toLowerCase(), a = t.slice(1);
  const rest = i => a.slice(i).join(' ');
  const res = async m => { const r = await send(m, true); out((r.ok ? '✓ ' : '✗ ') + r.msg, r.ok ? 'ok' : 'err'); };
  const set = async (r, k, v) => res({ cmd: 'set', room: r.code, settings: { [k]: v } });
  if (!S) throw new Error('Not connected yet.');
  switch (cmd) {
    case 'help': case '?': for (const [c, d] of HELP) out(`  ${c.padEnd(36)} ${d}`, 'info'); break;
    case 'clear': case 'cls': $('tOut').innerHTML = ''; break;
    case 'players': case 'who': case 'online': {
      const list = people().filter(p => a[0] === 'all' || p.online);
      if (!list.length) out('Nobody online on this server.'); else out(`${list.length} player(s):`, 'h');
      for (const p of list) out(`  ${(p.online ? '● ' : '○ ') + plain(p.name).padEnd(18)} ${(p.room ? p.room + ' ' + p.roomName : p.online ? 'main menu' : 'last seen ' + ago(p.lastSeen)).padEnd(32)} ${p.ban ? 'BANNED ' + left(p.ban.until - Date.now()) : ''}${p.mute ? ' MUTED' : ''}`);
      break;
    }
    case 'lobbies': case 'rooms':
      if (!S.rooms.length) out('No lobbies on this server.');
      for (const r of S.rooms) out(`  ${r.code}  ${r.name.padEnd(24)} ${r.state.padEnd(8)} ${r.modeName} on ${r.mapName} · ${r.members.length}/${r.settings.maxPlayers} players · ${r.settings.bots} bots${r.state === 'playing' ? ' · ' + clock(r.timeLeft) : ''}`);
      break;
    case 'bans': {
      const b = S.bans.filter(x => x.kind === 'player');
      if (!b.length) out('No active bans.');
      for (const x of b) out(`  ${plain(x.name).padEnd(18)} ${left(x.until - Date.now()).padEnd(10)} ${x.r || 'slur in chat'}`);
      for (const p of people().filter(p => p.mute)) out(`  ${plain(p.name).padEnd(18)} muted ${left(p.mute - Date.now())}`);
      break;
    }
    case 'maps': out(S.maps.map(m => `${m.id} (${m.name})`).join(', ')); break;
    case 'modes': out(S.modes.map(m => `${m.id} (${m.name})`).join(', ')); break;
    case 'whois': { const p = findByName(rest(0)); out(`${plain(p.name)} — ${p.online ? 'online' + (p.room ? ` in ${p.roomName} (${p.room})` : ', main menu') : 'offline, last seen ' + ago(p.lastSeen)}`, 'h'); out(`  id ${p.pid || 'none'} · level ${p.level || '?'}${p.k != null ? ` · ${p.k}/${p.d} K/D` : ''}${p.ban ? ` · BANNED ${left(p.ban.until - Date.now())} (${p.ban.r || 'slur in chat'})` : ''}${p.mute ? ` · MUTED ${left(p.mute - Date.now())}` : ''}`); break; }
    case 'ban': {
      if (!a[0]) throw new Error('ban <name> [time] [reason]');
      const p = findByName(a[0]); if (p.owner) throw new Error("That's you!");
      let mins = parseTime(a[1]), ri = 2; if (mins === null) { mins = 120; ri = 1; }
      await res({ cmd: 'ban', ...who(p), mins, reason: rest(ri) }); break;
    }
    case 'unban': if ((a[0] || '').toLowerCase() === 'all') { await res({ cmd: 'unbanall' }); break; } { let p = null; try { p = findByName(rest(0)); } catch {} await res(p ? { cmd: 'unban', ...who(p) } : { cmd: 'unban', name: rest(0) }); } break;
    case 'kick': await res({ cmd: 'kick', ...who(findByName(a[0])), reason: rest(1) }); break;
    case 'mute': { const p = findByName(a[0]); const m = parseTime(a[1]); await res({ cmd: 'mute', ...who(p), mins: m === null ? 60 : m }); break; }
    case 'unmute': await res({ cmd: 'unmute', ...who(findByName(rest(0))) }); break;
    case 'msg': case 'tell': case 'pm': await res({ cmd: 'msg', ...who(findByName(a[0])), text: rest(1) }); break;
    case 'announce': case 'a': case 'broadcast': await res({ cmd: 'announce', text: rest(0) }); break;
    case 'slay': case 'kill': await res({ cmd: 'slay', ...who(findByName(rest(0))) }); break;
    case 'host': await res({ cmd: 'host', ...who(findByName(rest(0))) }); break;
    case 'say': await res({ cmd: 'say', room: findRoom(a[0]).code, text: rest(1) }); break;
    case 'start': case 'end': case 'lobby': await res({ cmd, room: findRoom(a[0]).code }); break;
    case 'close': { const r = findRoom(a[0]); if (await confirmBox('CLOSE THIS LOBBY?', `Everyone in ${r.name} goes back to the menu.`, 'CLOSE')) await res({ cmd: 'close', room: r.code }); break; }
    case 'restart': {
      const r = findRoom(a[0]), s = {};
      for (const x of a.slice(1)) { const v = x.toLowerCase(); if (S.modes.some(m => m.id === v)) s.mode = v; else if (S.maps.some(m => m.id === v) || v === 'random') s.map = v; else throw new Error(`"${x}" isn't a mode or map id (see "maps" / "modes")`); }
      await res({ cmd: 'restart', room: r.code, settings: Object.keys(s).length ? s : undefined }); break;
    }
    case 'bots': await set(findRoom(a[0]), 'bots', Number(a[1])); break;
    case 'skill': case 'difficulty': await set(findRoom(a[0]), 'difficulty', (a[1] || '').toLowerCase()); break;
    case 'map': { const r = findRoom(a[0]), v = (a[1] || '').toLowerCase(); if (!S.maps.some(m => m.id === v) && v !== 'random') throw new Error('Unknown map. Type "maps" for the ids.'); await set(r, 'map', v); break; }
    case 'mode': { const r = findRoom(a[0]), v = (a[1] || '').toLowerCase(); if (!S.modes.some(m => m.id === v)) throw new Error('Unknown mode. Type "modes" for the ids.'); await set(r, 'mode', v); break; }
    case 'score': await set(findRoom(a[0]), 'scoreLimit', Number(a[1])); break;
    case 'time': await set(findRoom(a[0]), 'timeLimit', Number(a[1])); break;
    case 'max': await set(findRoom(a[0]), 'maxPlayers', Number(a[1])); break;
    case 'private': await set(findRoom(a[0]), 'private', !/^(off|no|0|public)$/i.test(a[1] || 'on')); break;
    case 'rename': await res({ cmd: 'set', room: findRoom(a[0]).code, settings: { name: rest(1) } }); break;
    case 'clearlog': await res({ cmd: 'clearlog' }); break;
    default: throw new Error(`Unknown command "${cmd}". Type "help".`);
  }
}
const hist = []; let hi = 0;
$('tIn').addEventListener('keydown', async e => {
  const inp = $('tIn');
  if (e.key === 'Enter') {
    const line = inp.value.trim(); if (!line) return;
    inp.value = ''; hist.push(line); hi = hist.length; $('tHint').textContent = '';
    out('> ' + line, 'in');
    try { await run(line); } catch (err) { out('✗ ' + err.message, 'err'); }
  } else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi]; } e.preventDefault(); }
  else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; inp.value = hist[hi] || ''; } e.preventDefault(); }
  else if (e.key === 'Tab') {
    e.preventDefault();
    const v = inp.value, parts = v.split(' '), last = parts.at(-1).toLowerCase();
    let pool;
    if (parts.length === 1) pool = CMDS;
    else if (parts.length === 2 && NAME_CMDS.has(parts[0].toLowerCase())) pool = [...new Set(people().map(p => plain(p.name)))].map(n => (n.includes(' ') ? `"${n}"` : n));
    else if (parts.length === 2 && ROOM_CMDS.has(parts[0].toLowerCase())) pool = S ? S.rooms.map(r => r.code) : [];
    else if (parts.length >= 3 && ['map', 'restart'].includes(parts[0].toLowerCase())) pool = S ? [...S.maps.map(m => m.id), ...S.modes.map(m => m.id)] : [];
    else return;
    const hits = pool.filter(x => x.toLowerCase().replace(/^"/, '').startsWith(last.replace(/^"/, '')));
    if (hits.length === 1) { parts[parts.length - 1] = hits[0]; inp.value = parts.join(' ') + ' '; $('tHint').textContent = ''; }
    else if (hits.length) $('tHint').textContent = hits.slice(0, 20).join('   ');
  }
});
$('tIn').addEventListener('input', () => {
  const c = $('tIn').value.trim().split(' ')[0].toLowerCase();
  const h = HELP.find(([x]) => x.split(/[ /]/)[0] === c || x.split(' / ').some(y => y.split(' ')[0] === c));
  $('tHint').textContent = h ? `${h[0]}  —  ${h[1]}` : '';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) $('mNo').click(); if (e.key === 'Enter' && !$('modal').classList.contains('hidden') && !e.target.closest?.('input, textarea')) { e.preventDefault(); $('mYes').click(); } });
