// Chat filter, used by the server (and the client, to show the same thing straight away).
//  • swear words are starred out (f***), the message still goes through
//  • hate slurs get the message dropped and the sender banned (BAN_MS)
// Words are matched after undoing common dodges: l33t letters (n1gg@ → nigga), dots/dashes between letters
// (f.a.g), spaced-out letters (n i g g a) and stretched letters (fuuuuck).
export const BAN_MS = 2 * 60 * 60 * 1000;

const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '6': 'g' };
// letters only, lower case, l33t undone
function letters(word) {
  let out = '';
  for (const ch of word.toLowerCase()) {
    const c = LEET[ch] || ch;
    if (c >= 'a' && c <= 'z') out += c;
  }
  return out;
}

// Slurs → ban. Tested against each word (letters only, repeats kept) — whole-word patterns are anchored so
// words like "raccoon", "spice", "nigeria" or "running gear" don't trip them.
const SLURS = [
  /(^|[^s])n+i+g{2,}(?!l+(e|i|y))/,                  // n-word in any form (nigger, nigga, niggaz, n1gg@…), not "snigger"
  /^n+i+g+(a+|a+h+|a+z+|a+s+|u+h+)$/,   // single-g spellings (niga, nigah) — not Niger the country
  /^n+e+g+r+o+e*s*$/,
  /^n+g{2,}(a+|e+r+|u+h+|a+z+|a+s+|a+h+)s*$/,     // vowel-dropped spellings (ngga, nggr, nggers)
  /^n+i+g+s+$/,
  /^n+i+g+l+e+t+s*$/,
  /f+a+g{2,}/,                          // faggot, fagging…
  /^f+a+g+(s+|o+t+s*|i+t+s*|e+t+s*|g+y+)?$/,
  /^d+y+k+e+s*$/,
  /^k+i+k+e+s*$/,
  /^c+h+i+n+k+s*$/,
  /^c+h+i+n+k+y+$/,
  /^s+p+i+c+k*s*$/,
  /^g+o{2,}k+s*$/,
  /^w+e+t+b+a+c+k+s*$/,
  /^b+e+a+n+e+r+s*$/,
  /^c+o{2,}n+s*$/,
  /^j+i+g+a+b+o+o+s*$/,
  /^p+a+k+i+s*$/,
  /^r+a+g+h+e+a+d+s*$/,
  /^s+a+n+d+n+i+g+/,
  /^t+r+a+n{1,}(y+|i+e+)s*$/,
  /^s+h+e+m+a+l+e+s*$/,
];
// Swears → starred out.
const SWEARS = [
  /f+u+c*k+/, /f+c+k+/, /^f+k+$/, /s+h+i+t+/, /c+u+n+t+/, /b+i+t+c+h+/, /w+h+o+r+e+/, /^s+l+u+t+s*$/, /^s+l+u+t+t+y+$/,
  /^d+i+c+k+(s+|h+e+a+d+s*)?$/, /^c+o+c+k+(s+|s+u+c+k+e+r+s*)?$/, /^p+r+i+c+k+s*$/, /^t+w+a+t+s*$/,
  /p+u+s+s+y+/, /^a+s{2,}(e+s+|h+o+l+e+s*|h+a+t+s*)?$/, /a+s{2,}h+o+l+e+/, /^a+r+s+e+(s+|h+o+l+e+s*)?$/,
  /^b+a+s+t+a+r+d+s*$/, /w+a+n+k+/, /b+o+l+l+o+c+k+s*/, /^r+e+t+a+r+d+(s+|e+d+)?$/, /^t+o+s+s+e+r+s*$/,
  /^b+e+l+l+e+n+d+s*$/, /^d+o+u+c+h+e+(s+|b+a+g+s*)?$/, /^p+i+s+s+(e+d+|i+n+g+)?$/, /^k+y+s+$/,
  /^s+t+f+u+$/, /^g+t+f+o+$/, /^w+t+f+$/, /^f+f+s+$/, /^m+f+s*$/, /^m+o+t+h+e+r+f+/, /^b+s+$/, /^k+m+s+$/,
];

const isSlur = (w) => w.length >= 3 && SLURS.some(r => r.test(w));
const isSwear = (w) => w.length >= 2 && SWEARS.some(r => r.test(w));

// Words of the message, plus every run of 2+ single-letter "words" joined up (n i g g a → nigga).
function pieces(text) {
  const raw = text.split(/\s+/).filter(Boolean);
  const out = raw.map((w, i) => ({ from: i, to: i, w: letters(w) }));
  for (let i = 0; i < raw.length; i++) {
    let j = i, joined = '';
    while (j < raw.length && letters(raw[j]).length === 1) joined += letters(raw[j++]);
    if (j - i >= 2) out.push({ from: i, to: j - 1, w: joined });
    if (j > i) i = j - 1;
  }
  return { raw, out };
}

// → { ban: true } for a slur, else { text } with swears starred out (same as the input when clean).
export function filterChat(text) {
  const { raw, out } = pieces(String(text || ''));
  if (out.some(p => isSlur(p.w))) return { ban: true };
  const hide = new Set();
  for (const p of out) if (isSwear(p.w)) for (let i = p.from; i <= p.to; i++) hide.add(i);
  if (!hide.size) return { text };
  const star = (w) => w.replace(/[^\s]/g, (ch, i) => (i === 0 && /[a-z]/i.test(ch) ? ch : '*'));
  return { text: raw.map((w, i) => (hide.has(i) ? star(w) : w)).join(' ') };
}
