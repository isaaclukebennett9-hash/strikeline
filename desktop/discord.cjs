// Discord Rich Presence: shows what you're doing in Strikeline on your Discord profile
// ("Team Deathmatch · Downtown", the score, how long the match has gone on, party size).
// Talks to the Discord desktop app over its local IPC pipe, so it needs no extra packages and no internet.
// If Discord isn't running it quietly retries every so often; nothing here can break the game.
//
// Setup (once, by the developer): create an application at https://discord.com/developers/applications,
// name it "Strikeline" (that name is what Discord shows as "Playing Strikeline"), copy its Application ID
// into CLIENT_ID below, and under Rich Presence → Art Assets upload the game icon with the key "logo".
const net = require('net');
const path = require('path');

const CLIENT_ID = process.env.STRIKELINE_DISCORD_ID || '1573662731406676049';

const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };
const RETRY_MS = 20000;
const MIN_GAP_MS = 4000; // Discord allows about 5 presence updates per 20 seconds

function pipePath(i) {
  if (process.platform === 'win32') return `\\\\?\\pipe\\discord-ipc-${i}`;
  const dir = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return path.join(dir, `discord-ipc-${i}`);
}
function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data), 'utf8');
  const head = Buffer.alloc(8);
  head.writeInt32LE(op, 0);
  head.writeInt32LE(json.length, 4);
  return Buffer.concat([head, json]);
}
// Discord rejects text shorter than 2 or longer than 128 characters
const txt = (s) => { s = String(s || '').trim(); if (!s) return undefined; if (s.length < 2) s += ' '; return s.length > 128 ? s.slice(0, 127) + '…' : s; };

function createPresence(log = () => {}) {
  let sock = null, ready = false, stopped = !CLIENT_ID, retry = null, nonce = 0;
  let wanted = null, sentJson = '', lastSend = 0, sendTimer = null;

  function connect(i = 0) {
    if (stopped || sock) return;
    if (i > 9) { schedule(); return; }
    const s = net.createConnection(pipePath(i));
    let buf = Buffer.alloc(0), opened = false;
    s.once('connect', () => {
      opened = true; sock = s;
      s.write(encode(OP.HANDSHAKE, { v: 1, client_id: CLIENT_ID }));
    });
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      while (buf.length >= 8) {
        const op = buf.readInt32LE(0), len = buf.readInt32LE(4);
        if (buf.length < 8 + len) break;
        let msg = null;
        try { msg = JSON.parse(buf.slice(8, 8 + len).toString('utf8')); } catch {}
        buf = buf.slice(8 + len);
        if (op === OP.PING) { try { s.write(encode(OP.PONG, msg)); } catch {} }
        else if (op === OP.CLOSE) { if (msg) log(`discord closed the connection: ${msg.message || msg.code}`); s.destroy(); }
        else if (op === OP.FRAME && msg) {
          if (msg.evt === 'READY') { ready = true; sentJson = ''; flush(); }
          else if (msg.evt === 'ERROR') log(`discord: ${msg.data && msg.data.message}`);
        }
      }
    });
    s.on('error', () => {});
    s.on('close', () => {
      if (!opened) { connect(i + 1); return; } // try the next pipe (several Discord builds can be running)
      if (sock === s) { sock = null; ready = false; }
      schedule();
    });
  }
  function schedule() { if (stopped || retry) return; retry = setTimeout(() => { retry = null; connect(); }, RETRY_MS); }

  function flush() {
    if (!ready || !sock) return;
    const json = JSON.stringify(wanted);
    if (json === sentJson) return;
    const wait = lastSend + MIN_GAP_MS - Date.now();
    if (wait > 0) { if (!sendTimer) sendTimer = setTimeout(() => { sendTimer = null; flush(); }, wait); return; }
    sentJson = json; lastSend = Date.now();
    try { sock.write(encode(OP.FRAME, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: wanted || undefined }, nonce: String(++nonce) })); } catch {}
  }

  // p: { details, state, start, partySize, partyMax, partyId, version } from the game page (or null to clear)
  function set(p) {
    if (stopped) return;
    if (!p || typeof p !== 'object') { wanted = null; flush(); return; }
    const a = {
      details: txt(p.details),
      state: txt(p.state),
      assets: { large_image: 'logo', large_text: txt(p.version ? `Strikeline v${p.version}` : 'Strikeline') },
    };
    const start = Number(p.start);
    if (start > 1e12 && start < Date.now() + 60000) a.timestamps = { start: Math.floor(start) };
    const size = Math.floor(Number(p.partySize)), max = Math.floor(Number(p.partyMax));
    if (size > 0 && max >= size && max <= 64 && a.state) a.party = { id: txt(p.partyId) || 'strikeline', size: [size, max] };
    wanted = a;
    flush();
  }
  function stop() {
    stopped = true; clearTimeout(retry); clearTimeout(sendTimer);
    if (sock) { try { sock.end(); } catch {} sock = null; }
  }

  connect();
  return { set, stop, enabled: !!CLIENT_ID };
}

module.exports = { createPresence };
