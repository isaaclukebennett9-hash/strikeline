// Map Builder: build your own map out of blocks, save it on this PC, then host a lobby on it (friends who join get
// the map sent to them with the lobby). Blocks use the same materials and themes as the real maps, and the map is
// played with the normal game rules: spawns, pickups and bot paths are worked out automatically from the blocks.
import * as THREE from 'three';
import { getMaterial, THEMES, MAT_COLORS } from './textures.js';
import { CUSTOM_MATS, CUSTOM_THEMES, CUSTOM_SIZES, CUSTOM_MAX_BOXES, CUSTOM_MAX_H, cleanCustomMap } from '/shared/maps.js';

const SAVE_KEY = 'strikeline_maps';
const MAT_LABEL = m => m.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const THEME_LABEL = { town: 'Old Town', city: 'City', base: 'Military', harbor: 'Harbor', neon: 'Neon Night', snow: 'Snow', desert: 'Desert', construction: 'Construction', suburb: 'Suburbs', canyon: 'Canyon', shipyard: 'Shipyard', killhouse: 'Indoor' };
// shapes: one block, or a set of blocks (stairs) fitted in a w × d × h footprint; rot turns it in 90° steps
const SHAPES = {
  block: { name: 'Block', w: 2, d: 2, h: 2 }, wall: { name: 'Wall', w: 4, d: 0.3, h: 3 }, floor: { name: 'Floor / roof', w: 4, d: 4, h: 0.3 },
  pillar: { name: 'Pillar', w: 0.5, d: 0.5, h: 3 }, crate: { name: 'Cover', w: 1.2, d: 1.2, h: 1.1, m: 'crate' }, stairs: { name: 'Stairs', w: 1.6, d: 4.2, h: 3, stairs: true },
  pad: { name: 'Jump pad', w: 1.8, d: 1.8, h: 0.16, m: 'jumppad' },
};

export function createBuilder({ store, toast, blip, onPlay, onExit, playerName }) {
  const $ = id => document.getElementById(id);
  const root = $('scr-builder'), view = $('bdView');
  let renderer = null, scene, camera, ground, grid, edge, ghost, raf = 0, open = false;
  const st = { name: 'My Map', size: 60, theme: 'town', boxes: [], tool: 'place', shape: 'block', mat: 'concrete', w: 2, d: 2, h: 2, rot: 0 };
  const undo = [], redo = [];
  const cam = { tx: 0, tz: 0, yaw: 0.6, pitch: 0.85, dist: 55 };
  const meshes = [];
  const matCache = new Map();

  // ------------------------------------------------------------ saved maps
  const loadAll = () => { try { const o = JSON.parse(store.get(SAVE_KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; } };
  const saveAll = o => store.set(SAVE_KEY, JSON.stringify(o));
  const data = () => ({ name: st.name, by: playerName(), size: st.size, theme: st.theme, boxes: st.boxes.map(b => [...b]) });

  // ------------------------------------------------------------ 3D view
  function matFor(name) {
    const key = name + '|' + st.theme;
    if (matCache.has(key)) return matCache.get(key);
    const src = getMaterial(name, st.theme);
    const m = new THREE.MeshStandardMaterial({ map: src.map, color: src.color, roughness: src.roughness, metalness: src.metalness, emissive: src.emissive, emissiveMap: src.emissiveMap,
      emissiveIntensity: src.emissiveIntensity, transparent: src.transparent, opacity: src.opacity });
    m.userData.scale = src.userData.scale || 3;
    matCache.set(key, m); return m;
  }
  // box with texture repeats that match its size (like the real maps)
  function boxGeo(w, h, d, scale) {
    const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
    const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * faces[f][0] / scale, uv.getY(k) * faces[f][1] / scale); }
    return g;
  }
  function meshFor(b, i) {
    const [x0, y0, z0, x1, y1, z1, m] = b, mat = matFor(m);
    const mesh = new THREE.Mesh(boxGeo(x1 - x0, y1 - y0, z1 - z0, mat.userData.scale), mat);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.i = i;
    return mesh;
  }
  function rebuild() {
    for (const m of meshes) { scene.remove(m); m.geometry.dispose(); }
    meshes.length = 0;
    st.boxes.forEach((b, i) => { const m = meshFor(b, i); scene.add(m); meshes.push(m); });
    $('bdCount').textContent = `${st.boxes.length} / ${CUSTOM_MAX_BOXES} blocks`;
  }
  function setupWorld() {
    const th = THEMES[st.theme];
    scene.background = new THREE.Color(th.skyHorizon || '#9ab');
    scene.fog = new THREE.Fog(th.fog || '#9ab', 120, 400);
    for (const o of [...scene.children]) if (o.userData.world) { scene.remove(o); o.geometry?.dispose(); }
    const add = o => { o.userData.world = true; scene.add(o); return o; };
    add(new THREE.HemisphereLight(th.hemiSky, th.hemiGround, th.hemiI * 1.1));
    const sun = add(new THREE.DirectionalLight(th.sun, th.sunI * 0.9));
    const sd = th.sunDir || [0.5, 0.8, 0.3]; sun.position.set(sd[0] * 80, sd[1] * 80, sd[2] * 80);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -st.size * 0.75; sc.right = sc.top = st.size * 0.75; sc.far = 300;
    const fm = matFor(th.floor), fs = st.size + 40;
    ground = add(new THREE.Mesh(boxGeo(fs, 0.02, fs, fm.userData.scale), fm)); ground.position.y = -0.01; ground.receiveShadow = true;
    grid = add(new THREE.GridHelper(st.size, st.size, 0xffffff, 0xffffff)); grid.position.y = 0.012; grid.material.transparent = true; grid.material.opacity = 0.16; grid.material.depthWrite = false;
    const h = st.size / 2, pts = [[-h, -h], [h, -h], [h, h], [-h, h], [-h, -h]].map(([x, z]) => new THREE.Vector3(x, 0.05, z));
    edge = add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ff7a1a' })));
    for (const [x, z, w, d] of [[0, -h - 1, st.size + 4, 2], [0, h + 1, st.size + 4, 2], [-h - 1, 0, 2, st.size + 4], [h + 1, 0, 2, st.size + 4]]) { // the map's outer walls (as in the game)
      const m = add(new THREE.Mesh(new THREE.BoxGeometry(w, 12, d), new THREE.MeshStandardMaterial({ color: '#1a1c22', transparent: true, opacity: 0.35 }))); m.position.set(x, 6, z);
    }
    matCache.forEach((m, k) => { if (!k.endsWith('|' + st.theme)) { matCache.delete(k); } });
    rebuild(); updateGhost();
  }
  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, 1, 0.1, 800);
    ghost = new THREE.Group(); scene.add(ghost);
    bindUi();
  }
  function resize() {
    if (!renderer) return;
    const w = view.clientWidth || innerWidth, h = view.clientHeight || innerHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function placeCamera() {
    cam.pitch = Math.max(0.12, Math.min(1.5, cam.pitch)); cam.dist = Math.max(4, Math.min(220, cam.dist));
    const h = st.size / 2 + 10; cam.tx = Math.max(-h, Math.min(h, cam.tx)); cam.tz = Math.max(-h, Math.min(h, cam.tz));
    camera.position.set(cam.tx + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, Math.sin(cam.pitch) * cam.dist, cam.tz + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist);
    camera.lookAt(cam.tx, 0, cam.tz);
  }
  const keys = {};
  let last = 0;
  function loop(t) {
    if (!open) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - (last || t)) / 1000); last = t;
    const sp = cam.dist * 0.9 * dt, f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    if (f || s) { cam.tx += (-Math.sin(cam.yaw) * f + Math.cos(cam.yaw) * s) * sp; cam.tz += (-Math.cos(cam.yaw) * f - Math.sin(cam.yaw) * s) * sp; }
    if (keys.KeyQ) cam.yaw += dt * 1.6; if (keys.KeyE) cam.yaw -= dt * 1.6;
    placeCamera();
    renderer.render(scene, camera);
  }

  // ------------------------------------------------------------ placing blocks
  const snap = (v, s = 0.5) => Math.round(v / s) * s;
  const dims = () => (st.rot % 2 ? [st.d, st.w] : [st.w, st.d]);
  // the block(s) the current shape makes inside a footprint at (cx, y0, cz)
  function shapeBoxes(cx, y0, cz) {
    const [w, d] = dims(), h = st.h, sh = SHAPES[st.shape];
    if (!sh.stairs) return [[cx - w / 2, y0, cz - d / 2, cx + w / 2, y0 + h, cz + d / 2, st.mat]];
    const steps = Math.max(2, Math.round(h / 0.3)), rise = h / steps, out = [];
    const along = st.rot % 2 ? 'x' : 'z', len = along === 'z' ? d : w, run = len / steps, dir = st.rot >= 2 ? -1 : 1;
    for (let i = 0; i < steps; i++) {                          // each step is solid down to the floor, so nothing hangs in the air
      const a0 = -len / 2 + i * run, a1 = a0 + run;
      const s0 = dir > 0 ? a0 : -a1, s1 = dir > 0 ? a1 : -a0;
      out.push(along === 'z' ? [cx - w / 2, y0, cz + s0, cx + w / 2, y0 + rise * (i + 1), cz + s1, st.mat] : [cx + s0, y0, cz - d / 2, cx + s1, y0 + rise * (i + 1), cz + d / 2, st.mat]);
    }
    return out;
  }
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  let hover = null;
  function pickAt(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, camera);
    const hit = ray.intersectObjects([...meshes, ground], false)[0];
    if (!hit) return null;
    const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    return { hit, n, box: hit.object === ground ? null : st.boxes[hit.object.userData.i], i: hit.object === ground ? -1 : hit.object.userData.i };
  }
  function placementFor(p) {
    if (!p) return null;
    const [w, d] = dims(), h = st.h, pt = p.hit.point;
    let cx = snap(pt.x - w / 2) + w / 2, cz = snap(pt.z - d / 2) + d / 2, y0 = 0;
    if (p.box) {
      if (p.n.y > 0.5) y0 = p.box[4];                                        // on top of the block
      else if (p.n.y < -0.5) y0 = Math.max(0, p.box[1] - h);                 // under it
      else {                                                                 // against its side, bottoms lined up
        y0 = p.box[1];
        if (Math.abs(p.n.x) > 0.5) cx = p.n.x > 0 ? p.box[3] + w / 2 : p.box[0] - w / 2;
        else cz = p.n.z > 0 ? p.box[5] + d / 2 : p.box[2] - d / 2;
      }
    }
    const half = st.size / 2, list = shapeBoxes(cx, y0, cz);
    const ok = st.boxes.length + list.length <= CUSTOM_MAX_BOXES && list.every(b => b[0] >= -half - 0.01 && b[3] <= half + 0.01 && b[2] >= -half - 0.01 && b[5] <= half + 0.01 && b[4] <= CUSTOM_MAX_H);
    return { list, ok };
  }
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#7dff9a', transparent: true, opacity: 0.35, depthWrite: false });
  const ghostBad = new THREE.MeshBasicMaterial({ color: '#ff4a4a', transparent: true, opacity: 0.4, depthWrite: false });
  const ghostEdge = new THREE.LineBasicMaterial({ color: '#ffffff' });
  const markMat = new THREE.MeshBasicMaterial({ color: '#ff4a4a', transparent: true, opacity: 0.45, depthWrite: false });
  function updateGhost(ev) {
    if (!renderer) return;
    for (const c of [...ghost.children]) { ghost.remove(c); c.geometry.dispose(); }
    const p = ev ? pickAt(ev) : hover;
    if (ev) hover = p;
    if (!p) return;
    if (st.tool === 'place') {
      const pl = placementFor(p); if (!pl) return;
      for (const b of pl.list) {
        const g = new THREE.BoxGeometry(b[3] - b[0] + 0.02, b[4] - b[1] + 0.02, b[5] - b[2] + 0.02), c = [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
        const m = new THREE.Mesh(g, pl.ok ? ghostMat : ghostBad); m.position.set(...c); ghost.add(m);
        const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), ghostEdge); l.position.set(...c); ghost.add(l);
      }
    } else if (p.box) {                                                     // highlight the block the tool acts on
      const b = p.box, g = new THREE.BoxGeometry(b[3] - b[0] + 0.04, b[4] - b[1] + 0.04, b[5] - b[2] + 0.04);
      const m = new THREE.Mesh(g, st.tool === 'delete' ? markMat : ghostMat); m.position.set((b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2); ghost.add(m);
    }
  }
  function commit(fn) { undo.push(JSON.stringify(st.boxes)); if (undo.length > 150) undo.shift(); redo.length = 0; fn(); rebuild(); updateGhost(); }
  function act(ev) {
    const p = pickAt(ev); if (!p) return;
    if (ev.altKey && p.box) { // eyedropper: take that block's material and size
      st.mat = p.box[6]; st.w = +(p.box[3] - p.box[0]).toFixed(2); st.d = +(p.box[5] - p.box[2]).toFixed(2); st.h = +(p.box[4] - p.box[1]).toFixed(2); st.rot = 0; st.shape = 'block'; syncUi(); return;
    }
    if (st.tool === 'place') { const pl = placementFor(p); if (pl?.ok) { commit(() => st.boxes.push(...pl.list)); blip(); } else if (pl) toast(st.boxes.length >= CUSTOM_MAX_BOXES ? 'That\'s the most blocks a map can have.' : 'That would stick out of the map.'); }
    else if (st.tool === 'delete' && p.box) { commit(() => st.boxes.splice(p.i, 1)); blip(); }
    else if (st.tool === 'paint' && p.box && p.box[6] !== st.mat) { commit(() => { st.boxes[p.i] = [...p.box.slice(0, 6), st.mat]; }); blip(); }
  }

  // ------------------------------------------------------------ input
  let drag = null;
  function bindUi() {
    const el = renderer.domElement;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('mousedown', e => { drag = { b: e.button, x: e.clientX, y: e.clientY, moved: false, shift: e.shiftKey }; });
    addEventListener('mousemove', e => {
      if (!open) return;
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
        if (drag.b === 2 && !drag.shift) { cam.yaw -= dx * 0.006; cam.pitch += dy * 0.005; }
        else if (drag.b === 1 || (drag.b === 2 && drag.shift)) { const k = cam.dist * 0.0018; cam.tx -= (Math.cos(cam.yaw) * dx - Math.sin(cam.yaw) * dy) * k; cam.tz -= (-Math.sin(cam.yaw) * dx - Math.cos(cam.yaw) * dy) * k; }
      }
      if (e.target === el) updateGhost(e);
    });
    addEventListener('mouseup', e => { if (open && drag && drag.b === 0 && !drag.moved && e.target === el) act(e); drag = null; });
    el.addEventListener('wheel', e => { e.preventDefault(); cam.dist *= e.deltaY > 0 ? 1.12 : 0.89; }, { passive: false });
    addEventListener('keydown', e => {
      if (!open || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
      keys[e.code] = true;
      if (e.code === 'KeyR') { st.rot = (st.rot + 1) % 4; syncUi(); updateGhost(); }
      if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      if (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); doRedo(); }
      if (e.code === 'Digit1') setTool('place'); if (e.code === 'Digit2') setTool('paint'); if (e.code === 'Digit3') setTool('delete');
      if (e.code === 'Escape') exit();
    });
    addEventListener('keyup', e => { keys[e.code] = false; });
    addEventListener('resize', () => open && resize());
    // panels
    $('bdShapes').innerHTML = Object.entries(SHAPES).map(([k, s]) => `<button data-shape="${k}">${s.name}</button>`).join('');
    $('bdShapes').onclick = e => { const k = e.target.dataset.shape; if (!k) return; const s = SHAPES[k]; Object.assign(st, { shape: k, w: s.w, d: s.d, h: s.h, rot: 0 }); if (s.m) st.mat = s.m; setTool('place'); syncUi(); };
    $('bdMats').innerHTML = CUSTOM_MATS.map(m => `<button data-mat="${m}" title="${MAT_LABEL(m)}" style="background:${MAT_COLORS[m] || '#888'}"></button>`).join('');
    $('bdMats').onclick = e => { const m = e.target.dataset.mat; if (!m) return; st.mat = m; if (st.tool === 'delete') setTool('place'); syncUi(); updateGhost(); };
    $('bdTools').onclick = e => { const t = e.target.dataset.tool; if (t) setTool(t); };
    for (const k of ['w', 'd', 'h']) $('bd_' + k).addEventListener('input', e => { const v = +e.target.value; if (v > 0) { st[k] = Math.min(k === 'h' ? CUSTOM_MAX_H : st.size, Math.max(0.1, v)); updateGhost(); } });
    $('bdRot').onclick = () => { st.rot = (st.rot + 1) % 4; syncUi(); updateGhost(); };
    $('bdName').addEventListener('input', e => { st.name = e.target.value.slice(0, 24); });
    $('bdSize').innerHTML = CUSTOM_SIZES.map(s => `<option value="${s}">${s} × ${s} m</option>`).join('');
    $('bdSize').onchange = e => { const s = +e.target.value; if (st.boxes.some(b => Math.max(Math.abs(b[0]), Math.abs(b[3]), Math.abs(b[2]), Math.abs(b[5])) > s / 2 + 0.01)) { toast('Some blocks are outside that size. Move or delete them first.'); e.target.value = st.size; return; } st.size = s; setupWorld(); };
    $('bdTheme').innerHTML = CUSTOM_THEMES.map(t => `<option value="${t}">${THEME_LABEL[t] || t}</option>`).join('');
    $('bdTheme').onchange = e => { st.theme = e.target.value; setupWorld(); };
    $('bdUndo').onclick = doUndo; $('bdRedo').onclick = doRedo;
    $('bdClear').onclick = () => { if (!st.boxes.length || !confirm('Remove every block from this map?')) return; commit(() => { st.boxes.length = 0; }); };
    $('bdNew').onclick = () => { if (st.boxes.length && !confirm('Start a new empty map? Unsaved changes are lost.')) return; Object.assign(st, { name: 'My Map', size: 60, theme: 'town', boxes: [] }); undo.length = redo.length = 0; syncUi(); setupWorld(); };
    $('bdSave').onclick = save;
    $('bdLoad').onchange = e => { const k = e.target.value; e.target.value = ''; if (!k) return; const m = loadAll()[k]; if (!m) return; load(m); toast(`Loaded "${m.name}"`); };
    $('bdDelete').onclick = () => { const all = loadAll(); if (!all[st.name]) { toast('This map isn\'t saved yet.'); return; } if (!confirm(`Delete the saved map "${st.name}" from this PC?`)) return; delete all[st.name]; saveAll(all); refreshSaved(); toast('Map deleted'); };
    $('bdPlay').onclick = () => { save(true); const d = cleanCustomMap(data()); onPlay(d, $('bdPublic').checked); };
    $('bdBack').onclick = exit;
  }
  function setTool(t) { st.tool = t; syncUi(); updateGhost(); }
  function doUndo() { if (!undo.length) return; redo.push(JSON.stringify(st.boxes)); st.boxes = JSON.parse(undo.pop()); rebuild(); updateGhost(); }
  function doRedo() { if (!redo.length) return; undo.push(JSON.stringify(st.boxes)); st.boxes = JSON.parse(redo.pop()); rebuild(); updateGhost(); }
  function save(quiet) {
    const name = (st.name || '').trim() || 'My Map'; st.name = name;
    const all = loadAll(); all[name] = data(); saveAll(all); refreshSaved();
    if (!quiet) toast(`Saved "${name}" on this PC`);
  }
  function load(m) {
    const d = cleanCustomMap(m); if (!d) return;
    Object.assign(st, { name: d.name, size: d.size, theme: d.theme, boxes: d.boxes });
    undo.length = redo.length = 0; syncUi(); setupWorld();
    cam.tx = cam.tz = 0; cam.dist = d.size * 0.9;
  }
  function refreshSaved() {
    const all = loadAll(), names = Object.keys(all).sort();
    $('bdLoad').innerHTML = `<option value="">${names.length ? 'Open a saved map…' : 'No saved maps yet'}</option>` + names.map(n => `<option value="${n.replace(/"/g, '&quot;')}">${n.replace(/</g, '&lt;')} (${(all[n].boxes || []).length} blocks)</option>`).join('');
  }
  function syncUi() {
    $('bdTools').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.tool === st.tool));
    $('bdShapes').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.shape === st.shape));
    $('bdMats').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.mat === st.mat));
    $('bdMatName').textContent = MAT_LABEL(st.mat);
    const [w, d] = dims();
    $('bd_w').value = st.w; $('bd_d').value = st.d; $('bd_h').value = st.h;
    $('bdRot').textContent = `ROTATE (R) · ${st.rot * 90}°`;
    $('bdDims').textContent = `${w} × ${d} × ${st.h} m`;
    $('bdName').value = st.name; $('bdSize').value = st.size; $('bdTheme').value = st.theme;
  }

  // ------------------------------------------------------------ open / close
  function show() {
    if (!renderer) init();
    open = true; root.classList.add('on');
    refreshSaved(); syncUi(); resize(); setupWorld(); placeCamera();
    last = 0; raf = requestAnimationFrame(loop);
  }
  function exit() { if (!open) return; open = false; cancelAnimationFrame(raf); root.classList.remove('on'); for (const k in keys) keys[k] = false; onExit(); }
  return { show, exit, isOpen: () => open };
}
