// Match announcer: short spoken callouts (killstreaks, multi-kills, match events) using the computer's built-in
// text-to-speech voice, with a radio click before each line. No recorded audio needed; all lines are our own.
import * as SFX from './audio.js';

const LINES = {
  start: ['Match is live. Good hunting.', 'Weapons free. Go, go, go.'],
  radar: ['Radar online.', 'Radar is up. Hostiles on your map.'],
  advradar: ['Advanced radar online. Every hostile is marked.'],
  enemyradar: ['Enemy radar overhead.', 'They have radar up. Keep moving.'],
  jammer: ['Jammer active. Their maps are down.'],
  jammed: ['Our maps are being jammed.', 'Signal jammed.'],
  ready: ['Killstreak ready.', 'Streak ready to deploy.'],
  armor: ['Armor up.'],
  mortar: ['Mortar barrage, on the way.', 'Shells out.'],
  enemymortar: ['Incoming mortars! Take cover!'],
  airstrike: ['Airstrike inbound.', 'Bombers on approach.'],
  enemyair: ['Enemy airstrike incoming! Find cover!'],
  firstblood: ['First blood.'],
  double: ['Double kill.'], triple: ['Triple kill.'], spree: ['Killing spree.'], rampage: ['Rampage.'], unstoppable: ['Unstoppable.'], godlike: ['Untouchable.'],
  lead: ['You have the lead.', 'You are in front.'],
  lostlead: ['You have lost the lead.'],
  minute: ['One minute remaining.'],
  win: ['Victory.', 'Match won. Outstanding.'],
  lose: ['Defeat.', 'Match lost. Regroup.'],
  revenge: ['Payback.'],
};

let enabled = true, volume = 0.8, voice = null, lastAt = {}, queued = 0;
function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const vs = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  voice = vs.find(v => /david|mark|guy|ryan|george|male/i.test(v.name)) || vs.find(v => /en-GB|en-US/.test(v.lang)) || vs[0] || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

export function setEnabled(on) { enabled = !!on; if (!enabled && 'speechSynthesis' in window) speechSynthesis.cancel(); }
export function setVolume(v) { volume = Math.max(0, Math.min(1, v)); }

// say('radar') — each kind is rate-limited so a burst of events doesn't turn into a queue of chatter
export function say(kind, minGap = 2500) {
  if (!enabled || !('speechSynthesis' in window)) return;
  const list = LINES[kind]; if (!list) return;
  const now = performance.now();
  if (now - (lastAt[kind] || 0) < minGap) return;
  lastAt[kind] = now;
  if (queued >= 2) { speechSynthesis.cancel(); queued = 0; }   // newer callouts win over a backlog
  try { SFX.radio?.(); } catch {}
  const u = new SpeechSynthesisUtterance(list[Math.floor(Math.random() * list.length)]);
  if (voice) u.voice = voice;
  u.rate = 1.08; u.pitch = 0.82; u.volume = volume;
  queued++; u.onend = u.onerror = () => { queued = Math.max(0, queued - 1); };
  setTimeout(() => speechSynthesis.speak(u), 120);
}
