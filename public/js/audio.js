// Synthesised sound effects (no audio files needed).
// Gunshots are built in layers like a real recording: a sharp supersonic crack, the muzzle blast (distorted
// noise), a low chest thump, the action cycling, and the report echoing off the surroundings (a generated
// reverb + slapback delay). Distant shots lose their highs and are mostly echo.
let ctx = null, master = null, noiseBuf = null, verb = null, slap = null, drive = null, deaf = null, probe = null, probeBuf = null, watchdog = 0;
// Voice limit: every gunshot is ~20 audio nodes, so a firefight with bots spraying SMGs could pile up hundreds at
// once, overload the audio thread (crackling, sound cutting in and out) and cost frame rate. Each sound takes a
// voice for as long as it rings; far-away and quiet sounds are skipped once the mix is busy, your own never are.
let voices = [];
function voice(dur, important) {
  const now = ctx.currentTime;
  if (voices.length > 20) voices = voices.filter(e => e > now);
  if (voices.length >= (important ? 70 : 34)) return false;
  voices.push(now + dur);
  return true;
}
const fin = (v, d = 0) => (Number.isFinite(v) ? v : d);

export function initAudio(volume = 0.6) {
  if (ctx) { if (ctx.state !== 'running') ctx.resume().catch(() => {}); return; }
  // 'balanced' gives the audio thread a slightly bigger buffer, so a busy moment doesn't make it drop out
  try { ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'balanced' }); } catch { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  voices = [];
  master = ctx.createGain();
  master.gain.value = volume;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.18;
  deaf = ctx.createBiquadFilter(); deaf.type = 'lowpass'; deaf.frequency.value = 22000; deaf.Q.value = 0.5; // muffles everything while stunned
  master.connect(deaf); deaf.connect(comp); comp.connect(ctx.destination); comp_ = comp;
  probe = ctx.createAnalyser(); probe.fftSize = 256; probeBuf = new Float32Array(256); comp.connect(probe);
  ctx.onstatechange = () => { if (ctx && ctx.state !== 'running' && ctx.state !== 'closed' && document.visibilityState === 'visible') ctx.resume().catch(() => {}); };
  // Watchdog: Windows can suspend the audio device (headset plugged in, another app grabbing it), and one bad sample
  // (NaN) reaching the compressor silences it for good. Either way: get it running again / rebuild the sound chain.
  if (!watchdog) watchdog = setInterval(() => {
    if (!ctx) return;
    if (ctx.state !== 'running' && ctx.state !== 'closed' && document.visibilityState === 'visible') { ctx.resume().catch(() => {}); return; }
    try { probe.getFloatTimeDomainData(probeBuf); } catch { return; }
    for (let i = 0; i < probeBuf.length; i++) if (!Number.isFinite(probeBuf[i])) { rebuild(); return; }
  }, 1000);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // reverb: stereo decaying noise with a few early reflections (an urban street / courtyard)
  verb = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const b = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) { const t = i / ctx.sampleRate; b[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * (t < 0.012 ? t / 0.012 : 1) * 0.6; }
    for (const [t, a] of [[0.021, 0.5], [0.037, 0.35], [0.058, 0.3], [0.083, 0.22]]) { const i = Math.floor((t + ch * 0.004) * ctx.sampleRate); for (let k = 0; k < 40; k++) b[i + k] += (Math.random() * 2 - 1) * a * (1 - k / 40); }
  }
  verb.buffer = ir;
  const verbOut = ctx.createGain(); verbOut.gain.value = 0.55;
  const verbLp = ctx.createBiquadFilter(); verbLp.type = 'lowpass'; verbLp.frequency.value = 4200;
  verb.connect(verbLp); verbLp.connect(verbOut); verbOut.connect(master);
  // slapback echo off buildings
  slap = ctx.createDelay(1); slap.delayTime.value = 0.16;
  const slapG = ctx.createGain(); slapG.gain.value = 0.22;
  const slapLp = ctx.createBiquadFilter(); slapLp.type = 'lowpass'; slapLp.frequency.value = 1600;
  slap.connect(slapLp); slapLp.connect(slapG); slapG.connect(master); slapG.connect(verb);
  // soft clipper for the muzzle blast (gives the "punch" instead of a clean hiss)
  drive = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; drive[i] = Math.tanh(x * 3.2) / Math.tanh(3.2); }
}
function rebuild() {
  const v = master ? master.gain.value : 0.6, old = ctx;
  ctx = null; try { old.close(); } catch {}
  initAudio(v);
}
export function setVolume(v) { if (master) master.gain.value = fin(v, 0.6); }
// stun grenade: the world goes muffled with a ringing in the ears, then slowly comes back
export function deafen(sec = 3, amount = 1) {
  if (!ctx) return; const t = ctx.currentTime, f = deaf.frequency;
  f.cancelScheduledValues(t); f.setValueAtTime(Math.min(f.value, 22000), t);
  f.exponentialRampToValueAtTime(Math.max(260, 2400 * (1 - amount)), t + 0.05);
  f.setValueAtTime(Math.max(260, 2400 * (1 - amount)), t + sec * 0.55);
  f.exponentialRampToValueAtTime(22000, t + sec);
  const o = ctx.createGain(); o.gain.setValueAtTime(0.0001, t); o.gain.exponentialRampToValueAtTime(0.09 * amount, t + 0.08); o.gain.exponentialRampToValueAtTime(0.0001, t + sec);
  o.connect(comp_ || ctx.destination);
  const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 3300; osc.connect(o); osc.start(t); osc.stop(t + sec + 0.05);
}
let comp_ = null;
// arc cannon charging: a rising capacitor whine (dur seconds)
export function charge(dur = 0.5) {
  if (!ctx) return; const t = ctx.currentTime, o = out(0.3, 0, 0.05);
  tone(o, t, dur, 220, 1900, 'sawtooth', 0.22); tone(o, t, dur, 440, 3800, 'sine', 0.18);
  noiseBurst(o, t, dur, 4000, 'bandpass', 4, 0.18);
}

// output bus: dry level, stereo pan, how much goes into the echo/reverb
function out(vol, pan, wet = 0) {
  vol = fin(vol); pan = fin(pan);
  const g = ctx.createGain(); g.gain.value = vol;
  let tail = g;
  if (pan) { const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); tail = p; }
  tail.connect(master);
  if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; tail.connect(w); w.connect(verb); w.connect(slap); }
  return g;
}
function noiseBurst(dest, t, dur, freq, type = 'lowpass', q = 0.7, peak = 1, attack = 0) {
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  if (attack) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); }
  else g.gain.setValueAtTime(peak, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + attack + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t, Math.random() * 1.5); src.stop(t + attack + dur + 0.05);
  return f;
}
function tone(dest, t, dur, f0, f1, type = 'sine', peak = 1) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function shaped(dest, amount = 1) {
  const s = ctx.createWaveShaper(); s.curve = drive; s.oversample = '2x';
  const pre = ctx.createGain(); pre.gain.value = amount; pre.connect(s); s.connect(dest);
  return pre;
}
// metal-on-metal: a noise click through a narrow resonance plus two inharmonic partials that ring briefly
function clank(dest, t, freq, peak = 1, ring = 0.05) {
  noiseBurst(dest, t, 0.025, freq, 'bandpass', 6, peak);
  noiseBurst(dest, t, 0.012, 7000, 'highpass', 1, peak * 0.4);
  tone(dest, t, ring, freq * 1.0, freq * 0.98, 'triangle', peak * 0.12);
  tone(dest, t, ring * 0.7, freq * 2.76, freq * 2.7, 'sine', peak * 0.06);
}

// snd: { f: filter freq (brightness), d: duration (bigger = heavier gun), b: body thump freq, v: volume }
export function shot(snd, vol = 1, pan = 0, distant = false) {
  if (!ctx) return;
  vol = fin(vol); if (vol <= 0.001) return;
  if (!voice(distant ? 0.6 : 0.25 + (snd.d || 0.2) * 3, !distant && vol >= 0.4 && !pan)) return;
  if (snd.laser) return laser(snd, vol, pan);
  if (snd.foam) return foam(snd, vol, pan);
  const t = ctx.currentTime;
  const heavy = Math.min(1, Math.max(0, (snd.d - 0.1) / 0.5));             // 0 = SMG/pistol, 1 = sniper/shotgun
  const o = out(snd.v * vol * 0.9, pan, distant ? 0.9 : 0.32 + heavy * 0.2);
  if (distant) {
    // far away: a dull boom and rolling echo, no crack
    noiseBurst(o, t, snd.d * 1.4, Math.min(900, snd.f * 0.35), 'lowpass', 0.6, 0.9, 0.004);
    if (snd.b) tone(o, t, snd.d, snd.b * 1.2, snd.b * 0.5, 'sine', 0.6);
    return;
  }
  const blast = shaped(o, 2.2 + heavy * 1.5);
  noiseBurst(o, t, 0.006, 2500, 'highpass', 0.5, 1.3);                      // supersonic crack
  noiseBurst(blast, t, snd.d * (0.55 + heavy * 0.25), snd.f, 'lowpass', 0.9, 1, 0.0015); // muzzle blast
  noiseBurst(blast, t, 0.07 + heavy * 0.05, snd.f * 0.45, 'bandpass', 1.1, 0.8);         // mid "bark"
  if (snd.b) tone(o, t, 0.09 + heavy * 0.12, snd.b * 2.2, snd.b * 0.55, 'sine', 1.1 + heavy * 0.4); // chest thump
  if (snd.b) tone(o, t, 0.05, snd.b * 4, snd.b * 1.5, 'triangle', 0.25);
  noiseBurst(o, t + 0.01, snd.d * (1.8 + heavy), 650 + snd.f * 0.12, 'lowpass', 0.5, 0.22 + heavy * 0.12, 0.02); // rolling tail
  if (snd.d < 0.3) clank(o, t + 0.035 + Math.random() * 0.01, 3200 + Math.random() * 600, 0.12); // action cycling
  if (snd.bell && Math.random() < 0.5) jingle(0.25 * vol, pan); // Sleigh Bell SMG: the bells rattle as it fires
}
// Christmas: a little cluster of sleigh bells
export function jingle(vol = 0.4, pan = 0) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(vol, pan, 0.4);
  for (let i = 0; i < 4; i++) {
    const at = t + i * 0.035 + Math.random() * 0.02, f = 2600 + Math.random() * 900;
    tone(o, at, 0.22, f, f * 0.995, 'sine', 0.5); tone(o, at, 0.16, f * 2.76, f * 2.75, 'sine', 0.18);
    noiseBurst(o, at, 0.02, 6000, 'highpass', 1, 0.25);
  }
}
// snowball splat: soft crunchy thud
export function splat(vol = 0.5, pan = 0) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(vol, pan, 0.2);
  noiseBurst(o, t, 0.14, 900, 'lowpass', 0.8, 1); noiseBurst(o, t + 0.01, 0.08, 3500, 'bandpass', 1.5, 0.35); tone(o, t, 0.08, 160, 70, 'sine', 0.5);
}
// energy weapons: a bright descending zap with a crackle and a short hum
function laser(snd, vol, pan) {
  const t = ctx.currentTime, o = out((snd.v || 0.7) * vol, pan, 0.25);
  const f = snd.pitch || 1800;
  tone(o, t, 0.16 * (snd.len || 1), f, f * 0.28, 'sawtooth', 0.35);
  tone(o, t, 0.12 * (snd.len || 1), f * 1.5, f * 0.5, 'square', 0.12);
  tone(o, t, 0.22 * (snd.len || 1), f * 0.25, f * 0.18, 'sine', 0.5);
  noiseBurst(o, t, 0.05, 6000, 'highpass', 0.7, 0.4);
  noiseBurst(o, t + 0.01, 0.12 * (snd.len || 1), 2500, 'bandpass', 2, 0.25);
  if (snd.arc) { // lightning: a sharp crack, crackling arcs and a rolling low thunder
    noiseBurst(o, t, 0.06, 5000, 'highpass', 0.5, 1);
    for (let i = 0; i < 6; i++) noiseBurst(o, t + 0.03 + i * 0.045 + Math.random() * 0.02, 0.025, 2000 + Math.random() * 4000, 'bandpass', 3, 0.5);
    noiseBurst(o, t + 0.04, 0.9, 180, 'lowpass', 0.8, 0.7, 0.05);
  }
}
// foam blasters: a pneumatic "thwip" and a plastic clack (no gunpowder)
function foam(snd, vol, pan) {
  const t = ctx.currentTime, o = out((snd.v || 0.6) * vol, pan, 0.08);
  noiseBurst(o, t, 0.09 * (snd.len || 1), 1100, 'bandpass', 1.4, 1, 0.004);
  tone(o, t, 0.07, 320, 140, 'triangle', 0.4);
  noiseBurst(o, t + 0.02, 0.03, 2600, 'bandpass', 5, 0.5);                 // plastic clack
  tone(o, t + 0.02, 0.03, 900, 700, 'triangle', 0.15);
}
// minigun: motor whine for spin-up / spin-down (dur seconds, up = rising)
export function spin(up = true, dur = 0.5) {
  if (!ctx) return; const t = ctx.currentTime, o = out(0.22, 0, 0.1);
  const a = up ? 180 : 900, b = up ? 900 : 120;
  tone(o, t, dur, a, b, 'sawtooth', 0.5); tone(o, t, dur, a * 2.01, b * 2.01, 'triangle', 0.25);
  noiseBurst(o, t, dur, up ? 1500 : 700, 'bandpass', 3, 0.3);
}
export function swish() { if (!ctx) return; const t = ctx.currentTime; noiseBurst(out(0.35), t, 0.15, 2500, 'bandpass', 1.5, 1, 0.03); }
export function click() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.35, 0, 0.05); clank(o, t, 2600, 0.8); clank(o, t + 0.08, 1900, 0.7); }
export function reload(dur) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.42, 0, 0.06);
  clank(o, t + 0.1, 1700, 0.8); noiseBurst(o, t + 0.1, 0.06, 900, 'lowpass', 1, 0.5);
  clank(o, t + dur * 0.55, 1400, 0.9); noiseBurst(o, t + dur * 0.55, 0.08, 700, 'lowpass', 1, 0.6);
  clank(o, t + dur * 0.9, 2400, 1);
}
// hit marker: a dry, sharp tick (a meaty thud on headshots) instead of a beep
export function hit(head) {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.4);
  noiseBurst(o, t, 0.018, 3600, 'bandpass', 3, 1.1);
  noiseBurst(o, t, 0.035, 900, 'lowpass', 1, 0.6);
  if (head) { clank(o, t, 3100, 0.7, 0.08); noiseBurst(o, t + 0.005, 0.07, 500, 'lowpass', 1, 0.9); tone(o, t, 0.06, 180, 90, 'sine', 0.5); }
}
export function killConfirm() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.42);
  noiseBurst(o, t, 0.02, 3000, 'bandpass', 3, 1); noiseBurst(o, t + 0.07, 0.025, 2400, 'bandpass', 3, 1);
  tone(o, t + 0.07, 0.12, 140, 70, 'sine', 0.7); noiseBurst(o, t + 0.07, 0.1, 600, 'lowpass', 1, 0.5);
}
export function hurt() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.55); noiseBurst(o, t, 0.15, 400, 'lowpass', 1, 1); tone(o, t, 0.12, 140, 70, 'sine', 0.9); noiseBurst(o, t, 0.03, 2000, 'bandpass', 2, 0.4); }
export function step(vol = 0.15, snow = false) { if (!ctx || !voice(0.08, vol >= 0.12)) return; const t = ctx.currentTime; const o = out(vol); noiseBurst(o, t, 0.06, snow ? 1400 : 650, 'lowpass', 1, 1); noiseBurst(o, t + 0.01, 0.03, snow ? 3000 : 2200, 'bandpass', 2, 0.35); tone(o, t, 0.04, 110, 70, 'sine', 0.35); }
export function land() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.3); noiseBurst(o, t, 0.12, 500, 'lowpass', 1, 1); tone(o, t, 0.1, 120, 60, 'sine', 0.5); clank(o, t + 0.02, 1800, 0.15); }
export function boom(vol = 1, pan = 0) {
  if (!ctx || !voice(2.6, vol > 0.5)) return;
  const t = ctx.currentTime, o = out(1.2 * vol, pan, 0.7);
  const blast = shaped(o, 3);
  noiseBurst(o, t, 0.01, 2000, 'highpass', 0.5, 1);
  noiseBurst(blast, t, 1.6, 700, 'lowpass', 0.7, 1, 0.004);
  noiseBurst(o, t, 0.3, 3000, 'lowpass', 0.5, 0.5);
  tone(o, t, 1.0, 90, 25, 'sine', 1.2);
  noiseBurst(o, t + 0.25, 2.2, 300, 'lowpass', 0.5, 0.35, 0.1);             // rumble
  for (let i = 0; i < 5; i++) noiseBurst(o, t + 0.3 + Math.random() * 0.8, 0.05, 2500 + Math.random() * 2000, 'bandpass', 2, 0.15); // debris
}
export function slide() { if (!ctx) return; const t = ctx.currentTime; noiseBurst(out(0.35), t, 0.7, 900, 'bandpass', 0.8, 1, 0.05); }
export function jet() {
  if (!ctx) return;
  const t = ctx.currentTime, o = out(0.6, 0, 0.4);
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.2); f.frequency.exponentialRampToValueAtTime(400, t + 2.4);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(1, t + 1.1); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
  src.connect(f); f.connect(g); g.connect(o); src.start(t); src.stop(t + 2.6);
}
export function flame(vol = 1, pan = 0) { if (!ctx || !voice(0.2, !pan)) return; const t = ctx.currentTime; const o = out(0.32 * vol, pan); noiseBurst(o, t, 0.14, 420, 'lowpass', 0.5, 1); noiseBurst(o, t, 0.1, 1800, 'bandpass', 0.6, 0.35); }
export function flashbang() { if (!ctx) return; const t = ctx.currentTime; const o = out(0.6, 0, 0.6); const b = shaped(o, 3); noiseBurst(b, t, 0.3, 3000, 'highpass', 0.7, 1); tone(o, t + 0.05, 2.8, 3900, 3700, 'sine', 0.18); }
export function uiBlip() { if (!ctx) return; const t = ctx.currentTime; tone(out(0.2), t, 0.06, 1200, 1600, 'sine', 0.6); }
export function announce() { if (!ctx) return; const t = ctx.currentTime, o = out(0.35); tone(o, t, 0.15, 520, 520, 'sawtooth', 0.25); tone(o, t + 0.12, 0.15, 780, 780, 'sawtooth', 0.25); tone(o, t + 0.24, 0.35, 1040, 1040, 'sawtooth', 0.25); }
// radio squelch before an announcer line
export function radio() { if (!ctx) return; const t = ctx.currentTime, o = out(0.18); noiseBurst(o, t, 0.09, 2400, 'bandpass', 2, 0.9); tone(o, t + 0.02, 0.05, 1800, 1400, 'square', 0.25); }
// reload sounds: mag out / mag in / bolt / shell
export function reloadSfx(kind) {
  if (!ctx) return; const t = ctx.currentTime, o = out(0.36, 0, 0.05);
  if (kind === 'out') { clank(o, t, 1500, 0.8); noiseBurst(o, t + 0.02, 0.08, 800, 'lowpass', 1, 0.4); }
  else if (kind === 'in') { noiseBurst(o, t, 0.03, 600, 'lowpass', 1, 0.6); clank(o, t + 0.03, 2300, 1, 0.07); }
  else if (kind === 'bolt') { clank(o, t, 2900, 0.9); noiseBurst(o, t + 0.01, 0.08, 4000, 'bandpass', 2, 0.35); clank(o, t + 0.11, 2100, 1, 0.06); }
  else if (kind === 'shell') { noiseBurst(o, t, 0.04, 700, 'lowpass', 1, 0.5); clank(o, t + 0.02, 1700, 0.6); }
  else if (kind === 'ping') { tone(o, t, 0.5, 2900, 2700, 'sine', 0.5); tone(o, t, 0.35, 5800, 5400, 'sine', 0.2); }
  else if (kind === 'pin') { clank(o, t, 3800, 0.5); noiseBurst(o, t + 0.03, 0.05, 5000, 'highpass', 1, 0.5); }
}
