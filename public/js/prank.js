// Prank mode: while the developer has /prank on, the main menu is covered by the "Isaac State Controlled Game" screen.
// Nothing is saved: it's one overlay on top of the normal menu (which stays underneath, untouched) and it
// removes itself when the prank runs out or is switched off.
const ANTHEM = 'https://www.youtube.com/watch?v=UTWtHJmGoHY'; // Hen Wlad Fy Nhadau (Welsh / English lyrics)

const CSS = `
#stateMenu{position:fixed;inset:0;z-index:9000;display:none;overflow:hidden;color:#f3e9d2;
  font-family:Rajdhani,'Segoe UI',sans-serif;user-select:none;
  background:
    repeating-linear-gradient(135deg,rgba(0,0,0,.0) 0 38px,rgba(0,0,0,.18) 38px 76px),
    radial-gradient(ellipse at 70% 40%,rgba(150,0,0,.55),rgba(20,0,0,.96) 70%),#120000}
#stateMenu.show{display:block;animation:smIn .35s ease-out}
@keyframes smIn{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:none}}
#stateMenu .sm-top{position:absolute;left:0;right:0;top:0;height:34px;background:#0a0a0a;border-bottom:3px solid #c8102e;
  display:flex;align-items:center;gap:22px;padding:0 22px;font:700 13px Orbitron,'Segoe UI',sans-serif;letter-spacing:3px;color:#d8c9a3}
#stateMenu .sm-rec{display:flex;align-items:center;gap:8px;color:#ff3b3b}
#stateMenu .sm-rec i{width:10px;height:10px;border-radius:50%;background:#ff2020;box-shadow:0 0 10px #ff2020;animation:smBlink 1s steps(2) infinite}
@keyframes smBlink{50%{opacity:0}}
#stateMenu .sm-top .sp{flex:1}
#stateMenu .sm-left{position:absolute;left:56px;top:clamp(52px,8vh,90px);bottom:56px;width:min(600px,46vw);display:flex;flex-direction:column}
#stateMenu .sm-ministry{font:700 14px Orbitron,'Segoe UI',sans-serif;letter-spacing:6px;color:#e3b341}
#stateMenu .sm-title{font:900 clamp(38px,6.2vh,66px)/1 Orbitron,'Segoe UI',sans-serif;letter-spacing:2px;margin:clamp(4px,1vh,12px) 0 clamp(4px,1vh,10px);color:#fff;
  text-shadow:4px 4px 0 #c8102e,8px 8px 0 rgba(0,0,0,.6);text-transform:uppercase}
#stateMenu .sm-title span{color:#e3b341}
#stateMenu .sm-sub{font:700 16px Rajdhani,sans-serif;letter-spacing:5px;color:#d8c9a3;border-top:2px solid #e3b341;border-bottom:2px solid #e3b341;padding:5px 0;margin-bottom:clamp(10px,2.2vh,24px);text-align:center}
#stateMenu .sm-btn{display:flex;align-items:center;gap:16px;width:100%;margin:0 0 clamp(6px,1.1vh,12px);padding:clamp(6px,1.25vh,14px) 18px;cursor:pointer;text-align:left;
  background:linear-gradient(90deg,rgba(0,0,0,.75),rgba(60,0,0,.65));border:2px solid #5a0a0a;border-left:8px solid #c8102e;color:#f3e9d2;
  font-family:inherit;transition:transform .08s,border-color .12s,background .12s}
#stateMenu .sm-btn:hover{transform:translateX(8px);border-color:#e3b341;background:linear-gradient(90deg,#c8102e,rgba(90,0,0,.85))}
#stateMenu .sm-btn .ic{font:900 22px Orbitron,sans-serif;color:#e3b341;width:30px;text-align:center}
#stateMenu .sm-btn b{display:block;font:800 clamp(17px,2.9vh,26px) Orbitron,'Segoe UI',sans-serif;letter-spacing:2px}
#stateMenu .sm-btn small{display:block;font:600 clamp(12px,1.9vh,15px) Rajdhani,sans-serif;letter-spacing:1px;color:#d8b8a0;margin-top:2px}
#stateMenu .sm-right{position:absolute;right:clamp(24px,4vw,70px);top:clamp(56px,9vh,100px);width:420px;transform-origin:top right;display:flex;flex-direction:column;align-items:center;gap:16px}
#stateMenu .sm-poster{width:360px;padding:16px;background:#e9dcbc;color:#1a0505;border:6px solid #1a0505;outline:3px solid #c8102e;
  box-shadow:12px 12px 0 rgba(0,0,0,.55);transform:rotate(1.5deg);text-align:center}
#stateMenu .sm-poster .hd{font:900 30px Orbitron,sans-serif;letter-spacing:3px;color:#c8102e}
#stateMenu .sm-seal{width:150px;height:150px;margin:12px auto;border-radius:50%;background:#c8102e;border:8px double #1a0505;position:relative;
  display:flex;align-items:center;justify-content:center;box-shadow:inset 0 0 0 6px #e3b341}
#stateMenu .sm-seal::before{content:'★';position:absolute;top:6px;font-size:22px;color:#e3b341}
#stateMenu .sm-seal b{font:900 70px Orbitron,sans-serif;color:#e9dcbc;text-shadow:3px 3px 0 #1a0505}
#stateMenu .sm-poster .ft{font:800 18px Rajdhani,sans-serif;letter-spacing:3px}
#stateMenu .sm-poster .ft2{font:600 13px Rajdhani,sans-serif;letter-spacing:2px;margin-top:6px;color:#5a0a0a}
#stateMenu .sm-card{width:360px;background:rgba(0,0,0,.7);border:2px solid #5a0a0a;border-top:4px solid #e3b341;padding:12px 16px;
  font:700 14px Rajdhani,sans-serif;letter-spacing:2px;color:#d8c9a3}
#stateMenu .sm-card div{display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px dashed rgba(227,179,65,.25)}
#stateMenu .sm-card div:last-child{border:0}
#stateMenu .sm-card em{font-style:normal;color:#ff4a4a}
#stateMenu .sm-card .ok{color:#e3b341}
#stateMenu .sm-ticker{position:absolute;left:0;right:0;bottom:0;height:40px;background:#c8102e;border-top:3px solid #e3b341;overflow:hidden;white-space:nowrap;
  font:800 18px Orbitron,'Segoe UI',sans-serif;letter-spacing:3px;color:#fff;display:flex;align-items:center}
#stateMenu .sm-ticker span{display:inline-block;padding-left:100%;animation:smTick 38s linear infinite}
@media (max-height:820px){#stateMenu .sm-right{transform:scale(.8)}}
@media (max-height:680px){#stateMenu .sm-right{transform:scale(.68)}}
@media (min-height:1000px){#stateMenu .sm-right{transform:scale(1.15)}}
@keyframes smTick{to{transform:translateX(-100%)}}
#stateMenu .sm-stamp{position:absolute;right:clamp(30px,6vw,110px);bottom:96px;transform:rotate(-14deg);border:5px solid rgba(227,179,65,.85);color:rgba(227,179,65,.85);
  padding:6px 16px;font:900 26px Orbitron,sans-serif;letter-spacing:4px;pointer-events:none}
#stateMenu .sm-toast{position:absolute;left:50%;top:60px;transform:translateX(-50%);background:#0a0a0a;border:2px solid #e3b341;color:#e3b341;
  padding:10px 20px;font:800 16px Orbitron,sans-serif;letter-spacing:2px;opacity:0;transition:opacity .2s;pointer-events:none}
#stateMenu .sm-toast.on{opacity:1}
`;

const BUTTONS = [
  ['▶', 'REPORT FOR DUTY', 'Participation is mandatory'],
  ['✦', 'STATE ARMORY', 'Weapons are issued, not chosen'],
  ['☰', 'MANDATORY CHALLENGES', 'Failure will be noted on your record'],
  ['◆', 'APPROVED UNIFORMS', 'Individuality has been discontinued'],
  ['⚙', 'SETTINGS', 'The State has already chosen your settings'],
  ['✉', 'SUBMIT A COMPLAINT', 'Complaints are forwarded directly to the bin'],
];
const LINES = [
  'You have been selected for a mandatory cultural experience.',
  'The State has chosen your entertainment.',
  'Request denied. Please enjoy the anthem.',
  'Your loyalty is appreciated. Sing along.',
  'This button has been nationalised.',
];

let el = null, until = 0, tick = 0, toastT = 0, lineI = 0;
function build(name) {
  const st = document.createElement('style'); st.id = 'stateMenuCss'; st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'stateMenu';
  const who = String(name || 'CITIZEN').toUpperCase().replace(/[<>&"]/g, '');
  const no = String(Math.floor(Math.random() * 900000 + 100000));
  el.innerHTML = `
    <div class="sm-top"><span class="sm-rec"><i></i>SURVEILLANCE ACTIVE</span><span>MINISTRY OF GAMING</span><span class="sp"></span><span>CITIZEN № ${no}</span><span>THREAT LEVEL: <b style="color:#ff4a4a">SUSPICIOUS</b></span></div>
    <div class="sm-left">
      <div class="sm-ministry">BY ORDER OF THE SUPREME LEADER</div>
      <div class="sm-title">ISAAC <span>STATE</span><br>CONTROLLED GAME</div>
      <div class="sm-sub">OBEY · FRAG · REPEAT</div>
      ${BUTTONS.map(([ic, b, s]) => `<button class="sm-btn"><span class="ic">${ic}</span><span><b>${b}</b><small>${s}</small></span></button>`).join('')}
    </div>
    <div class="sm-right">
      <div class="sm-poster"><div class="hd">ISAAC IS WATCHING</div><div class="sm-seal"><b>I</b></div><div class="ft">GLORY TO THE LEADER</div><div class="ft2">UNAUTHORISED FUN IS PROHIBITED</div></div>
      <div class="sm-card">
        <div><span>CITIZEN</span><span>${who}</span></div>
        <div><span>LOYALTY RATING</span><em>INSUFFICIENT</em></div>
        <div><span>K/D RATIO</span><span class="ok">STATE APPROVED</span></div>
        <div><span>FREE WILL</span><em>REVOKED</em></div>
        <div><span>NEXT INSPECTION</span><span class="ok">IMMINENT</span></div>
      </div>
    </div>
    <div class="sm-stamp">APPROVED BY ISAAC</div>
    <div class="sm-toast"></div>
    <div class="sm-ticker"><span>★ ALL HAIL ISAAC ★ ${who} IS BEING MONITORED ★ CAMPING IS NOW A STATE PRIVILEGE ★ REPORT DISLOYAL TEAMMATES TO THE MINISTRY ★ THE SCOREBOARD IS ALWAYS CORRECT ★ ISAAC HAS NEVER LOST A GUNFIGHT ★ SINGING THE ANTHEM IS ENCOURAGED ★</span></div>`;
  el.querySelectorAll('.sm-btn').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    window.open(ANTHEM, '_blank');
    const t = el.querySelector('.sm-toast'); t.textContent = LINES[lineI++ % LINES.length].toUpperCase(); t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }));
  // swallow everything so nothing reaches the real menu underneath
  for (const ev of ['mousedown', 'mouseup', 'click', 'wheel', 'contextmenu']) el.addEventListener(ev, e => e.stopPropagation());
  document.body.appendChild(el);
}
function destroy() { el?.remove(); document.getElementById('stateMenuCss')?.remove(); el = null; clearInterval(tick); tick = 0; }

// until: end time (0 = off). shouldShow(): true while the player is on the main menu. name: their callsign.
export function setPrank(t, shouldShow, name) {
  until = Number(t) || 0;
  if (until <= Date.now()) { destroy(); return; }
  if (!el) build(name);
  clearInterval(tick);
  const upd = () => { if (Date.now() >= until) { destroy(); return; } el.classList.toggle('show', !!shouldShow()); };
  upd(); tick = setInterval(upd, 250);
}
