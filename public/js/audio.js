// Synthesised sound effects (no audio files needed).
let ctx = null, master = null, noiseBuf = null;

export function initAudio(volume = 0.6) {
  if (ctx) { ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  master.connect(comp); comp.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function setVolume(v) { if (master) master.gain.value = v; }

function out(vol, pan) {
  const g = ctx.createGain(); g.gain.value = vol;
  if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(master); }
  else g.connect(master);
  return g;
}
function noiseBurst(dest, t, dur, freq, type = 'lowpass', q = 0.7, peak = 1) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
}
function tone(dest, t, dur, f0, f1, type = 'sine', peak = 1) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}

// snd: { f: filter freq, d: duration, b: body thump freq, v: volume }
export function shot(snd, vol = 1, pan = 0, distant = false) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = out(snd.v * vol, pan);
  const f = distant ? snd.f * 0.4 : snd.f;
  noiseBurst(o, t, snd.d, f, 'lowpass', 0.8, 1);
  noiseBurst(o, t, 0.03, 6000, 'highpass', 0.5, distant ? 0.1 : 0.5);
  if (snd.b) tone(o, t, snd.d * 0.7, snd.b * 1.6, snd.b * 0.5, 'sine', 0.9);
  if (!distant && snd.d > 0.3) noiseBurst(o, t + 0.04, snd.d * 1.6, 500, 'lowpass', 0.5, 0.25); // tail
}
export function swish() { if (!ctx) return; const t = ctx.currentTime; noiseBurst(out(0.35), t, 0.15, 2500, 'bandpass', 1.5, 1); }
export function click() { if (!ctx) return; const t = ctx.currentTime; tone(out(0.3), t, 0.03, 2200, 1500, 'square', 0.4); }
export function reload(dur) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.4);
  tone(o, t + 0.1, 0.05, 900, 500, 'square', 0.3); noiseBurst(o, t + 0.1, 0.06, 3000, 'bandpass', 2, 0.6);
  tone(o, t + dur * 0.55, 0.05, 700, 400, 'square', 0.3); noiseBurst(o, t + dur * 0.55, 0.08, 2500, 'bandpass', 2, 0.7);
  tone(o, t + dur * 0.9, 0.04, 1400, 900, 'square', 0.35); noiseBurst(o, t + dur * 0.9, 0.05, 4000, 'bandpass', 2, 0.6);
}
export function hit(head) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.35);
  if (head) { tone(o, t, 0.12, 2600, 2400, 'sine', 0.8); tone(o, t, 0.18, 3900, 3700, 'sine', 0.4); }
  else tone(o, t, 0.05, 1500, 1200, 'triangle', 0.7);
}
export function killConfirm() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.4);
  tone(o, t, 0.1, 880, 880, 'triangle', 0.7); tone(o, t + 0.09, 0.2, 1320, 1320, 'triangle', 0.7);
}
export function hurt() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.5); noiseBurst(o, t, 0.15, 400, 'lowpass', 1, 1); tone(o, t, 0.12, 160, 80, 'sine', 0.8); }
export function step(vol = 0.15, snow = false) { if (!ctx) return; const t = ctx.currentTime; noiseBurst(out(vol), t, 0.07, snow ? 1400 : 700, 'lowpass', 1, 1); }
export function land() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.3); noiseBurst(o, t, 0.12, 500, 'lowpass', 1, 1); tone(o, t, 0.1, 120, 60, 'sine', 0.5); }
export function boom(vol = 1, pan = 0) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(1.2 * vol, pan);
  noiseBurst(o, t, 1.4, 700, 'lowpass', 0.7, 1);
  noiseBurst(o, t, 0.25, 3000, 'lowpass', 0.5, 0.6);
  tone(o, t, 0.8, 90, 30, 'sine', 1);
}
export function slide() { if (!ctx) return; const t = ctx.currentTime; noiseBurst(out(0.35), t, 0.7, 900, 'bandpass', 0.8, 1); }
export function jet() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.6);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.2); f.frequency.exponentialRampToValueAtTime(400, t + 2.4);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.1); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
  src.connect(f); f.connect(g); g.connect(o); src.start(t); src.stop(t + 2.6);
}
export function flame(vol = 1, pan = 0) { if (!ctx) return; const t = ctx.currentTime; const o = out(0.32 * vol, pan); noiseBurst(o, t, 0.14, 420, 'lowpass', 0.5, 1); noiseBurst(o, t, 0.1, 1800, 'bandpass', 0.6, 0.35); }
export function flashbang() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.5); noiseBurst(o, t, 0.25, 3000, 'highpass', 0.7, 1); tone(o, t + 0.05, 2.8, 3900, 3700, 'sine', 0.18); }
export function uiBlip() { if (!ctx) return; const t = ctx.currentTime; tone(out(0.2), t, 0.06, 1200, 1600, 'sine', 0.6); }
export function announce() { if (!ctx) return; const t = ctx.currentTime, o = out(0.35); tone(o, t, 0.15, 520, 520, 'sawtooth', 0.25); tone(o, t + 0.12, 0.15, 780, 780, 'sawtooth', 0.25); tone(o, t + 0.24, 0.35, 1040, 1040, 'sawtooth', 0.25); }
// radio squelch before an announcer line
export function radio() { if (!ctx) return; const t = ctx.currentTime, o = out(0.18); noiseBurst(o, t, 0.09, 2400, 'bandpass', 2, 0.9); tone(o, t + 0.02, 0.05, 1800, 1400, 'square', 0.25); }
// reload sounds: mag out / mag in / bolt / shell
export function reloadSfx(kind) {
  if (!ctx) return; const t = ctx.currentTime, o = out(0.32);
  if (kind === 'out') { noiseBurst(o, t, 0.06, 1800, 'bandpass', 3, 0.8); tone(o, t, 0.05, 700, 400, 'triangle', 0.4); }
  else if (kind === 'in') { noiseBurst(o, t, 0.05, 2600, 'bandpass', 4, 1); tone(o, t + 0.01, 0.06, 420, 260, 'square', 0.35); }
  else if (kind === 'bolt') { noiseBurst(o, t, 0.08, 3200, 'highpass', 1, 0.9); noiseBurst(o, t + 0.09, 0.07, 2200, 'bandpass', 3, 0.9); }
  else if (kind === 'shell') { tone(o, t, 0.05, 900, 500, 'triangle', 0.35); noiseBurst(o, t, 0.04, 3000, 'bandpass', 3, 0.6); }
  else if (kind === 'ping') { tone(o, t, 0.5, 2900, 2700, 'sine', 0.5); tone(o, t, 0.35, 5800, 5400, 'sine', 0.2); }
  else if (kind === 'pin') { tone(o, t, 0.04, 3800, 3000, 'sine', 0.35); noiseBurst(o, t + 0.03, 0.05, 5000, 'highpass', 1, 0.5); }
}
