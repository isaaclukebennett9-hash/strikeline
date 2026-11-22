// Run before packaging: remembers this project folder (so the app on this PC runs the live code),
// draws the app icon, and checks the online-hosting tool is present.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const root = path.join(__dirname, '..');
// the real path goes in this PC's app data folder only; the copy bundled into the installer stays empty
// so the shared installer doesn't contain anything about this PC
const devCfg = JSON.stringify({ source: root, setupDir: path.join(require('os').homedir(), 'StrikelineBuild') }, null, 2);
try { const dir = path.join(process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming'), 'Strikeline'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'source.json'), devCfg); } catch (e) { console.warn('could not write app-data source.json:', e.message); }
fs.writeFileSync(path.join(__dirname, 'source.json'), '{}\n');

// --- icon: orange crosshair on a dark rounded square, 256x256 PNG
const N = 256, px = Buffer.alloc(N * N * 4);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = (y * N + x) * 4, cx = x - 127.5, cy = y - 127.5, r = Math.hypot(cx, cy);
  const corner = Math.max(Math.abs(cx) - 88, 0) ** 2 + Math.max(Math.abs(cy) - 88, 0) ** 2 > 40 * 40;
  let c = corner ? [0, 0, 0, 0] : [16, 20, 30, 255];
  if (!corner) {
    const t = y / N; c = [Math.round(14 + 10 * t), Math.round(18 + 8 * t), Math.round(28 + 12 * t), 255];
    const ring = Math.abs(r - 70) < 9;
    const bar = (Math.abs(cx) < 7 && Math.abs(cy) > 28 && Math.abs(cy) < 104) || (Math.abs(cy) < 7 && Math.abs(cx) > 28 && Math.abs(cx) < 104);
    const dot = r < 11;
    if (ring || bar) c = [255, 122, 26, 255];
    if (dot) c = [255, 210, 160, 255];
  }
  px.set(c, i);
}
const raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4); }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcTable[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
fs.writeFileSync(path.join(__dirname, 'icon.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));

if (!fs.existsSync(path.join(__dirname, 'bin', 'cloudflared.exe'))) { console.error('Missing desktop/bin/cloudflared.exe'); process.exit(1); }

// electron-builder's Windows tools (winCodeSign) come in an archive that also holds Mac symbolic links, and
// Windows refuses to create those without Developer Mode / admin, so the build fails. Unpack it ourselves
// into electron-builder's cache without the Mac part; electron-builder then finds it and skips its own unpack.
(async () => {
  if (process.platform === 'win32') {
    const cache = process.env.ELECTRON_BUILDER_CACHE || path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'electron-builder', 'Cache');
    const dir = path.join(cache, 'winCodeSign'), dest = path.join(dir, 'winCodeSign-2.6.0');
    if (!fs.existsSync(path.join(dest, 'windows-10'))) {
      try {
        const { execFileSync } = require('child_process');
        const seven = require('7zip-bin').path7za;
        fs.mkdirSync(dir, { recursive: true });
        const archive = path.join(dir, 'winCodeSign-2.6.0.7z'), tmp = dest + '.tmp';
        console.log('Getting the Windows build tools (one time)…');
        const r = await fetch('https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z');
        if (!r.ok) throw new Error(`download failed (${r.status})`);
        fs.writeFileSync(archive, Buffer.from(await r.arrayBuffer()));
        fs.rmSync(tmp, { recursive: true, force: true });
        execFileSync(seven, ['x', '-bd', '-y', `-o${tmp}`, '-xr!darwin', archive], { stdio: 'ignore' });
        fs.rmSync(dest, { recursive: true, force: true });
        fs.renameSync(tmp, dest);
        fs.rmSync(archive, { force: true });
      } catch (err) { console.error(`(couldn't prepare the Windows build tools: ${err.message} — the build may still work)`); }
    }
  }
  console.log('Prebuild done.');
})();
