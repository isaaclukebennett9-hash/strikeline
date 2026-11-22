// Procedural textures (colour + bump maps), map themes, weapon skins and character skins.
import * as THREE from 'three';
import { REAL } from './style.js';

// ---------------------------------------------------------------- helpers
function mkCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}
const rnd = (a, b) => a + Math.random() * (b - a);
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noise(ctx, s, amt) {
  const img = ctx.getImageData(0, 0, s, s), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * amt; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  ctx.putImageData(img, 0, 0);
}
// Weathering marks: soft, stretched smudges (not hard round dots), some dark ones running down as streaks.
// Drawn wrapped at the edges so the tiling texture stays seamless.
function blotches(ctx, s, color, count, rMin, rMax, alpha = 0.15) {
  ctx.fillStyle = color; const c = ctx.fillStyle; // normalised '#rrggbb'
  const rgb = c[0] === '#' ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)).join(',') : '0,0,0';
  const dark = rgb.split(',').reduce((a, v) => a + +v, 0) < 240;
  const draw = (fn, x, y, r) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) if (x + ox > -r * 3 && x + ox < s + r * 3 && y + oy > -r * 4 && y + oy < s + r * 4) fn(x + ox, y + oy); };
  for (let i = 0; i < count; i++) {
    const x = Math.random() * s, y = Math.random() * s, r = rnd(rMin, rMax), a = alpha * (0.4 + Math.random() * 0.8);
    const sx = rnd(0.5, 1.7), rot = Math.random() * Math.PI;
    if (dark && Math.random() < 0.3) { // run-off streak
      const len = r * rnd(2, 4.5), w = Math.max(1.5, r * rnd(0.12, 0.3));
      draw((px, py) => {
        const g = ctx.createLinearGradient(0, py, 0, py + len);
        g.addColorStop(0, `rgba(${rgb},${a * 0.9})`); g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g; ctx.fillRect(px - w / 2, py, w, len);
      }, x, y, r);
      continue;
    }
    draw((px, py) => {
      ctx.save(); ctx.translate(px, py); ctx.rotate(rot); ctx.scale(sx, 1 / sx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }, x, y, r);
  }
  ctx.globalAlpha = 1;
}
function cracks(ctx, s, n, color = 'rgba(0,0,0,0.25)', w = 1) {
  ctx.strokeStyle = color; ctx.lineWidth = w;
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); let x = Math.random() * s, y = Math.random() * s; ctx.moveTo(x, y);
    for (let k = 0; k < 7; k++) { x += rnd(-18, 18); y += rnd(-18, 18); ctx.lineTo(x, y); }
    ctx.stroke();
  }
}
function hexMix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t, g = ((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t, bl = (pa & 255) * (1 - t) + (pb & 255) * t;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}
const gray = v => `rgb(${v | 0},${v | 0},${v | 0})`;
// paint(size, (colourCtx, bumpCtx, size) => {}) -> { map, bump }
function paint(size, fn) {
  const [c, x] = mkCanvas(size), [b, bx] = mkCanvas(size);
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, size, size);
  fn(x, bx, size);
  return { map: c, bump: b };
}
function toTex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ---------------------------------------------------------------- surface painters
const P = {
  brick(c1, c2, mortar = '#b8b0a2', rows = 16, cols = 6) {
    return paint(512, (x, b, s) => {
      x.fillStyle = mortar; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      const bh = s / rows, bw = s / cols;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? bw / 2 : 0;
        for (let k = -1; k <= cols; k++) {
          const px = k * bw + off + 3, py = r * bh + 3, w = bw - 6, h = bh - 6;
          x.fillStyle = hexMix(c1, c2, Math.random()); x.fillRect(px, py, w, h);
          x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(px, py, w, 3);
          x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(px, py + h - 3, w, 3);
          if (Math.random() < 0.15) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(px, py, w, h); }
          b.fillStyle = gray(rnd(190, 235)); b.fillRect(px, py, w, h);
          if (Math.random() < 0.3) { b.fillStyle = gray(120); b.fillRect(px + rnd(0, w - 10), py + rnd(0, h - 6), 8, 5); }
        }
      }
      noise(x, s, 22); noise(b, s, 30);
    });
  },
  plaster(col, dirt = '#000') {
    return paint(512, (x, b, s) => {
      x.fillStyle = col; x.fillRect(0, 0, s, s);
      blotches(x, s, '#fff', 120, 10, 60, 0.06); blotches(x, s, dirt, 140, 8, 50, 0.05);
      cracks(x, s, 5, 'rgba(0,0,0,0.18)'); cracks(b, s, 5, 'rgba(0,0,0,0.6)', 2);
      noise(x, s, 14); noise(b, s, 40);
      // patches of exposed brick
      for (let i = 0; i < 2; i++) {
        const px = rnd(30, 400), py = rnd(30, 400);
        for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) { x.fillStyle = hexMix('#8a4a32', '#a85e3e', Math.random()); x.fillRect(px + k * 26 + (r % 2) * 13, py + r * 14, 22, 10); b.fillStyle = gray(70); b.fillRect(px + k * 26 + (r % 2) * 13, py + r * 14, 22, 10); }
      }
    });
  },
  concrete(base = '#8a8a86') {
    return paint(512, (x, b, s) => {
      x.fillStyle = base; x.fillRect(0, 0, s, s);
      blotches(x, s, '#000', 260, 3, 22, 0.05); blotches(x, s, '#fff', 200, 3, 18, 0.04);
      noise(x, s, 22); noise(b, s, 45);
      cracks(x, s, 6, 'rgba(0,0,0,0.15)'); cracks(b, s, 6, 'rgba(0,0,0,0.5)', 2);
      x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, s - 3, s - 3);
      b.strokeStyle = '#202020'; b.lineWidth = 4; b.strokeRect(2, 2, s - 4, s - 4);
      for (let i = 0; i < 30; i++) { const px = rnd(0, s), py = rnd(0, s); b.fillStyle = gray(40); b.beginPath(); b.arc(px, py, rnd(1, 3), 0, 7); b.fill(); }
      const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.12)');
      x.fillStyle = g; x.fillRect(0, 0, s, s);
    });
  },
  cobble() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#4e4a44'; x.fillRect(0, 0, s, s); b.fillStyle = '#202020'; b.fillRect(0, 0, s, s);
      const n = 10, cs = s / n;
      for (let r = 0; r < n; r++) for (let k = -1; k <= n; k++) {
        const px = k * cs + (r % 2) * cs / 2 + rnd(-3, 3), py = r * cs + rnd(-3, 3), w = cs - rnd(5, 9), h = cs - rnd(5, 9);
        x.fillStyle = hexMix('#8d867b', '#6f6a62', Math.random());
        x.beginPath(); x.roundRect(px + 3, py + 3, w, h, 8); x.fill();
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.beginPath(); x.roundRect(px + 5, py + 5, w - 8, h / 3, 6); x.fill();
        b.fillStyle = gray(rnd(180, 230)); b.beginPath(); b.roundRect(px + 3, py + 3, w, h, 8); b.fill();
      }
      noise(x, s, 20); noise(b, s, 25);
    });
  },
  paving() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#7a776f'; x.fillRect(0, 0, s, s); b.fillStyle = '#383838'; b.fillRect(0, 0, s, s);
      const n = 4, cs = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = hexMix('#a39f95', '#8f8b82', Math.random()); x.fillRect(i * cs + 3, j * cs + 3, cs - 6, cs - 6);
        b.fillStyle = gray(rnd(200, 220)); b.fillRect(i * cs + 3, j * cs + 3, cs - 6, cs - 6);
      }
      blotches(x, s, '#000', 80, 4, 30, 0.06); noise(x, s, 18); noise(b, s, 25); cracks(x, s, 4); cracks(b, s, 4, 'rgba(0,0,0,0.5)', 2);
    });
  },
  floorWood() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#2b1a0e'; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      const rows = 8, ph = s / rows;
      for (let r = 0; r < rows; r++) {
        let px = -rnd(0, 200);
        while (px < s) {
          const len = rnd(150, 300);
          x.fillStyle = hexMix('#8a5a34', '#6b4122', Math.random()); x.fillRect(px + 2, r * ph + 2, len - 4, ph - 4);
          for (let g = 0; g < 6; g++) { x.strokeStyle = 'rgba(40,20,8,0.25)'; x.beginPath(); const gy = r * ph + rnd(6, ph - 6); x.moveTo(px, gy); x.bezierCurveTo(px + len / 3, gy + rnd(-3, 3), px + len * 0.66, gy + rnd(-3, 3), px + len, gy); x.stroke(); }
          b.fillStyle = gray(rnd(200, 225)); b.fillRect(px + 2, r * ph + 2, len - 4, ph - 4);
          px += len;
        }
      }
      noise(x, s, 14); noise(b, s, 18);
    });
  },
  floorTile(c1 = '#c9c4b8', c2 = '#9a9488') {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#5a5650'; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      const n = 8, cs = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = (i + j) % 2 ? c1 : c2; x.fillRect(i * cs + 2, j * cs + 2, cs - 4, cs - 4);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i * cs + 4, j * cs + 4, cs - 8, 4);
        b.fillStyle = gray(215); b.fillRect(i * cs + 2, j * cs + 2, cs - 4, cs - 4);
      }
      blotches(x, s, '#000', 50, 6, 30, 0.05); noise(x, s, 12);
    });
  },
  roof() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#4a4a4c'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 6000; i++) { const v = rnd(50, 130); x.fillStyle = gray(v); const px = rnd(0, s), py = rnd(0, s); x.fillRect(px, py, 3, 3); b.fillStyle = gray(v + 60); b.fillRect(px, py, 3, 3); }
      blotches(x, s, '#000', 30, 20, 60, 0.08);
    });
  },
  dirt(c1 = '#8a6a48', c2 = '#6a5034') { // packed earth: mottled patches, pebbles and tyre ruts
    return paint(512, (x, b, s) => {
      x.fillStyle = c1; x.fillRect(0, 0, s, s); b.fillStyle = '#808080'; b.fillRect(0, 0, s, s);
      blotches(x, s, c2, 160, 10, 70, 0.3); blotches(x, s, '#000', 120, 6, 40, 0.06); blotches(x, s, '#fff', 60, 6, 30, 0.05);
      for (let i = 0; i < 900; i++) { const px = rnd(0, s), py = rnd(0, s), r = rnd(1, 4), v = rnd(70, 200); x.fillStyle = `rgba(${v},${v * 0.85 | 0},${v * 0.7 | 0},0.6)`; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); b.fillStyle = gray(v); b.beginPath(); b.arc(px, py, r, 0, 7); b.fill(); }
      noise(x, s, 22); noise(b, s, 45);
    });
  },
  siding(col) { // horizontal clapboard with a shadow line under each board
    return paint(256, (x, b, s) => {
      x.fillStyle = col; x.fillRect(0, 0, s, s); b.fillStyle = '#909090'; b.fillRect(0, 0, s, s);
      const n = 10, h = s / n;
      for (let i = 0; i < n; i++) {
        const g = x.createLinearGradient(0, i * h, 0, (i + 1) * h); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.85, 'rgba(0,0,0,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.32)');
        x.fillStyle = g; x.fillRect(0, i * h, s, h);
        const gb = b.createLinearGradient(0, i * h, 0, (i + 1) * h); gb.addColorStop(0, '#d0d0d0'); gb.addColorStop(1, '#404040'); b.fillStyle = gb; b.fillRect(0, i * h, s, h);
      }
      blotches(x, s, '#000', 30, 5, 30, 0.04); noise(x, s, 10);
    });
  },
  roofTile(c1, c2) { // overlapping tile rows
    return paint(256, (x, b, s) => {
      x.fillStyle = c2; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      const rows = 8, cols = 8, h = s / rows, w = s / cols;
      for (let r = 0; r < rows; r++) for (let k = -1; k <= cols; k++) {
        const px = k * w + (r % 2) * w / 2 + 1, py = r * h + 1;
        x.fillStyle = hexMix(c1, c2, Math.random() * 0.5); x.fillRect(px, py, w - 2, h - 2);
        x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px, py + h - 5, w - 2, 3);
        b.fillStyle = gray(rnd(170, 230)); b.fillRect(px, py, w - 2, h - 4);
      }
      noise(x, s, 14);
    });
  },
  rock(c1, c2) { // weathered stone: mottled colour, faint wavy strata, chips, cracks and speckle
    return paint(512, (x, b, s) => {
      x.fillStyle = c1; x.fillRect(0, 0, s, s); b.fillStyle = '#808080'; b.fillRect(0, 0, s, s);
      blotches(x, s, c2, 90, 20, 90, 0.35); blotches(x, s, '#ffffff', 60, 15, 70, 0.08); blotches(x, s, '#000000', 80, 8, 50, 0.08);
      for (let k = 0; k < 7; k++) { // faint, broken, wavy strata lines
        const y0 = rnd(0, s), amp = rnd(4, 14), ph = rnd(0, 6);
        x.strokeStyle = `rgba(0,0,0,${rnd(0.06, 0.16)})`; x.lineWidth = rnd(1.5, 4); b.strokeStyle = 'rgba(30,30,30,0.6)'; b.lineWidth = 3;
        x.beginPath(); b.beginPath();
        for (let px = 0; px <= s; px += 8) { const py = y0 + Math.sin(px / s * Math.PI * 4 + ph) * amp; if (px === 0 || Math.random() < 0.08) { x.moveTo(px, py); b.moveTo(px, py); } else { x.lineTo(px, py); b.lineTo(px, py); } }
        x.stroke(); b.stroke();
      }
      for (let i = 0; i < 70; i++) { // chipped facets
        const px = rnd(0, s), py = rnd(0, s), r = rnd(6, 22), v = rnd(0, 1);
        x.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.08)'; b.fillStyle = gray(v < 0.5 ? 90 : 190);
        x.beginPath(); b.beginPath();
        for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + rnd(-0.3, 0.3), rr = r * rnd(0.6, 1); const qx = px + Math.cos(a) * rr, qy = py + Math.sin(a) * rr; k ? (x.lineTo(qx, qy), b.lineTo(qx, qy)) : (x.moveTo(qx, qy), b.moveTo(qx, qy)); }
        x.fill(); b.fill();
      }
      cracks(x, s, 18, 'rgba(0,0,0,0.35)', 1.5); cracks(b, s, 18, 'rgba(0,0,0,0.9)', 3);
      for (let i = 0; i < 1500; i++) { x.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.12)'; x.fillRect(rnd(0, s), rnd(0, s), 2, 2); }
      noise(x, s, 18); noise(b, s, 50);
    });
  },
  hull(col) { // painted steel plates with weld seams and rust streaks
    return paint(512, (x, b, s) => {
      x.fillStyle = col; x.fillRect(0, 0, s, s); b.fillStyle = '#909090'; b.fillRect(0, 0, s, s);
      x.strokeStyle = 'rgba(0,0,0,0.35)'; b.strokeStyle = '#303030'; x.lineWidth = 2; b.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * s / 4); x.lineTo(s, i * s / 4); x.stroke(); b.beginPath(); b.moveTo(0, i * s / 4); b.lineTo(s, i * s / 4); b.stroke(); }
      for (let r = 0; r < 4; r++) for (let k = 0; k < 3; k++) { const px = k * s / 3 + (r % 2) * s / 6; x.beginPath(); x.moveTo(px, r * s / 4); x.lineTo(px, (r + 1) * s / 4); x.stroke(); }
      for (let i = 0; i < 18; i++) { const px = rnd(0, s), g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(120,60,20,0.5)'); g.addColorStop(1, 'rgba(120,60,20,0)'); x.fillStyle = g; x.fillRect(px, rnd(0, s), rnd(2, 5), rnd(40, 160)); }
      blotches(x, s, '#000', 60, 6, 30, 0.06); noise(x, s, 12);
    });
  },
  deck() { // non-slip steel deck plates
    return paint(256, (x, b, s) => {
      x.fillStyle = '#6a6f72'; x.fillRect(0, 0, s, s); b.fillStyle = '#808080'; b.fillRect(0, 0, s, s);
      for (let i = 0; i < s; i += 16) for (let j = 0; j < s; j += 16) { const o = ((i + j) / 16) % 2 ? 4 : 10; x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i + o, j + 3, 2, 9); b.fillStyle = '#d0d0d0'; b.fillRect(i + o, j + 3, 2, 9); }
      x.strokeStyle = 'rgba(0,0,0,0.4)'; x.lineWidth = 2; x.strokeRect(1, 1, s - 2, s - 2);
      blotches(x, s, '#5a3a1a', 20, 6, 24, 0.12); noise(x, s, 12);
    });
  },
  billboard() { // generic ad poster: gradient, big shape and text bars (no real brands)
    return paint(256, (x, b, s) => {
      const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#1f6fd1'); g.addColorStop(1, '#ff8a2a'); x.fillStyle = g; x.fillRect(0, 0, s, s);
      x.fillStyle = 'rgba(255,255,255,0.9)'; x.beginPath(); x.arc(s * 0.72, s * 0.45, s * 0.2, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.fillRect(s * 0.08, s * 0.2, s * 0.42, s * 0.1); x.fillRect(s * 0.08, s * 0.38, s * 0.3, s * 0.06); x.fillRect(s * 0.08, s * 0.5, s * 0.34, s * 0.06);
      x.fillStyle = '#ffd36a'; x.fillRect(s * 0.08, s * 0.7, s * 0.25, s * 0.12);
      noise(x, s, 8);
    });
  },
  metalCorr(col, rust = true) {
    return paint(256, (x, b, s) => {
      for (let i = 0; i < s; i++) {
        const v = Math.sin((i / s) * Math.PI * 2 * 8);
        x.fillStyle = hexMix(col, v > 0 ? '#ffffff' : '#000000', Math.abs(v) * 0.18); x.fillRect(i, 0, 1, s);
        b.fillStyle = gray(128 + v * 90); b.fillRect(i, 0, 1, s);
      }
      if (rust) { x.globalAlpha = 0.5; for (let i = 0; i < 14; i++) { const px = rnd(0, s); const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(110,55,20,0.6)'); g.addColorStop(1, 'rgba(110,55,20,0)'); x.fillStyle = g; x.fillRect(px, rnd(0, s / 2), rnd(2, 6), rnd(40, 160)); } x.globalAlpha = 1; }
      noise(x, s, 14);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, s, 4); x.fillRect(0, s - 4, s, 4);
    });
  },
  panels(base, seam = 'rgba(0,0,0,0.45)', n = 2, bolts = true) {
    return paint(512, (x, b, s) => {
      x.fillStyle = base; x.fillRect(0, 0, s, s);
      blotches(x, s, '#000', 80, 6, 40, 0.05); noise(x, s, 14); noise(b, s, 18);
      const cs = s / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${rnd(0.02, 0.06)})`; x.fillRect(i * cs, j * cs, cs, cs);
        x.strokeStyle = seam; x.lineWidth = 3; x.strokeRect(i * cs + 1.5, j * cs + 1.5, cs - 3, cs - 3);
        b.strokeStyle = '#202020'; b.lineWidth = 4; b.strokeRect(i * cs + 2, j * cs + 2, cs - 4, cs - 4);
        if (bolts) for (const [bx, by] of [[14, 14], [cs - 14, 14], [14, cs - 14], [cs - 14, cs - 14]]) {
          x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(i * cs + bx, j * cs + by, 4, 0, 7); x.fill();
          b.fillStyle = '#e0e0e0'; b.beginPath(); b.arc(i * cs + bx, j * cs + by, 4, 0, 7); b.fill();
        }
      }
      const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.15)'); x.fillStyle = g; x.fillRect(0, 0, s, s);
    });
  },
  mudbrick() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#b48a5a'; x.fillRect(0, 0, s, s);
      blotches(x, s, '#e0bf8a', 120, 10, 60, 0.1); blotches(x, s, '#6e4c2a', 100, 6, 40, 0.08);
      noise(x, s, 26); noise(b, s, 60);
      for (let i = 0; i < 3; i++) {
        const px = rnd(20, 400), py = rnd(20, 400);
        for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { x.fillStyle = hexMix('#9a7044', '#86603a', Math.random()); x.fillRect(px + k * 44 + (r % 2) * 22, py + r * 20, 40, 16); b.fillStyle = gray(200); b.fillRect(px + k * 44 + (r % 2) * 22, py + r * 20, 40, 16); }
      }
      cracks(x, s, 6, 'rgba(60,35,15,0.35)'); cracks(b, s, 6, 'rgba(0,0,0,0.6)', 2);
    });
  },
  sandstone() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#9a7246'; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      const rows = 6, rh = s / rows;
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 64 : 0;
        for (let k = -1; k < 4; k++) {
          x.fillStyle = `hsl(32,${38 + Math.random() * 12}%,${50 + Math.random() * 12}%)`; x.fillRect(off + k * 128 + 3, r * rh + 3, 122, rh - 6);
          b.fillStyle = gray(rnd(190, 230)); b.fillRect(off + k * 128 + 3, r * rh + 3, 122, rh - 6);
        }
      }
      blotches(x, s, '#7a5530', 60, 2, 12, 0.3); noise(x, s, 26); noise(b, s, 40);
    });
  },
  sand() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#d6b27a'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 50; i++) { const y = Math.random() * s; for (const [ctx, col] of [[x, `rgba(150,110,60,${rnd(0.06, 0.14)})`], [b, 'rgba(255,255,255,0.3)']]) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(170, y + 20, 340, y - 20, s, y); ctx.stroke(); } }
      blotches(x, s, '#b38a52', 60, 20, 70, 0.12); noise(x, s, 30); noise(b, s, 40);
    });
  },
  snow() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#e8eef5'; x.fillRect(0, 0, s, s);
      blotches(x, s, '#b8c8dc', 80, 20, 80, 0.15); blotches(x, s, '#fff', 80, 10, 50, 0.3); noise(x, s, 12);
      blotches(b, s, '#fff', 80, 20, 80, 0.3); noise(b, s, 30);
    });
  },
  grass() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#4d6b2e'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 9000; i++) { x.fillStyle = hexMix('#3b5a22', '#7a9a3e', Math.random()); const px = rnd(0, s), py = rnd(0, s); x.fillRect(px, py, 2, rnd(3, 7)); }
      noise(b, s, 70);
    });
  },
  asphalt() {
    return paint(512, (x, b, s) => {
      x.fillStyle = '#2b2c31'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 7000; i++) { const v = rnd(30, 80); x.fillStyle = gray(v); const px = rnd(0, s), py = rnd(0, s); x.fillRect(px, py, 2, 2); b.fillStyle = gray(v + 100); b.fillRect(px, py, 2, 2); }
      blotches(x, s, '#000', 50, 20, 80, 0.2); cracks(x, s, 8, 'rgba(10,10,10,0.9)', 2); cracks(b, s, 8, 'rgba(0,0,0,0.8)', 3);
    });
  },
  woodPlanks(base = '#6e4a2c') {
    return paint(256, (x, b, s) => {
      x.fillStyle = base; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      for (let i = 0; i < 8; i++) {
        x.fillStyle = hexMix(base, i % 2 ? '#000000' : '#ffffff', rnd(0.02, 0.12)); x.fillRect(0, i * 32 + 2, s, 28);
        b.fillStyle = gray(210); b.fillRect(0, i * 32 + 2, s, 28);
        for (let g = 0; g < 4; g++) { x.strokeStyle = 'rgba(0,0,0,0.15)'; x.beginPath(); const y = i * 32 + rnd(4, 28); x.moveTo(0, y); x.lineTo(s, y + rnd(-3, 3)); x.stroke(); }
        x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.arc(10, i * 32 + 16, 2, 0, 7); x.arc(s - 10, i * 32 + 16, 2, 0, 7); x.fill();
      }
      noise(x, s, 14);
    });
  },
  crate() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#9a6b3c'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#8d6034' : '#a37443'; x.fillRect(0, i * 32, s, 32); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, i * 32, s, 2); b.fillStyle = '#404040'; b.fillRect(0, i * 32, s, 3); }
      noise(x, s, 24);
      for (const ctx of [x, b]) { ctx.strokeStyle = ctx === x ? '#5b3c1f' : '#ffffff'; ctx.lineWidth = 22; ctx.strokeRect(11, 11, s - 22, s - 22); ctx.beginPath(); ctx.moveTo(20, 20); ctx.lineTo(s - 20, s - 20); ctx.stroke(); }
      x.fillStyle = '#2a2018'; for (const [a, c] of [[14, 14], [s - 14, 14], [14, s - 14], [s - 14, s - 14]]) { x.beginPath(); x.arc(a, c, 4, 0, 7); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.font = 'bold 26px Arial'; x.textAlign = 'center'; x.fillText('FRAGILE', s / 2 + 30, s / 2 + 50);
    });
  },
  container(col) {
    return paint(256, (x, b, s) => {
      x.fillStyle = col; x.fillRect(0, 0, s, s);
      for (let i = 0; i < s; i += 16) { x.fillStyle = 'rgba(0,0,0,0.22)'; x.fillRect(i, 0, 5, s); x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(i + 8, 0, 3, s); b.fillStyle = '#e0e0e0'; b.fillRect(i + 6, 0, 8, s); }
      blotches(x, s, '#5a3315', 30, 3, 18, 0.35); noise(x, s, 18);
      x.fillStyle = 'rgba(0,0,0,0.4)'; x.fillRect(0, 0, s, 6); x.fillRect(0, s - 6, s, 6);
      x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = 'bold 18px Arial'; x.fillText('STRK 204871', 20, 40);
    });
  },
  hazard() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#e5b414'; x.fillRect(0, 0, s, s); x.fillStyle = '#1b1b1b';
      for (let i = -s; i < s * 2; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 32, 0); x.lineTo(i + 32 + s, s); x.lineTo(i + s, s); x.fill(); }
      noise(x, s, 30); blotches(x, s, '#000', 30, 4, 20, 0.2); noise(b, s, 30);
    });
  },
  awning(c1, c2) {
    return paint(256, (x, b, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c1 : c2; x.fillRect(i * 32, 0, 32, s); b.fillStyle = gray(i % 2 ? 160 : 100); b.fillRect(i * 32, 0, 32, s); } noise(x, s, 14); });
  },
  sandbag() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#6a6040'; x.fillRect(0, 0, s, s); b.fillStyle = '#202020'; b.fillRect(0, 0, s, s);
      for (let r = 0; r < 4; r++) for (let k = -1; k < 3; k++) {
        const px = k * 128 + (r % 2) * 64, py = r * 64;
        x.fillStyle = hexMix('#a39a6c', '#8a8158', Math.random()); x.beginPath(); x.roundRect(px + 4, py + 4, 120, 56, 22); x.fill();
        b.fillStyle = gray(220); b.beginPath(); b.roundRect(px + 4, py + 4, 120, 56, 22); b.fill();
      }
      noise(x, s, 22);
    });
  },
  leaves() {
    if (REAL) return paint(256, (x, b, s) => { // realistic: overlapping individual leaves, darker in the gaps
      x.fillStyle = '#1e3a12'; x.fillRect(0, 0, s, s); b.fillStyle = '#303030'; b.fillRect(0, 0, s, s);
      for (let i = 0; i < 900; i++) {
        const px = rnd(-8, s + 8), py = rnd(-8, s + 8), a = rnd(0, 6.28), l = rnd(5, 11), v = Math.random();
        for (const [cx, ox, oy] of [[x, 0, 0], [x, s, 0], [x, -s, 0], [x, 0, s], [x, 0, -s]]) {
          cx.save(); cx.translate(px + ox, py + oy); cx.rotate(a); cx.fillStyle = hexMix('#2c5418', '#79a63a', v); cx.beginPath(); cx.ellipse(0, 0, l, l * 0.42, 0, 0, 7); cx.fill();
          cx.strokeStyle = 'rgba(20,40,10,0.5)'; cx.lineWidth = 0.6; cx.beginPath(); cx.moveTo(-l, 0); cx.lineTo(l, 0); cx.stroke(); cx.restore();
        }
        b.save(); b.translate(px, py); b.rotate(a); b.fillStyle = gray(90 + v * 150); b.beginPath(); b.ellipse(0, 0, l, l * 0.42, 0, 0, 7); b.fill(); b.restore();
      }
      noise(x, s, 14);
    });
    return paint(128, (x, b, s) => {
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const v = Math.random(); x.fillStyle = hexMix('#2f5a1e', '#5f8f2e', v); x.fillRect(i * 8, j * 8, 8, 8); b.fillStyle = gray(80 + v * 150); b.fillRect(i * 8, j * 8, 8, 8); }
    });
  },
  bark() {
    return paint(128, (x, b, s) => {
      x.fillStyle = '#4a3020'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 30; i++) { const px = rnd(0, s); x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(px, 0, rnd(1, 4), s); b.fillStyle = '#303030'; b.fillRect(px, 0, 3, s); }
      noise(x, s, 20);
    });
  },
  rug() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#7a2a22'; x.fillRect(0, 0, s, s);
      x.strokeStyle = '#d9a54a'; x.lineWidth = 6; x.strokeRect(14, 14, s - 28, s - 28);
      x.strokeStyle = '#2a3a6a'; x.lineWidth = 4; x.strokeRect(30, 30, s - 60, s - 60);
      x.fillStyle = '#d9a54a'; x.save(); x.translate(s / 2, s / 2); x.rotate(Math.PI / 4); x.fillRect(-40, -40, 80, 80); x.restore();
      x.fillStyle = '#2a3a6a'; x.save(); x.translate(s / 2, s / 2); x.rotate(Math.PI / 4); x.fillRect(-22, -22, 44, 44); x.restore();
      noise(x, s, 20); noise(b, s, 40);
    });
  },
  water() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#2a6d8f'; x.fillRect(0, 0, s, s);
      for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,255,255,${rnd(0.05, 0.2)})`; x.lineWidth = 2; x.beginPath(); const y = rnd(0, s); x.moveTo(rnd(0, s), y); x.lineTo(rnd(0, s), y + rnd(-4, 4)); x.stroke(); }
      noise(b, s, 50);
    });
  },
  paint(col, amt = 10) { return paint(128, (x, b, s) => { x.fillStyle = col; x.fillRect(0, 0, s, s); noise(x, s, amt); noise(b, s, 12); }); },
  roadLine() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#2b2c31'; x.fillRect(0, 0, s, s); noise(x, s, 30);
      x.fillStyle = '#d8c25a'; for (let i = 0; i < s; i += 64) x.fillRect(i, s / 2 - 6, 36, 12);
    });
  },
  jumppad() {
    return paint(256, (x, b, s) => {
      x.fillStyle = '#0a1a24'; x.fillRect(0, 0, s, s);
      x.strokeStyle = '#22e5ff'; x.lineWidth = 10; x.strokeRect(14, 14, s - 28, s - 28);
      x.fillStyle = '#22e5ff';
      for (let i = 0; i < 3; i++) { const y = 70 + i * 50; x.beginPath(); x.moveTo(s / 2, y - 30); x.lineTo(s / 2 + 50, y + 10); x.lineTo(s / 2 - 50, y + 10); x.closePath(); x.fill(); }
    });
  },
  vending() {
    return paint(128, (x, b, s) => {
      x.fillStyle = '#c4202a'; x.fillRect(0, 0, s, s);
      x.fillStyle = '#9ef0ff'; x.fillRect(12, 12, 70, 90);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = ['#ff5a5a', '#5aff7a', '#ffd25a', '#5a8aff'][(i + j) % 4]; x.fillRect(18 + i * 16, 18 + j * 21, 10, 14); }
      x.fillStyle = '#222'; x.fillRect(90, 30, 26, 40);
    });
  },
};

// ---------------------------------------------------------------- themes
export const THEMES = {
  town: {
    skyTop: '#3d79c6', skyHorizon: '#e9dcc4', skyBottom: '#7d7466', fog: '#cfd4d8', fogNear: 45, fogFar: 170,
    sun: '#fff1d6', sunI: 3.0, sunDir: [0.55, 0.85, 0.35], hemiSky: '#cfe0ff', hemiGround: '#6a5a48', hemiI: 0.9,
    floor: 'paving', wall: 'brick', exposure: 1.0, lamps: [],
  },
  harbor: {
    skyTop: '#5a6e86', skyHorizon: '#c9cfd4', skyBottom: '#4a4f55', fog: '#a8b2bc', fogNear: 30, fogFar: 150,
    sun: '#eef2ff', sunI: 2.2, sunDir: [-0.4, 0.8, 0.5], hemiSky: '#c8d6e8', hemiGround: '#5a5a5a', hemiI: 1.0,
    floor: 'concrete_floor', wall: 'concrete', exposure: 1.0, lamps: [],
  },
  neon: {
    skyTop: '#05030f', skyHorizon: '#3a1450', skyBottom: '#0a0812', fog: '#1a0e2a', fogNear: 20, fogFar: 110,
    sun: '#8f9cff', sunI: 0.8, sunDir: [0.3, 0.9, -0.4], hemiSky: '#6a5cff', hemiGround: '#200a30', hemiI: 0.6,
    floor: 'asphalt', wall: 'concrete_dark', exposure: 1.3, stars: true,
    lamps: [['#ff2bd6', 14, 14], ['#22e5ff', -14, 14], ['#ff2bd6', -14, -14], ['#22e5ff', 14, -14], ['#ffb12b', 0, 0]],
  },
  snow: {
    skyTop: '#8aa4c2', skyHorizon: '#e3ebf3', skyBottom: '#d8e2ec', fog: '#dfe7ef', fogNear: 20, fogFar: 130,
    sun: '#e8f0ff', sunI: 2.0, sunDir: [0.3, 0.7, 0.6], hemiSky: '#dfeaff', hemiGround: '#9aa8b8', hemiI: 1.0,
    floor: 'snow', wall: 'bunker', exposure: 0.95, lamps: [],
  },
  desert: {
    skyTop: '#2f7fd1', skyHorizon: '#f2dcb0', skyBottom: '#c9a46c', fog: '#e8d2a6', fogNear: 40, fogFar: 180,
    sun: '#fff0d0', sunI: 3.4, sunDir: [-0.4, 0.9, 0.2], hemiSky: '#cfe4ff', hemiGround: '#b08a55', hemiI: 0.9,
    floor: 'sand', wall: 'sandstone', exposure: 0.95, lamps: [],
  },
  city: {
    skyTop: '#3a74c4', skyHorizon: '#dfe6ee', skyBottom: '#6a6e74', fog: '#c6d0da', fogNear: 60, fogFar: 230,
    sun: '#fff4e0', sunI: 3.0, sunDir: [0.5, 0.85, 0.4], hemiSky: '#cfe0ff', hemiGround: '#5a5a5a', hemiI: 0.9,
    floor: 'asphalt', wall: 'concrete', exposure: 1.0, lamps: [],
  },
  base: {
    skyTop: '#5f7ea0', skyHorizon: '#dcdfd2', skyBottom: '#5a5e50', fog: '#c4ccbe', fogNear: 55, fogFar: 220,
    sun: '#fff2dc', sunI: 2.7, sunDir: [-0.45, 0.8, 0.45], hemiSky: '#d0dcf0', hemiGround: '#5a6440', hemiI: 0.95,
    floor: 'grass', wall: 'concrete', exposure: 1.0, lamps: [],
  },
  construction: {
    skyTop: '#46669a', skyHorizon: '#f4b47a', skyBottom: '#6a5440', fog: '#d9b48c', fogNear: 35, fogFar: 160,
    sun: '#ffc68a', sunI: 2.8, sunDir: [0.75, 0.42, 0.3], hemiSky: '#c8d4f0', hemiGround: '#7a5a3a', hemiI: 0.9,
    floor: 'dirt', wall: 'concrete', exposure: 1.0, lamps: [],
  },
  shipyard: {
    skyTop: '#4d6a8c', skyHorizon: '#e8c9a4', skyBottom: '#4a4c52', fog: '#b9b6b0', fogNear: 70, fogFar: 300,
    sun: '#ffe2bc', sunI: 2.6, sunDir: [-0.6, 0.55, 0.45], hemiSky: '#cdd8ea', hemiGround: '#5a5650', hemiI: 0.95,
    floor: 'concrete_floor', wall: 'concrete', exposure: 1.0, lamps: [],
  },
  suburb: {
    skyTop: '#3a7fd0', skyHorizon: '#e6eef4', skyBottom: '#6f7a62', fog: '#cfdde6', fogNear: 70, fogFar: 300,
    sun: '#fff6e4', sunI: 3.1, sunDir: [0.45, 0.85, 0.3], hemiSky: '#d4e4ff', hemiGround: '#5c6e48', hemiI: 0.95,
    floor: 'grass', wall: 'brick', exposure: 1.0, lamps: [],
  },
  canyon: {
    skyTop: '#3170c4', skyHorizon: '#f6cf9a', skyBottom: '#b07a4a', fog: '#e8c39a', fogNear: 70, fogFar: 300,
    sun: '#ffdcae', sunI: 3.3, sunDir: [0.65, 0.6, -0.35], hemiSky: '#cfe0ff', hemiGround: '#a06a42', hemiI: 0.9,
    floor: 'sand', wall: 'rock', exposure: 0.95, lamps: [],
  },
  killhouse: {
    skyTop: '#26313f', skyHorizon: '#78849a', skyBottom: '#2a2a2a', fog: '#55606e', fogNear: 25, fogFar: 90,
    sun: '#ffffff', sunI: 2.2, sunDir: [0.2, 1, 0.35], hemiSky: '#c8d4e6', hemiGround: '#4a4a4a', hemiI: 0.9,
    floor: 'floor_tile', wall: 'plaster_white', exposure: 1.0, lamps: [],
  },
};

// name -> () => { tex: {map,bump} | canvas, scale (m per tile), rough, metal, bump, color, emissive... }
const MAT_DEFS = {
  brick: () => ({ tex: P.brick('#9a4a32', '#b8603e'), scale: 2.2, rough: 0.9, bump: 2 }),
  brick_dark: () => ({ tex: P.brick('#4e3a32', '#6a4c40', '#7a746c'), scale: 2.2, rough: 0.9, bump: 2 }),
  plaster_yellow: () => ({ tex: P.plaster('#d9b870', '#5a4020'), scale: 3, rough: 0.95, bump: 1 }),
  plaster_white: () => ({ tex: P.plaster('#dcd6ca'), scale: 3, rough: 0.95, bump: 1 }),
  plaster_dark: () => ({ tex: P.plaster('#4a4258'), scale: 3, rough: 0.9, bump: 1 }),
  concrete: () => ({ tex: P.concrete(), scale: 4, rough: 0.9, bump: 1.2 }),
  concrete_dark: () => ({ tex: P.panels('#3c3f48', 'rgba(0,0,0,0.6)', 2), scale: 4, rough: 0.8, bump: 1 }),
  concrete_floor: () => ({ tex: P.concrete('#77756f'), scale: 6, rough: 0.95, bump: 1 }),
  concrete_panel: () => ({ tex: P.panels('#9a9a94'), scale: 3.2, rough: 0.85, bump: 1.2 }),
  panel_white: () => ({ tex: P.panels('#d8dde2', 'rgba(40,60,80,0.5)', 4), scale: 3.2, rough: 0.5, metal: 0.1, bump: 1 }),
  bunker: () => ({ tex: P.panels('#7b7f78', 'rgba(0,0,0,0.5)', 2), scale: 3, rough: 0.9, bump: 1 }),
  stone: () => ({ tex: P.sandstone(), scale: 2, rough: 0.9, bump: 1.5, color: '#b8b4ac' }),
  cobble: () => ({ tex: P.cobble(), scale: 3, rough: 0.85, bump: 2.5 }),
  paving: () => ({ tex: P.paving(), scale: 4, rough: 0.9, bump: 1.5 }),
  floor_wood: () => ({ tex: P.floorWood(), scale: 3, rough: 0.6, bump: 1.2 }),
  floor_tile: () => ({ tex: P.floorTile(), scale: 3, rough: 0.35, bump: 1 }),
  roof: () => ({ tex: P.roof(), scale: 3, rough: 1, bump: 1.5 }),
  mudroof: () => ({ tex: P.mudbrick(), scale: 3, rough: 1, bump: 1, color: '#c9b49a' }),
  metal: () => ({ tex: P.panels('#7c858f', 'rgba(0,0,0,0.5)', 2), scale: 2, rough: 0.55, metal: 0.3, bump: 1 }),
  metal_dark: () => ({ tex: P.paint('#2a2d33'), scale: 1, rough: 0.5, metal: 0.6 }),
  metal_corr: () => ({ tex: P.metalCorr('#6f7d84'), scale: 3, rough: 0.6, metal: 0.4, bump: 2 }),
  metal_roof: () => ({ tex: P.metalCorr('#5a6066', false), scale: 3, rough: 0.6, metal: 0.4, bump: 2 }),
  metal_grate: () => ({ tex: P.panels('#4a4e54', 'rgba(0,0,0,0.7)', 8, false), scale: 2, rough: 0.6, metal: 0.5, bump: 2 }),
  mudbrick: () => ({ tex: P.mudbrick(), scale: 3, rough: 1, bump: 1.5 }),
  sandstone: () => ({ tex: P.sandstone(), scale: 2.5, rough: 0.95, bump: 1.5 }),
  sand: () => ({ tex: P.sand(), scale: 8, rough: 1, bump: 1 }),
  snow: () => ({ tex: P.snow(), scale: 6, rough: 0.9, bump: 0.8 }),
  snowpile: () => ({ tex: P.snow(), scale: 3, rough: 0.9, bump: 1 }),
  ice: () => ({ tex: P.paint('#9fd3ef', 16), scale: 2.5, rough: 0.1, metal: 0.1, transparent: 0.85 }),
  asphalt: () => ({ tex: P.asphalt(), scale: 6, rough: 0.55, bump: 1 }),
  road: () => ({ tex: P.asphalt(), scale: 6, rough: 0.7, bump: 1 }),
  road_line: () => ({ tex: P.roadLine(), scale: 4, rough: 0.6 }),
  grass: () => ({ tex: P.grass(), scale: 4, rough: 1, bump: 1 }),
  wood: () => ({ tex: P.woodPlanks(), scale: 2, rough: 0.85, bump: 1 }),
  crate: () => ({ tex: P.crate(), scale: 1.3, rough: 0.85, fit: true, bump: 1.5 }),
  container_red: () => ({ tex: P.container('#9a2e22'), scale: 2.6, rough: 0.6, metal: 0.4, bump: 1.5 }),
  container_blue: () => ({ tex: P.container('#24527f'), scale: 2.6, rough: 0.6, metal: 0.4, bump: 1.5 }),
  container_green: () => ({ tex: P.container('#3e6b37'), scale: 2.6, rough: 0.6, metal: 0.4, bump: 1.5 }),
  hazard: () => ({ tex: P.hazard(), scale: 2, rough: 0.7 }),
  crane: () => ({ tex: P.hazard(), scale: 3, rough: 0.6, metal: 0.4 }),
  forklift: () => ({ tex: P.paint('#e0a81c'), scale: 1, rough: 0.5, metal: 0.3 }),
  trim: () => ({ tex: P.paint('#e8e4da', 8), scale: 1, rough: 0.7 }),
  bark: () => ({ tex: P.bark(), scale: 1, rough: 1, bump: 1.5 }),
  leaves: () => ({ tex: P.leaves(), scale: 1.2, rough: 0.9, bump: 1.5 }),
  palm: () => ({ tex: P.leaves(), scale: 1, rough: 0.9, color: '#c8e08a' }),
  awning_red: () => ({ tex: P.awning('#b8322a', '#efe6d6'), scale: 2, rough: 0.9 }),
  awning_green: () => ({ tex: P.awning('#2f7a4a', '#efe6d6'), scale: 2, rough: 0.9 }),
  fruit: () => ({ tex: P.leaves(), scale: 0.5, rough: 0.6, color: '#ff9a40' }),
  sandbag: () => ({ tex: P.sandbag(), scale: 1.6, rough: 1, bump: 2 }),
  barrel_blue: () => ({ tex: P.metalCorr('#2a5aa8', false), scale: 1, rough: 0.5, metal: 0.4, bump: 1 }),
  barrel_red: () => ({ tex: P.metalCorr('#a8302a', false), scale: 1, rough: 0.5, metal: 0.4, bump: 1 }),
  dumpster: () => ({ tex: P.panels('#2f5a3a', 'rgba(0,0,0,0.5)', 2), scale: 2, rough: 0.6, metal: 0.4, bump: 1 }),
  barrier: () => ({ tex: P.awning('#d23a2a', '#e8e8e0'), scale: 2, rough: 0.7 }),
  car_red: () => ({ tex: P.paint('#b0202e', 6), scale: 4, rough: 0.25, metal: 0.6 }),
  car_blue: () => ({ tex: P.paint('#1f5aa8', 6), scale: 4, rough: 0.25, metal: 0.6 }),
  car_glass: () => ({ tex: P.paint('#10161e', 4), scale: 4, rough: 0.05, metal: 0.9 }),
  tire: () => ({ tex: P.paint('#121212', 8), scale: 1, rough: 0.9 }),
  headlight: () => ({ color: '#fff6d8', emissive: '#fff6d8', emissiveI: 1.5 }),
  taillight: () => ({ color: '#ff2a2a', emissive: '#ff2a2a', emissiveI: 1.2 }),
  rug: () => ({ tex: P.rug(), scale: 2.5, rough: 1, bump: 0.6 }),
  water: () => ({ tex: P.water(), scale: 3, rough: 0.05, metal: 0.3, transparent: 0.8 }),
  vending: () => ({ tex: P.vending(), scale: 1, fit: true, rough: 0.4, emissiveSelf: 0.6 }),
  lamp: () => ({ color: '#fff3c4', emissive: '#fff3c4', emissiveI: 2 }),
  neon_pink: () => ({ color: '#ff2bd6', emissive: '#ff2bd6', emissiveI: 3 }),
  neon_cyan: () => ({ color: '#22e5ff', emissive: '#22e5ff', emissiveI: 3 }),
  neon_orange: () => ({ color: '#ffb12b', emissive: '#ffb12b', emissiveI: 3 }),
  tiles: () => ({ tex: P.floorTile('#8a9098', '#6a7078'), scale: 2.5, rough: 0.5, bump: 1 }),
  dirt: () => ({ tex: P.dirt(), scale: 6, rough: 1, bump: 1.4 }),
  portacabin: () => ({ tex: P.metalCorr('#d8d4c8', false), scale: 3, rough: 0.6, metal: 0.2, bump: 1.5 }),
  portaloo: () => ({ tex: P.panels('#2a6fd1', 'rgba(0,0,0,0.4)', 2, false), scale: 1.3, rough: 0.5, bump: 1 }),
  mixer: () => ({ tex: P.awning('#e0e0e0', '#e86a1a'), scale: 1.6, rough: 0.4, metal: 0.3 }),
  jumppad: () => ({ tex: P.jumppad(), scale: 1.8, fit: true, rough: 0.3, emissiveSelf: 1.4 }),
  paint_white: () => ({ tex: P.paint('#ecebe4', 6), scale: 1, rough: 0.8 }),
  jet: () => ({ tex: P.panels('#8a939c', 'rgba(0,0,0,0.35)', 4, true), scale: 2, rough: 0.4, metal: 0.5, bump: 1 }),
  tank: () => ({ tex: P.panels('#5a6236', 'rgba(0,0,0,0.45)', 2, true), scale: 2, rough: 0.7, metal: 0.3, bump: 1.2 }),
  tent: () => ({ tex: P.metalCorr('#6a7046', false), scale: 2, rough: 1, bump: 1 }),
  fueltank: () => ({ tex: P.panels('#d8dcdc', 'rgba(0,0,0,0.3)', 2, true), scale: 3, rough: 0.4, metal: 0.4, bump: 1 }),
  bus: () => ({ tex: P.awning('#e8a81c', '#e8a81c'), scale: 3, rough: 0.4, metal: 0.3 }),
  pump: () => ({ tex: P.panels('#c42a2a', 'rgba(0,0,0,0.4)', 2, false), scale: 1.3, rough: 0.4, metal: 0.3 }),
  flag: () => ({ tex: P.awning('#2a4a8a', '#e8e8e0'), scale: 1, fit: true, rough: 0.9 }),
  // new-map materials
  rock: () => ({ tex: P.rock('#c08458', '#9a5e3a'), scale: 7, rough: 0.95, bump: 2.2 }),
  rock_dark: () => ({ tex: P.rock('#7a4e36', '#5a3826'), scale: 5, rough: 0.95, bump: 2 }),
  rock_grey: () => ({ tex: P.rock('#8d9096', '#6a6d72'), scale: 5, rough: 0.95, bump: 2 }),
  siding_white: () => ({ tex: P.siding('#e6e2d8'), scale: 2.4, rough: 0.8, bump: 1.4 }),
  siding_blue: () => ({ tex: P.siding('#7c9ab8'), scale: 2.4, rough: 0.8, bump: 1.4 }),
  siding_yellow: () => ({ tex: P.siding('#e2c77a'), scale: 2.4, rough: 0.8, bump: 1.4 }),
  siding_sage: () => ({ tex: P.siding('#9aae8c'), scale: 2.4, rough: 0.8, bump: 1.4 }),
  roof_red: () => ({ tex: P.roofTile('#a8442e', '#6e2a1c'), scale: 2.2, rough: 0.85, bump: 1.6 }),
  roof_slate: () => ({ tex: P.roofTile('#4c5560', '#2c3238'), scale: 2.2, rough: 0.8, bump: 1.6 }),
  hull_red: () => ({ tex: P.hull('#8a2a22'), scale: 6, rough: 0.6, metal: 0.3, bump: 1 }),
  hull_dark: () => ({ tex: P.hull('#26303a'), scale: 6, rough: 0.55, metal: 0.35, bump: 1 }),
  deck: () => ({ tex: P.deck(), scale: 2, rough: 0.6, metal: 0.4, bump: 1.2 }),
  pool_tile: () => ({ tex: P.floorTile('#5ab4d6', '#3a8cb0'), scale: 1.2, rough: 0.2, bump: 0.8 }),
  fence_white: () => ({ tex: P.paint('#ecebe4', 8), scale: 1, rough: 0.7 }),
  hedge: () => ({ tex: P.leaves(), scale: 1.4, rough: 0.95, bump: 1.6, color: '#7da862' }),
  rope: () => ({ tex: P.paint('#a88a5a', 20), scale: 1, rough: 1 }),
  billboard: () => ({ tex: P.billboard(), scale: 1, fit: true, rough: 0.5, emissiveSelf: 0.35 }),
  glass: () => ({ tex: P.paint('#8fb8cc', 6), scale: 2, rough: 0.05, metal: 0.6, transparent: 0.55 }),
};

// Average colours for minimaps / thumbnails
export const MAT_COLORS = {
  brick: '#a85a3c', brick_dark: '#5a443a', plaster_yellow: '#d2b26c', plaster_white: '#d8d2c6', plaster_dark: '#4a4258', concrete: '#8a8a86',
  concrete_dark: '#3c3f48', concrete_panel: '#9a9a94', panel_white: '#d8dde2', bunker: '#7b7f78', stone: '#a8a49c', metal: '#7c858f', metal_dark: '#2a2d33',
  metal_corr: '#6f7d84', metal_grate: '#4a4e54', mudbrick: '#b48a5a', sandstone: '#b98d5c', snowpile: '#e8eef5', ice: '#9fd3ef', wood: '#6e4a2c', crate: '#9a6b3c',
  container_red: '#9a2e22', container_blue: '#24527f', container_green: '#3e6b37', crane: '#e5b414', forklift: '#e0a81c', bark: '#4a3020', sandbag: '#968d62',
  barrel_blue: '#2a5aa8', barrel_red: '#a8302a', dumpster: '#2f5a3a', barrier: '#d23a2a', car_red: '#b0202e', car_blue: '#1f5aa8', car_glass: '#10161e',
  vending: '#c4202a', neon_pink: '#ff2bd6', neon_cyan: '#22e5ff', wall: '#111318',
  dirt: '#9a7a58', portacabin: '#d8d4c8', portaloo: '#2a6fd1', mixer: '#e86a1a', tire: '#121212',
  jumppad: '#22e5ff', jet: '#8a939c', tank: '#5a6236', tent: '#6a7046', fueltank: '#d8dcdc', bus: '#e8a81c', pump: '#c42a2a', paint_white: '#ecebe4',
  rock: '#a86c44', rock_dark: '#5e3c2a', rock_grey: '#7e8186', siding_white: '#e2ded4', siding_blue: '#7c9ab8', siding_yellow: '#e2c77a', siding_sage: '#9aae8c',
  roof_red: '#8e3a28', roof_slate: '#3e464f', hull_red: '#8a2a22', hull_dark: '#26303a', deck: '#6a6f72', pool_tile: '#4aa4c6', hedge: '#4e7a3a', fence_white: '#ecebe4',
  glass: '#8fb8cc', water: '#3a7a9a', grass: '#5a8a3a', sand: '#d8bc8a', asphalt: '#3a3c40', road: '#3a3c40',
};

const matCache = {};
export function getMaterial(name, theme) {
  if (name === 'wall') name = THEMES[theme]?.wall || 'concrete';
  if (matCache[name]) return matCache[name];
  const def = (MAT_DEFS[name] || MAT_DEFS.concrete)();
  const params = { roughness: def.rough ?? 0.8, metalness: def.metal ?? 0 };
  if (def.tex) {
    const t = def.tex.map ? def.tex : { map: def.tex };
    params.map = toTex(t.map);
    if (t.bump && def.bump) { params.bumpMap = toTex(t.bump, false); params.bumpScale = def.bump; }
    if (def.emissiveSelf) { params.emissiveMap = params.map; params.emissive = new THREE.Color('#ffffff'); params.emissiveIntensity = def.emissiveSelf; }
  }
  if (def.color) params.color = new THREE.Color(def.color);
  if (def.emissive) { params.emissive = new THREE.Color(def.emissive); params.emissiveIntensity = def.emissiveI || 1; }
  if (def.transparent) { params.transparent = true; params.opacity = def.transparent; }
  const mat = new THREE.MeshStandardMaterial(params);
  mat.userData.scale = def.scale || 3;
  mat.userData.fit = !!def.fit;
  mat.userData.shared = true;
  return (matCache[name] = mat);
}

// ---------------------------------------------------------------- weapon skins
export const WEAPON_SKINS = [
  { id: 'factory', name: 'Factory New', rarity: 'common', swatch: '#4a515b' },
  { id: 'woodland', name: 'Woodland', rarity: 'common', swatch: '#4b5a32' },
  { id: 'desert', name: 'Desert Storm', rarity: 'common', swatch: '#c2a875' },
  { id: 'arctic', name: 'Arctic Camo', rarity: 'rare', swatch: '#d7dde3' },
  { id: 'urban', name: 'Urban Digital', rarity: 'rare', swatch: 'repeating-linear-gradient(90deg, #5d636b 0 5px, #8b929b 5px 9px, #2f3338 9px 13px)' },
  { id: 'jungle', name: 'Jungle Stripe', rarity: 'rare', swatch: 'repeating-linear-gradient(60deg, #2f4a1f 0 6px, #11180c 6px 10px, #6c7a35 10px 14px)' },
  { id: 'crimson', name: 'Crimson Web', rarity: 'rare', swatch: '#8e1424' },
  { id: 'carbon', name: 'Carbon Fiber', rarity: 'rare', swatch: '#1b1d20' },
  { id: 'tiger', name: 'Tiger Tooth', rarity: 'epic', swatch: '#e2851d' },
  { id: 'neon', name: 'Neon Pulse', rarity: 'epic', swatch: '#14e1ff' },
  { id: 'hex', name: 'Hex Plate', rarity: 'epic', swatch: 'radial-gradient(circle, #3a4250 30%, #1b2028 31%)' },
  { id: 'cobalt', name: 'Cobalt Ripple', rarity: 'epic', swatch: 'linear-gradient(135deg, #0e2d6e, #2f7bff, #0e2d6e)' },
  { id: 'galaxy', name: 'Galaxy', rarity: 'legendary', swatch: '#5b2a9e' },
  { id: 'inferno', name: 'Inferno', rarity: 'legendary', swatch: '#ff4a12' },
  { id: 'gold', name: '24K Gold', rarity: 'legendary', swatch: '#f2c14e' },
  { id: 'dragon', name: 'Dragon Scale', rarity: 'epic', swatch: 'radial-gradient(circle at 50% 30%, #e0303a, #9c1620 60%, #3a0609)' },
  { id: 'aurora', name: 'Aurora', rarity: 'legendary', swatch: 'linear-gradient(180deg, #05101c 15%, #38ffb0 40%, #7a5cff 65%, #05101c 90%)' },
  { id: 'gift', name: "Logan's Gift", rarity: 'legendary', swatch: 'linear-gradient(90deg, #0d4a2c 42%, #f2c14e 42% 58%, #0d4a2c 58%)' },
  // Christmas Update: festive camos
  { id: 'xcandy', name: 'Candy Cane', rarity: 'festive', swatch: 'repeating-linear-gradient(45deg, #f6f2ea 0 6px, #d4142a 6px 11px)' },
  { id: 'xsweater', name: 'Ugly Sweater', rarity: 'festive', swatch: 'linear-gradient(180deg, #b3141f 30%, #f4efe4 30% 40%, #1d6b3a 40% 60%, #f4efe4 60% 70%, #b3141f 70%)' },
  { id: 'xwrap', name: 'Wrapping Paper', rarity: 'festive', swatch: 'radial-gradient(circle, #ffffff 15%, transparent 16%) 0 0/9px 9px, #c8102e' },
  { id: 'xginger', name: 'Gingerbread', rarity: 'festive', swatch: 'radial-gradient(circle at 50% 45%, #fff 18%, #a0612d 20%)' },
  { id: 'xfrost', name: 'Hoarfrost', rarity: 'festive', swatch: 'linear-gradient(135deg, #e9f6ff, #9fd2ff 50%, #e9f6ff)' },
  { id: 'xkrampus', name: 'Krampus', rarity: 'festive', swatch: 'linear-gradient(135deg, #120708 40%, #8c0f16 40% 50%, #120708 50%)' },
  { id: 'xnut', name: 'Nutcracker', rarity: 'festive', swatch: 'linear-gradient(180deg, #b0121c 40%, #e8c15a 40% 52%, #b0121c 52%)' },
  { id: 'xlights', name: 'Fairy Lights', rarity: 'festive', swatch: 'radial-gradient(circle at 25% 30%, #ff3b3b 10%, transparent 12%), radial-gradient(circle at 70% 40%, #3bff6a 10%, transparent 12%), radial-gradient(circle at 45% 75%, #ffd23b 10%, transparent 12%), #0c1a12' },
  { id: 'dev', name: 'Dev Circuit', rarity: 'dev', swatch: 'repeating-linear-gradient(90deg, #07140e 0 6px, #39ff9c 6px 8px)' },
  { id: 'glitch', name: 'Glitch', rarity: 'dev', swatch: 'linear-gradient(90deg, #0a0a0f 30%, #ff2a3a 30% 45%, #0a0a0f 45% 60%, #22e5ff 60% 75%, #0a0a0f 75%)' },
];
export const RARITY_COLORS = { common: '#9aa4b1', rare: '#4b8bff', epic: '#b45cff', legendary: '#ffb02e', festive: '#ff4d5e', dev: '#39ff9c' };

// ---------------------------------------------------------------- Christmas camos
const snowflake = (x, cx, cy, r, w = 1.5) => {
  x.lineWidth = w; x.lineCap = 'round'; x.beginPath();
  for (let k = 0; k < 6; k++) {
    const a = k / 6 * Math.PI * 2, ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r;
    x.moveTo(cx, cy); x.lineTo(ex, ey);
    for (const s of [-1, 1]) { const mx = cx + Math.cos(a) * r * 0.6, my = cy + Math.sin(a) * r * 0.6, b = a + s * 0.7; x.moveTo(mx, my); x.lineTo(mx + Math.cos(b) * r * 0.32, my + Math.sin(b) * r * 0.32); }
  }
  x.stroke();
};
function festiveSkin(id) {
  const rnd = mulberry32(id.length * 977 + id.charCodeAt(1));
  switch (id) {
    case 'xcandy': { // red and white peppermint stripes with a thin green pinstripe and a glossy finish
      const [c, x] = mkCanvas(256); x.fillStyle = '#f6f2ea'; x.fillRect(0, 0, 256, 256);
      x.save(); x.translate(128, 128); x.rotate(-Math.PI / 4); x.translate(-256, -256);
      for (let i = 0; i < 512; i += 48) { x.fillStyle = '#d4142a'; x.fillRect(i, 0, 22, 512); x.fillStyle = '#2f8a46'; x.fillRect(i + 30, 0, 4, 512); }
      x.restore();
      noise(x, 256, 5);
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.18, metalness: 0.05 });
    }
    case 'xsweater': { // knitted Christmas jumper: red/green/cream bands, snowflakes, reindeer row, zigzags, knit texture
      const [c, x] = mkCanvas(256);
      const band = (y, h, col) => { x.fillStyle = col; x.fillRect(0, y, 256, h); };
      band(0, 256, '#b3141f'); band(64, 64, '#1d6b3a'); band(176, 40, '#1d6b3a');
      band(58, 6, '#f4efe4'); band(128, 6, '#f4efe4'); band(170, 6, '#f4efe4'); band(216, 6, '#f4efe4');
      x.fillStyle = '#f4efe4';
      for (let i = 0; i < 256; i += 16) { x.beginPath(); x.moveTo(i, 140); x.lineTo(i + 8, 148); x.lineTo(i + 16, 140); x.lineTo(i + 16, 144); x.lineTo(i + 8, 152); x.lineTo(i, 144); x.fill(); } // zigzag
      x.strokeStyle = '#f4efe4'; for (let i = 0; i < 4; i++) snowflake(x, 32 + i * 64, 96, 18, 3);
      for (let i = 0; i < 8; i++) { const px = 16 + i * 32, py = 196; x.fillRect(px - 8, py - 3, 14, 6); x.fillRect(px + 4, py - 9, 5, 6); x.fillRect(px - 7, py + 3, 2, 7); x.fillRect(px + 3, py + 3, 2, 7); x.fillRect(px + 6, py - 13, 1, 4); x.fillRect(px + 8, py - 13, 1, 4); }
      for (let i = 0; i < 8; i++) { x.fillStyle = '#f4efe4'; x.fillRect(12 + i * 32, 24, 8, 8); x.fillStyle = '#1d6b3a'; x.fillRect(14 + i * 32, 26, 4, 4); }
      x.fillStyle = 'rgba(0,0,0,0.13)'; for (let yy = 0; yy < 256; yy += 4) for (let xx = (yy / 4) % 2 * 2; xx < 256; xx += 4) x.fillRect(xx, yy, 2, 3); // knit stitches
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.95, metalness: 0 });
    }
    case 'xwrap': { // glossy red wrapping paper with white snowflakes and gold dots
      const [c, x] = mkCanvas(256); x.fillStyle = '#c8102e'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = '#ffffff'; for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) snowflake(x, k * 52 + (r % 2) * 26 + 13, r * 52 + 13, 12, 2);
      x.fillStyle = '#f2c14e'; for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) { x.beginPath(); x.arc(k * 52 + (r % 2 ? 0 : 26) + 13, r * 52 + 39, 3, 0, 7); x.fill(); }
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.32, metalness: 0.15 });
    }
    case 'xginger': { // baked gingerbread with white icing squiggles, dots and gumdrop buttons
      const [c, x] = mkCanvas(256); x.fillStyle = '#a0612d'; x.fillRect(0, 0, 256, 256);
      blotches(x, 256, '#8a4f22', 40, 6, 22, 0.35); blotches(x, 256, '#b8743a', 30, 6, 18, 0.3);
      x.strokeStyle = '#fbf7ef'; x.lineWidth = 4; x.lineCap = 'round';
      for (let y = 20; y < 256; y += 64) { x.beginPath(); for (let px = 0; px <= 256; px += 4) x.lineTo(px, y + Math.sin(px / 10) * 6); x.stroke(); }
      const gum = ['#e3243b', '#2fae4e', '#f2c14e'];
      for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) { x.fillStyle = gum[(r + k) % 3]; x.beginPath(); x.arc(k * 44 + 20 + (r % 2) * 22, r * 64 + 52, 6, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.5)'; x.beginPath(); x.arc(k * 44 + 18 + (r % 2) * 22, r * 64 + 50, 2, 0, 7); x.fill(); }
      noise(x, 256, 10);
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.85, metalness: 0 });
    }
    case 'xfrost': { // icy blue-white metal with frost crystals growing across it
      const [c, x] = mkCanvas(256);
      const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#dff1ff'); g.addColorStop(0.5, '#8fc6f2'); g.addColorStop(1, '#e7f5ff');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(255,255,255,0.85)';
      const branch = (px, py, a, len, d) => { if (d > 4 || len < 3) return; const ex = px + Math.cos(a) * len, ey = py + Math.sin(a) * len; x.lineWidth = Math.max(0.6, 2.2 - d * 0.4); x.beginPath(); x.moveTo(px, py); x.lineTo(ex, ey); x.stroke(); branch(ex, ey, a + 0.5 + rnd() * 0.3, len * 0.62, d + 1); branch(ex, ey, a - 0.5 - rnd() * 0.3, len * 0.62, d + 1); branch(ex, ey, a, len * 0.7, d + 1); };
      for (let i = 0; i < 14; i++) branch(rnd() * 256, rnd() * 256, rnd() * 6.28, 16 + rnd() * 14, 0);
      for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`; x.fillRect(rnd() * 256, rnd() * 256, 1, 1); }
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.2, metalness: 0.6 });
    }
    case 'xkrampus': { // soot black with dark red claw marks and rusty chain links
      const [c, x] = mkCanvas(256); x.fillStyle = '#120708'; x.fillRect(0, 0, 256, 256);
      blotches(x, 256, '#2a0c0e', 30, 10, 40, 0.5);
      for (let i = 0; i < 5; i++) { const px = rnd() * 256, py = rnd() * 256; for (let k = 0; k < 3; k++) { x.strokeStyle = '#8c0f16'; x.lineWidth = 3; x.beginPath(); x.moveTo(px + k * 9, py); x.quadraticCurveTo(px + k * 9 + 10, py + 30, px + k * 9 + 4, py + 60); x.stroke(); } }
      x.strokeStyle = '#6b4a2a'; x.lineWidth = 3;
      for (let i = 0; i < 12; i++) { x.beginPath(); x.ellipse(i * 22 + 10, 128 + (i % 2 ? 0 : 0), i % 2 ? 4 : 10, i % 2 ? 10 : 5, 0, 0, 7); x.stroke(); }
      noise(x, 256, 10);
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.6, metalness: 0.35 });
    }
    case 'xnut': { // toy-soldier lacquer: gloss red with gold braid bands and buttons
      const [c, x] = mkCanvas(256); x.fillStyle = '#b0121c'; x.fillRect(0, 0, 256, 256);
      for (const y of [40, 168]) { x.fillStyle = '#e8c15a'; x.fillRect(0, y, 256, 18); x.fillStyle = '#b8902e'; for (let i = 0; i < 256; i += 8) { x.beginPath(); x.moveTo(i, y); x.lineTo(i + 4, y + 9); x.lineTo(i, y + 18); x.fill(); } }
      for (let i = 0; i < 6; i++) for (const y of [104, 230]) { x.fillStyle = '#f2d27a'; x.beginPath(); x.arc(20 + i * 44, y, 6, 0, 7); x.fill(); x.fillStyle = '#9c7a22'; x.beginPath(); x.arc(20 + i * 44, y, 2.5, 0, 7); x.fill(); }
      return new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.15, metalness: 0.25 });
    }
    case 'xlights': { // dark pine green wrapped in a wire of glowing fairy lights (they twinkle)
      const [c, x] = mkCanvas(256); const [e, ex] = mkCanvas(256);
      x.fillStyle = '#0c1a12'; x.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
      blotches(x, 256, '#173322', 30, 8, 30, 0.5);
      const cols = ['#ff3b3b', '#3bff6a', '#ffd23b', '#3bb8ff', '#ff5bd6'];
      for (let w = 0; w < 4; w++) {
        const y0 = 32 + w * 64; x.strokeStyle = '#101010'; x.lineWidth = 2; x.beginPath();
        for (let px = 0; px <= 256; px += 4) x.lineTo(px, y0 + Math.sin(px / 20 + w) * 12); x.stroke();
        for (let px = 8; px < 256; px += 21) {
          const py = y0 + Math.sin(px / 20 + w) * 12 + 5, col = cols[(px / 21 + w * 2 | 0) % cols.length];
          for (const ctx of [x, ex]) { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(px, py, 3.5, 5, 0, 0, 7); ctx.fill(); }
        }
      }
      const m = new THREE.MeshStandardMaterial({ map: toTex(c), emissiveMap: toTex(e), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6, roughness: 0.5, metalness: 0.15 });
      m.userData.pulse = true; return m;
    }
  }
  return null;
}

function camo(cols, size = 256, count = 70) {
  const [c, x] = mkCanvas(size); x.fillStyle = cols[0]; x.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    x.fillStyle = cols[1 + (i % (cols.length - 1))];
    x.beginPath();
    const cx = Math.random() * size, cy = Math.random() * size;
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2, r = 8 + Math.random() * 22;
      k ? x.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r) : x.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    x.fill();
  }
  noise(x, size, 12);
  return c;
}

const skinCache = {};
export function weaponSkinMaterial(id) {
  if (skinCache[id]) return skinCache[id];
  let m = festiveSkin(id);
  if (!m) switch (id) {
    case 'woodland': m = new THREE.MeshStandardMaterial({ map: toTex(camo(['#4b5a32', '#2e3a1f', '#6b5a3a', '#1c1f16'])), roughness: 0.75, metalness: 0.1 }); break;
    case 'arctic': m = new THREE.MeshStandardMaterial({ map: toTex(camo(['#e3e8ed', '#aeb8c2', '#7b8794', '#ffffff'])), roughness: 0.7, metalness: 0.1 }); break;
    case 'crimson': {
      const [c, x] = mkCanvas(256); x.fillStyle = '#7a0f1c'; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(10,0,0,0.8)'; x.lineWidth = 2;
      for (let r = 20; r < 380; r += 26) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); }
      for (let a = 0; a < 12; a++) { x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.cos(a / 12 * 6.283) * 400, 128 + Math.sin(a / 12 * 6.283) * 400); x.stroke(); }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.35, metalness: 0.3 }); break;
    }
    case 'carbon': {
      const [c, x] = mkCanvas(128); x.fillStyle = '#121315'; x.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { x.fillStyle = (i + j) % 2 ? '#26292d' : '#17181b'; x.fillRect(i * 8, j * 8, 8, 4); x.fillStyle = (i + j) % 2 ? '#17181b' : '#26292d'; x.fillRect(i * 8, j * 8 + 4, 8, 4); }
      const t = toTex(c); t.repeat.set(4, 4);
      m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.3, metalness: 0.5 }); break;
    }
    case 'tiger': {
      const [c, x] = mkCanvas(256); x.fillStyle = '#e8891d'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#1a0f05';
      for (let i = 0; i < 18; i++) { const y = Math.random() * 256; x.beginPath(); x.moveTo(0, y); x.quadraticCurveTo(128, y + Math.random() * 40 - 20, 256, y + 10); x.lineTo(256, y + 14 + Math.random() * 8); x.quadraticCurveTo(128, y + 18, 0, y + 6); x.fill(); }
      noise(x, 256, 10);
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.3, metalness: 0.5 }); break;
    }
    case 'neon': {
      const [c, x] = mkCanvas(256); const [e, ex] = mkCanvas(256);
      x.fillStyle = '#0c0f18'; x.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
      for (const ctx of [x, ex]) { ctx.strokeStyle = '#14e1ff'; ctx.lineWidth = 3; for (let i = 0; i <= 256; i += 32) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke(); } ctx.strokeStyle = '#ff2bd6'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(256, 256); ctx.stroke(); }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), emissiveMap: toTex(e), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.4 });
      m.userData.pulse = true; break;
    }
    case 'galaxy': {
      const [c, x] = mkCanvas(256);
      const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#1a0a3a'); g.addColorStop(0.5, '#4a1c86'); g.addColorStop(1, '#0d2a6a');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      blotches(x, 256, '#ff4fd8', 18, 20, 60, 0.25); blotches(x, 256, '#3fd0ff', 18, 20, 60, 0.2);
      for (let i = 0; i < 220; i++) { x.fillStyle = `rgba(255,255,255,${Math.random()})`; x.fillRect(Math.random() * 256, Math.random() * 256, Math.random() < 0.9 ? 1 : 2, Math.random() < 0.9 ? 1 : 2); }
      const t = toTex(c);
      m = new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.5 }); break;
    }
    case 'inferno': {
      const [c, x] = mkCanvas(256); const [e, ex] = mkCanvas(256);
      x.fillStyle = '#140504'; x.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 9; r++) for (let k = 0; k < 9; k++) {
        const cx = k * 32 + (r % 2) * 16, cy = r * 30;
        for (const [ctx, col] of [[x, '#ff4a12'], [ex, '#ff6a12']]) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); for (let s = 0; s < 6; s++) { const a = s / 6 * 6.283 + 0.5; const px = cx + Math.cos(a) * 15, py = cy + Math.sin(a) * 15; s ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.closePath(); ctx.stroke(); }
      }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), emissiveMap: toTex(e), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.5 });
      m.userData.pulse = true; break;
    }
    case 'gold': m = new THREE.MeshStandardMaterial({ color: '#f2c14e', roughness: 0.18, metalness: 1.0 }); break;
    case 'dragon': { // red overlapping scales with dark edges and a gold sheen
      const [c, x] = mkCanvas(256); x.fillStyle = '#5a0c12'; x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 14; r++) for (let k = -1; k < 11; k++) {
        const cx = k * 26 + (r % 2) * 13, cy = r * 20;
        const g = x.createRadialGradient(cx, cy - 6, 2, cx, cy, 18); g.addColorStop(0, '#e0303a'); g.addColorStop(0.7, '#9c1620'); g.addColorStop(1, '#3a0609');
        x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 15, 0, Math.PI); x.lineTo(cx - 15, cy - 4); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(242,193,78,0.55)'; x.lineWidth = 1.2; x.beginPath(); x.arc(cx, cy, 15, 0.15, Math.PI - 0.15); x.stroke();
      }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.32, metalness: 0.55 }); break;
    }
    case 'aurora': { // night sky with glowing green/violet bands
      const [c, x] = mkCanvas(256); const [e, ex] = mkCanvas(256);
      x.fillStyle = '#05101c'; x.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
      for (const [col, y0, amp] of [['#38ffb0', 90, 30], ['#7a5cff', 150, 24], ['#2fd4ff', 200, 18]]) for (const ctx of [x, ex]) {
        const g = ctx.createLinearGradient(0, y0 - 40, 0, y0 + 40); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, y0 + 40);
        for (let px = 0; px <= 256; px += 16) ctx.lineTo(px, y0 + Math.sin(px / 40 + y0) * amp - 30);
        ctx.lineTo(256, y0 + 40); ctx.closePath(); ctx.fill();
      }
      for (let i = 0; i < 120; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.9})`; x.fillRect(Math.random() * 256, Math.random() * 256, 1, 1); }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), emissiveMap: toTex(e), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.4 });
      m.userData.pulse = true; break;
    }
    case 'gift': { // Logan's Gift: deep green wrapping paper, gold ribbons and little stars
      const [c, x] = mkCanvas(256); x.fillStyle = '#0d4a2c'; x.fillRect(0, 0, 256, 256);
      x.fillStyle = '#0a3a22'; for (let i = -256; i < 256; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 12, 0); x.lineTo(i + 268, 256); x.lineTo(i + 256, 256); x.fill(); }
      x.fillStyle = '#f2c14e'; x.fillRect(112, 0, 32, 256); x.fillRect(0, 112, 256, 32);
      x.fillStyle = '#c99a2e'; x.fillRect(112, 0, 4, 256); x.fillRect(140, 0, 4, 256); x.fillRect(0, 112, 256, 4); x.fillRect(0, 140, 256, 4);
      const star = (sx, sy, r) => { x.beginPath(); for (let s = 0; s < 10; s++) { const a = s / 10 * 6.283 - 1.571, rr = s % 2 ? r * 0.45 : r; s ? x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr) : x.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.closePath(); x.fill(); };
      x.fillStyle = '#ffe9a8'; const rnd = mulberry32(7);
      for (let i = 0; i < 26; i++) { const sx = rnd() * 256, sy = rnd() * 256; if (Math.abs(sx - 128) > 26 && Math.abs(sy - 128) > 26) star(sx, sy, 4 + rnd() * 4); }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.4, metalness: 0.35 }); break;
    }
    case 'desert': m = new THREE.MeshStandardMaterial({ map: toTex(camo(['#c8b07e', '#a88c5a', '#e2d2a6', '#7d6a45'], 256, 55)), roughness: 0.78, metalness: 0.08 }); break;
    case 'urban': { // blocky digital pixels
      const [c, x] = mkCanvas(128); x.fillStyle = '#6b727b'; x.fillRect(0, 0, 128, 128);
      const rnd = mulberry32(11), cols = ['#3a3f46', '#8d949d', '#262a2f', '#a7aeb6'];
      for (let i = 0; i < 260; i++) { x.fillStyle = cols[i % 4]; const px = Math.floor(rnd() * 32) * 4, py = Math.floor(rnd() * 32) * 4; x.fillRect(px, py, 4 * (1 + Math.floor(rnd() * 3)), 4 * (1 + Math.floor(rnd() * 2))); }
      const t = toTex(c); t.magFilter = THREE.NearestFilter; t.repeat.set(2, 2);
      m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.12 }); break;
    }
    case 'jungle': { // diagonal brush stripes
      const [c, x] = mkCanvas(256); x.fillStyle = '#4c6a2c'; x.fillRect(0, 0, 256, 256);
      for (let i = -8; i < 24; i++) { x.fillStyle = ['#1a2410', '#7b8a3e', '#2f4a1f'][i & 1 ? 0 : (i % 3 ? 1 : 2)]; x.beginPath(); const o = i * 22 + Math.random() * 8; x.moveTo(o, 0); x.lineTo(o + 10 + Math.random() * 10, 0); x.lineTo(o + 140, 256); x.lineTo(o + 128, 256); x.fill(); }
      noise(x, 256, 14);
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.75, metalness: 0.1 }); break;
    }
    case 'hex': { // hexagon armour plates with bright edges
      const [c, x] = mkCanvas(256); x.fillStyle = '#20252d'; x.fillRect(0, 0, 256, 256);
      for (let r = 0; r < 10; r++) for (let k = 0; k < 10; k++) {
        const cx = k * 28 + (r % 2) * 14, cy = r * 25;
        x.beginPath(); for (let s = 0; s < 6; s++) { const a = s / 6 * 6.283 + 0.52; s ? x.lineTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13) : x.moveTo(cx + Math.cos(a) * 13, cy + Math.sin(a) * 13); }
        x.closePath(); x.fillStyle = (r * 7 + k * 3) % 5 ? '#353d49' : '#4a5463'; x.fill(); x.strokeStyle = '#11151a'; x.lineWidth = 2; x.stroke();
      }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.35, metalness: 0.6 }); break;
    }
    case 'cobalt': { // blue anodised ripples
      const [c, x] = mkCanvas(256);
      const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, '#0d2a66'); g.addColorStop(0.5, '#2e6fe6'); g.addColorStop(1, '#0d2a66');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
      x.strokeStyle = 'rgba(160,210,255,0.35)'; x.lineWidth = 2;
      for (let r = 8; r < 380; r += 14) { x.beginPath(); x.arc(40, 60, r, 0, 7); x.stroke(); }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), roughness: 0.22, metalness: 0.75 }); break;
    }
    case 'dev': { // circuit board: glowing green traces with gold pads
      const [c, x] = mkCanvas(256); const [e, ex] = mkCanvas(256);
      x.fillStyle = '#07140e'; x.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
      noise(x, 256, 8);
      const rnd = mulberry32(7);
      for (let i = 0; i < 46; i++) {
        let px = Math.floor(rnd() * 16) * 16 + 8, py = Math.floor(rnd() * 16) * 16 + 8;
        for (const ctx of [x, ex]) { ctx.strokeStyle = '#39ff9c'; ctx.lineWidth = 2; }
        x.beginPath(); ex.beginPath(); x.moveTo(px, py); ex.moveTo(px, py);
        for (let s = 0; s < 4; s++) {
          if (rnd() < 0.5) px += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 3)); else py += (rnd() < 0.5 ? -1 : 1) * 16 * (1 + Math.floor(rnd() * 3));
          x.lineTo(px, py); ex.lineTo(px, py);
        }
        x.stroke(); ex.stroke();
        x.fillStyle = '#d9a636'; x.fillRect(px - 3, py - 3, 6, 6); ex.fillStyle = '#1a5a3a'; ex.fillRect(px - 3, py - 3, 6, 6);
      }
      for (let i = 0; i < 6; i++) { const cx = Math.floor(rnd() * 12) * 20 + 10, cy = Math.floor(rnd() * 12) * 20 + 10; x.fillStyle = '#111'; x.fillRect(cx, cy, 22, 14); x.fillStyle = '#888'; for (let k = 0; k < 4; k++) { x.fillRect(cx + 2 + k * 5, cy - 2, 2, 2); x.fillRect(cx + 2 + k * 5, cy + 14, 2, 2); } }
      m = new THREE.MeshStandardMaterial({ map: toTex(c), emissiveMap: toTex(e), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.45 });
      m.userData.pulse = true; break;
    }
    case 'glitch': { // dark base with RGB-split glitch blocks and scanlines
      const [c, x] = mkCanvas(256); const [e, ex] = mkCanvas(256);
      x.fillStyle = '#0a0a0f'; x.fillRect(0, 0, 256, 256); ex.fillStyle = '#000'; ex.fillRect(0, 0, 256, 256);
      const rnd = mulberry32(42);
      for (let i = 0; i < 38; i++) {
        const y = Math.floor(rnd() * 64) * 4, w = 12 + rnd() * 90, h = 2 + Math.floor(rnd() * 4) * 2, px = rnd() * 256;
        const col = ['#ff2a3a', '#22e5ff', '#f4f4f8'][i % 3];
        for (const ctx of [x, ex]) { ctx.fillStyle = col; ctx.fillRect(px, y, w, h); ctx.fillRect(px - 256, y, w, h); }
      }
      x.fillStyle = 'rgba(255,255,255,0.05)'; for (let y = 0; y < 256; y += 3) x.fillRect(0, y, 256, 1);
      m = new THREE.MeshStandardMaterial({ map: toTex(c), emissiveMap: toTex(e), emissive: new THREE.Color('#ffffff'), emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.5 });
      m.userData.pulse = true; break;
    }
    default: m = new THREE.MeshStandardMaterial({ color: '#4a515b', roughness: 0.4, metalness: 0.65 });
  }
  m.userData.shared = true;
  return (skinCache[id] = m);
}

// ---------------------------------------------------------------- character skins
export const CHAR_SKINS = [
  { id: 'ranger', name: 'Ranger', body: '#4f5d3a', accent: '#2f3826', helmet: '#3f4a2e', visor: '#1a1a1a', glow: false, rarity: 'common' },
  { id: 'desert', name: 'Sandstorm', body: '#b49a6c', accent: '#7a6340', helmet: '#9c8357', visor: '#2a1a0a', glow: false, rarity: 'common' },
  { id: 'cobalt', name: 'Cobalt', body: '#2d4f8a', accent: '#1a2a4a', helmet: '#1f3864', visor: '#58c7ff', glow: true, rarity: 'rare' },
  { id: 'crimson', name: 'Crimson Ops', body: '#7a1c22', accent: '#2a0c0e', helmet: '#5a1418', visor: '#ff9a3a', glow: true, rarity: 'rare' },
  { id: 'ghost', name: 'Ghost', body: '#c8ced6', accent: '#7c8794', helmet: '#e8ecf0', visor: '#45e0ff', glow: true, rarity: 'epic' },
  { id: 'toxic', name: 'Toxic', body: '#1e2421', accent: '#0e110f', helmet: '#252b27', visor: '#7dff3a', glow: true, rarity: 'epic' },
  { id: 'shadow', name: 'Shadow', body: '#121216', accent: '#050507', helmet: '#18181d', visor: '#ff1a3a', glow: true, rarity: 'legendary' },
  { id: 'dragonheart', name: 'Dragonheart', body: '#8a1620', accent: '#d9a636', helmet: '#5e0e15', visor: '#ffcf4a', glow: true, rarity: 'legendary' },
  { id: 'royal', name: 'Royal Guard', body: '#4a2470', accent: '#d9a636', helmet: '#3a1a5a', visor: '#ffd36a', glow: true, rarity: 'legendary' },
  { id: 'dev', name: 'Developer', body: '#101615', accent: '#1f5a40', helmet: '#0b100f', visor: '#39ff9c', glow: true, rarity: 'dev' },
  { id: 'devgold', name: 'Dev Prestige', body: '#ece8de', accent: '#d9a636', helmet: '#f6f3ec', visor: '#39ff9c', glow: true, rarity: 'dev' },
];
export function charSkin(id) { return CHAR_SKINS.find(s => s.id === id) || CHAR_SKINS[0]; }

// ---------------------------------------------------------------- fx textures
export function radialSprite(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,140,30,0)') {
  const [c, x] = mkCanvas(64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, inner); g.addColorStop(0.3, inner.replace(/[\d.]+\)$/, '0.8)')); g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function flashSprite() {
  const [c, x] = mkCanvas(128);
  x.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    x.rotate(Math.PI * 2 / 7);
    const g = x.createLinearGradient(0, 0, 0, -60); g.addColorStop(0, 'rgba(255,250,220,1)'); g.addColorStop(1, 'rgba(255,150,40,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(-7, 0); x.lineTo(0, -40 - Math.random() * 22); x.lineTo(7, 0); x.fill();
  }
  const g = x.createRadialGradient(0, 0, 0, 0, 0, 26); g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(1, 'rgba(255,170,60,0)');
  x.fillStyle = g; x.beginPath(); x.arc(0, 0, 26, 0, 7); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export function decalTexture() {
  const [c, x] = mkCanvas(64);
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.35, 'rgba(20,20,20,0.8)'); g.addColorStop(0.6, 'rgba(40,40,40,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
export function nameTagTexture(name, color = '#ff5a5a', dev = false) {
  const [c, x] = mkCanvas(256); c.height = 64;
  x.font = 'bold 30px Rajdhani, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = 6; x.strokeStyle = 'rgba(0,0,0,0.8)';
  let cx = 128;
  if (dev) { // developer: glowing gold crown in front of the name
    const crown = '♛', cw = 30, nw = Math.min(200, x.measureText(name).width), gap = 6;
    const left = 128 - (cw + gap + nw) / 2;
    x.font = 'bold 32px "Segoe UI Symbol", Arial';
    x.shadowColor = 'rgba(255,200,40,0.9)'; x.shadowBlur = 10;
    const g = x.createLinearGradient(0, 14, 0, 48); g.addColorStop(0, '#fff2a8'); g.addColorStop(0.5, '#ffc936'); g.addColorStop(1, '#d88a00');
    x.fillStyle = g; x.fillText(crown, left + cw / 2, 31);
    x.shadowBlur = 0; x.font = 'bold 30px Rajdhani, Arial';
    cx = left + cw + gap + nw / 2;
  }
  x.strokeText(name, cx, 32, 200);
  x.fillStyle = color; x.fillText(name, cx, 32, 200);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
