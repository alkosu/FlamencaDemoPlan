/* Навигатор ЖК: векторный план со слоями, поиск квартиры и пеший маршрут до лестницы.
 * Данные берутся из window.ZHK (data/plan-data.js, собирается tools/build.py из data/complex.json). */
(() => {
'use strict';
if (!window.ZHK) {
  document.getElementById('info').innerHTML =
    '<div class="note">Не найден data/plan-data.js. Соберите данные: <code>python tools/build.py</code>.</div>';
  return;
}
const { config: CFG, vector: VEC, stacks: STK } = window.ZHK;
const M_PER_PX = CFG.image.metersPerPx, WALK = CFG.walkSpeed;
const ESC = CFG.escaleras, ACCESS = CFG.access;
const N = CFG.network.nodes, E = CFG.network.edges, STEPNAME = CFG.network.stepNames;
const STARTS = CFG.starts.map(s => [s.node, s.name]);
const ESCNODE = Object.fromEntries(Object.entries(ESC).map(([k, e]) => [k, e.node]));
const STACKS = CFG.stacks.map((s, i) => ({ b: s.building, codes: s.units, r: s.cut, ...STK[i] }));

/* ---------- граф дорожек ---------- */
const adj = {}; for (const k in N) adj[k] = [];
const dd = (a, b) => Math.hypot(N[a][0] - N[b][0], N[a][1] - N[b][1]);
for (const [a, b] of E) { const w = dd(a, b); adj[a].push([b, w]); adj[b].push([a, w]); }
function dijkstra(src) {
  const dist = {}, prev = {}, done = new Set();
  for (const k in N) dist[k] = Infinity; dist[src] = 0;
  for (;;) {
    let u = null, best = Infinity;
    for (const k in dist) if (!done.has(k) && dist[k] < best) { best = dist[k]; u = k; }
    if (u === null) break; done.add(u);
    for (const [v, w] of adj[u]) if (dist[u] + w < dist[v]) { dist[v] = dist[u] + w; prev[v] = u; }
  }
  return { dist, prev };
}
const pathTo = (prev, t) => { const p = [t]; while (prev[p[0]]) p.unshift(prev[p[0]]); return p; };

/* ---------- квартиры ---------- */
const APTS = [];
STACKS.forEach((s, si) => {
  const base = s.b.split('.')[0]; let esc = null, bd = Infinity;
  for (const k in ESC) { const e = ESC[k]; if (e.building !== base) continue;
    const d = Math.hypot(e.x - s.c[0], e.y - s.c[1]); if (d < bd) { bd = d; esc = k; } }
  s.esc = esc; s.stack = s.codes[0].replace(/\d/, '').split('-')[0];
  s.codes.forEach(code => { const m = code.match(/^([A-Z])(\d)([a-z]?)-(\d+)$/);
    APTS.push({ code, num: +m[4], floor: +m[2], b: s.b, si, esc, stack: s.stack }); });
});
const gateRun = dijkstra(STARTS[0][0]);
APTS.forEach(a => a.fromGate = Math.round(gateRun.dist[ESCNODE[a.esc]] * M_PER_PX));
APTS.sort((x, y) => x.num - y.num);
const byCode = new Map(APTS.map(a => [a.code.toLowerCase(), a]));
const floorName = f => f === 0 ? '0 · planta baja' : String(f);
const escLabel = k => `Escalera ${ESC[k].n}` + (ESC[k].unlabeled ? ' ⚑' : '');
const liftLabel = a => a.floor === 0 ? 'не нужен' : `у Escalera ${ESC[a.esc].n}`;
const howTo = a => ACCESS[a.b].replace('{n}', ESC[a.esc].n) + (a.floor === 0 ? ' (уровень входа)' : ` → ${a.floor} этаж`);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- отрисовка плана ---------- */
const NS = 'http://www.w3.org/2000/svg', $ = id => document.getElementById(id);
const el = (t, at, p) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; };
const L = k => document.querySelector(`[data-layer="${k}"]`);
const path = (g, d, fill, extra = {}) => el('path', Object.assign({ d, fill, 'fill-rule': 'evenodd' }, extra), g);

const svg = $('map');
const FULL = [0, 0, CFG.image.width, CFG.image.height];
svg.setAttribute('viewBox', FULL.join(' '));
const raster = L('raster');
raster.setAttribute('href', CFG.image.file); raster.setAttribute('width', CFG.image.width); raster.setAttribute('height', CFG.image.height);

path(L('neighbour'), VEC.neighbour, '#e9ece5'); path(L('neighbour'), VEC.nbwater, '#cfe3ec');
$('sitebg').setAttribute('d', VEC.site);
path(L('road'), VEC.road, '#d3d6d3');
path(L('walk'), VEC.walk, '#e9dcbd');
path(L('lawn'), VEC.lawn, '#bcd592'); path(L('lawn'), VEC.trees, '#79a858');
path(L('pool'), VEC.deck, '#cdb79b'); path(L('pool'), VEC.pool, '#57c1ea', { stroke: '#2e95c2', 'stroke-width': 1.5 });
path(L('parking'), VEC.parking, '#848985');
CFG.parking.forEach(([n, x, y]) => { const t = el('text', { x, y: y + 4, 'text-anchor': 'middle', 'font-size': 11, fill: '#fff', 'font-family': 'IBM Plex Mono,monospace', 'font-weight': 500 }, L('parking')); t.textContent = n; });
path(L('bld'), VEC.bldbody, '#e7e1d3', { stroke: '#a99d86', 'stroke-width': 1 }); path(L('bld'), VEC.terrace, '#d9cfbb');
path(L('gallery'), VEC.gallery, '#efd57c', { stroke: '#c9a93f', 'stroke-width': .8 });
path(L('sitebound'), VEC.site, 'none', { stroke: '#9a3b2b', 'stroke-width': 2.5, 'stroke-dasharray': '10 6' });
CFG.labels.forEach(([t, x, y, s]) => { const e = el('text', { x, y, 'text-anchor': 'middle', 'font-size': s, 'font-weight': 600, class: 'lab', stroke: '#f7f6f1', 'stroke-width': 3, 'paint-order': 'stroke' }, $('g-lab')); e.textContent = t; });
CFG.streetLabels.forEach(([t, x, y, rot]) => { const e = el('text', { x, y, 'font-size': 16, 'font-weight': 600, class: 'lab', transform: `rotate(${rot} ${x} ${y})`, 'letter-spacing': '2' }, $('g-lab')); e.textContent = t; });
CFG.badges.forEach(([t, x, y]) => { const g = el('g', {}, $('g-lab')); const w = t.length > 2 ? 44 : 34;
  el('rect', { x: x - w / 2, y: y - 14, width: w, height: 28, rx: 14, fill: '#2b2f2c', stroke: '#fff', 'stroke-width': 2.5 }, g);
  const e = el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 600, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g); e.textContent = t;
  el('title', {}, g).textContent = 'Корпус ' + t; });

for (const [a, b] of E) el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: '#1f4fd1', 'stroke-width': 3, 'stroke-opacity': .55, 'stroke-dasharray': '6 5' }, $('g-graph'));
for (const k in N) el('circle', { cx: N[k][0], cy: N[k][1], r: 3.5, fill: '#1f4fd1' }, $('g-graph'));

const stackEls = STACKS.map(s => { const e = el('path', { d: s.d, class: 'stk e' + ESC[s.esc].n, 'fill-rule': 'evenodd' }, $('g-stacks'));
  el('title', {}, e).textContent = `Корпус ${s.b}: ${s.codes.join(', ')}`; return e; });
const stackLbl = STACKS.map(() => el('g', {}, $('g-stl')));
for (const k in ESC) { const e = ESC[k]; const c = e.n === 1 ? '#2f7a4d' : '#b57d1a';
  const g = el('g', {}, $('g-esc')); el('circle', { cx: e.x, cy: e.y, r: 11, fill: c, stroke: '#fff', 'stroke-width': 2.5 }, g);
  const t = el('text', { x: e.x, y: e.y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g); t.textContent = 'E' + e.n;
  el('title', {}, g).textContent = `Корпус ${e.building} · Escalera ${e.n}` + (e.unlabeled ? ' (на плане без подписи)' : ''); }
for (const [k, name] of STARTS) { const [x, y] = N[k]; const g = el('g', {}, $('g-starts'));
  el('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 3, fill: '#fff', stroke: '#1d2420', 'stroke-width': 2.5 }, g); el('title', {}, g).textContent = name; }

/* ---------- состояние ---------- */
const state = { apt: null, from: STARTS[0][0], customStart: null, picking: false, floor: 'all', show: 'all', hover: -1, ff: 'all' };

function renderStacks() {
  const a = state.apt;
  STACKS.forEach((s, i) => {
    const e = stackEls[i], sel = !!a && a.si === i;
    let vis = true;
    if (a && state.show === 'bld') vis = s.b === a.b;
    if (a && state.show === 'apt') vis = sel;
    e.style.display = vis ? '' : 'none'; stackLbl[i].style.display = vis ? '' : 'none';
    e.classList.toggle('sel', sel); e.classList.toggle('hov', state.hover === i && !sel);
    const g = stackLbl[i]; g.innerHTML = '';
    const [cx, cy] = s.c;
    if (state.floor === 'all') {
      const fs = Math.min(11, Math.max(8, s.w / 8.5)), lh = fs * 1.18;
      s.codes.forEach((c, k) => { const t = el('text', { x: cx, y: cy - 1.5 * lh + k * lh + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (a && a.code === c ? ' sel' : '') }, g); t.textContent = c; });
    } else {
      const c = s.codes.find(x => +x.match(/\d/)[0] === +state.floor); const fs = Math.min(14, s.w / 6.2);
      const t = el('text', { x: cx, y: cy + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (a && a.code === c ? ' sel' : '') }, g); t.textContent = c;
    }
  });
}

/* ---------- боковая панель ---------- */
document.title = CFG.title.replace(' · ', ' — ');
$('apptitle').textContent = CFG.title;
$('summary').textContent = `${APTS.length} квартир · ${new Set(STACKS.map(s => s.b)).size} корпусов · этажи 0–3`;
const fromSel = $('from');
STARTS.forEach(([k, n]) => { const o = document.createElement('option'); o.value = k; o.textContent = n; fromSel.appendChild(o); });
const oc = document.createElement('option'); oc.value = '__custom'; oc.textContent = 'Точка на плане'; oc.hidden = true; fromSel.appendChild(oc);
fromSel.addEventListener('change', () => { state.from = fromSel.value; if (state.from !== '__custom') state.customStart = null; render(); });
function seg(id, items, key, cb) {
  const box = $(id); box.innerHTML = '';
  items.forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = v; box.appendChild(b); });
  const sync = () => [...box.children].forEach(b => { const on = b.dataset.v === String(state[key]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state[key] = b.dataset.v; sync(); cb(); });
  sync(); return sync;
}
const syncFloor = seg('floorseg', [['all', 'Все'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], 'floor', renderStacks);
seg('showseg', [['all', 'Все'], ['bld', 'Корпус'], ['apt', 'Квартира']], 'show', renderStacks);

function startNode() {
  if (state.from !== '__custom') return { node: state.from, extra: null };
  const [x, y] = state.customStart; let best = null, bd = Infinity;
  const escNodes = new Set(Object.values(ESCNODE));
  for (const k in N) { if (escNodes.has(k)) continue; const d = Math.hypot(N[k][0] - x, N[k][1] - y); if (d < bd) { bd = d; best = k; } }
  return { node: best, extra: [x, y], extraLen: bd };
}
let lastPts = null;
function render() {
  renderStacks(); const gR = $('g-route'); gR.innerHTML = '';
  document.querySelectorAll('#tb tr').forEach(tr => tr.classList.toggle('sel', !!state.apt && tr.dataset.code === state.apt.code));
  const info = $('info');
  if (!state.apt) { info.innerHTML = '<div class="note">Выберите квартиру в поиске, в таблице ниже или кликом по блоку на плане.</div>'; return; }
  const a = state.apt, s = STACKS[a.si];
  const st = startNode(); const run = dijkstra(st.node); const target = ESCNODE[a.esc]; const p = pathTo(run.prev, target);
  let pts = p.map(k => N[k]); let len = run.dist[target];
  if (st.extra) { pts = [st.extra, ...pts]; len += st.extraLen; }
  const ps = pts.map(q => q.join(',')).join(' ');
  el('polyline', { points: ps, fill: 'none', stroke: '#fff', 'stroke-width': 11, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gR);
  el('polyline', { points: ps, fill: 'none', stroke: '#1f4fd1', 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gR);
  el('polyline', { points: ps, fill: 'none', stroke: '#9fb6ff', 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'routeline' }, gR);
  el('circle', { cx: pts[0][0], cy: pts[0][1], r: 9, fill: '#1d2420', stroke: '#fff', 'stroke-width': 3 }, gR);
  el('line', { x1: ESC[a.esc].x, y1: ESC[a.esc].y, x2: s.c[0], y2: s.c[1], stroke: '#d1491f', 'stroke-width': 3, 'stroke-dasharray': '4 4' }, gR);
  lastPts = pts.concat([[s.r[0], s.r[1]], [s.r[2], s.r[3]]]);
  const meters = Math.round(len * M_PER_PX), mins = Math.max(1, Math.round(meters / WALK / 60));
  const startName = state.from === '__custom' ? 'точка на плане' : STARTS.find(x => x[0] === state.from)[1];
  const steps = [`Старт: ${startName}`]; p.forEach(k => { if (STEPNAME[k]) steps.push(STEPNAME[k][0].toUpperCase() + STEPNAME[k].slice(1)); });
  steps.push(`Вход: корпус ${a.b}, Escalera ${ESC[a.esc].n}` + (ESC[a.esc].unlabeled ? ' (на плане без подписи)' : ''));
  steps.push(a.floor === 0 ? 'Квартира на уровне входа (planta baja)' : `Лифт или лестница на ${a.floor} этаж`);
  steps.push(`Дверь ${a.code}, стояк ${a.stack}`);
  info.innerHTML = `<div class="dest">${esc(a.code)}</div>
    <div class="stat"><div><b>≈${meters} м</b><span>пешком</span></div><div><b>~${mins} мин</b><span>по территории</span></div><div><b>${a.floor}</b><span>этаж</span></div></div>
    <dl class="kv"><dt>Корпус</dt><dd>${esc(a.b)}</dd><dt>Лестница</dt><dd>${escLabel(a.esc)}</dd><dt>Лифт</dt><dd>${liftLabel(a)}*</dd></dl>
    <ol class="steps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <button class="btn" id="fitroute" type="button">Показать маршрут целиком</button>`;
  $('fitroute').onclick = () => fitTo(lastPts);
}
function selectApt(a, fit = true) {
  state.apt = a; state.floor = String(a.floor); syncFloor(); $('q').value = a.code; render();
  if (fit && lastPts) fitTo(lastPts);
  try { history.replaceState(null, '', '#' + a.code); } catch (_) { /* file:// в некоторых браузерах */ }
}
function openStack(i) {
  const s = STACKS[i]; const f = state.floor === 'all' ? 3 : +state.floor;
  selectApt(byCode.get(s.codes.find(x => +x.match(/\d/)[0] === f).toLowerCase()), false);
}

/* ---------- поиск ---------- */
const q = $('q'), sugg = $('sugg'); let suggIdx = 0, suggList = [];
function showSugg(list) {
  suggList = list.slice(0, 12); suggIdx = 0; if (!suggList.length) { sugg.hidden = true; return; }
  sugg.innerHTML = suggList.map((a, i) => `<div class="${i ? '' : 'on'}" data-i="${i}" role="option"><span class="mono">${a.code}</span><span class="note">корп. ${a.b} · ${a.floor} эт.</span></div>`).join('');
  sugg.hidden = false; q.setAttribute('aria-expanded', 'true');
}
new MutationObserver(() => q.setAttribute('aria-expanded', String(!sugg.hidden))).observe(sugg, { attributes: true, attributeFilter: ['hidden'] });
q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); if (!v) { sugg.hidden = true; return; }
  showSugg(APTS.filter(a => a.code.toLowerCase().includes(v) || String(a.num).startsWith(v))); });
q.addEventListener('keydown', e => { if (sugg.hidden) return; const items = [...sugg.children];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); suggIdx = (suggIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((x, i) => x.classList.toggle('on', i === suggIdx)); }
  else if (e.key === 'Enter') { e.preventDefault(); selectApt(suggList[suggIdx]); sugg.hidden = true; }
  else if (e.key === 'Escape') sugg.hidden = true; });
sugg.addEventListener('mousedown', e => { const d = e.target.closest('[data-i]'); if (!d) return; e.preventDefault(); selectApt(suggList[+d.dataset.i]); sugg.hidden = true; });
q.addEventListener('blur', () => setTimeout(() => sugg.hidden = true, 150));
$('pick').onclick = () => { state.picking = !state.picking; $('pick').classList.toggle('on', state.picking); svg.classList.toggle('picking', state.picking); $('hint').hidden = !state.picking; };

/* ---------- слои ---------- */
const LAYERS = [
  ['Квартиры', [['apts', 'Блоки квартир', '#eef6ef'], ['aptlabels', 'Номера квартир', null], ['plain', 'Окраска по лестницам', '#fbf2e2'], ['esc', 'Лестницы (E1/E2)', '#2f7a4d']]],
  ['Здания', [['bld', 'Корпуса и террасы', '#e7e1d3'], ['gallery', 'Галереи и лестничные ядра', '#efd57c']]],
  ['Территория', [['walk', 'Пешеходные дорожки', '#e9dcbd'], ['road', 'Проезды', '#d3d6d3'], ['parking', 'Парковка', '#848985'], ['lawn', 'Озеленение', '#bcd592'], ['pool', 'Бассейн', '#57c1ea'], ['site', 'Фон участка', '#f2efe6'], ['sitebound', 'Граница участка', null], ['neighbour', 'Соседний участок', '#e9ece5'], ['labels', 'Подписи', null]]],
  ['Служебное', [['graph', 'Сеть маршрутов', '#1f4fd1'], ['raster', 'Исходный план (картинка)', null]]]
];
const PRESETS = {
  'Всё': ['apts', 'aptlabels', 'plain', 'esc', 'bld', 'gallery', 'walk', 'road', 'parking', 'lawn', 'pool', 'site', 'sitebound', 'neighbour', 'labels'],
  'Навигация': ['apts', 'aptlabels', 'esc', 'bld', 'walk', 'site', 'labels'],
  'Только квартиры': ['apts', 'aptlabels', 'plain', 'esc', 'labels'],
  'Сверка с исходником': ['apts', 'esc', 'raster', 'graph']
};
const on = new Set(PRESETS['Всё']);
const body = $('layerbody');
const pr = document.createElement('div'); pr.className = 'presets';
Object.keys(PRESETS).forEach(n => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = n;
  b.onclick = () => { on.clear(); PRESETS[n].forEach(k => on.add(k)); applyLayers(); }; pr.appendChild(b); });
body.appendChild(pr);
const boxes = {};
LAYERS.forEach(([grp, items]) => {
  const h = document.createElement('div'); h.className = 'grp'; h.textContent = grp; body.appendChild(h);
  items.forEach(([k, t, c]) => {
    const lab = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'ly-' + k;
    cb.onchange = () => { cb.checked ? on.add(k) : on.delete(k); applyLayers(); }; boxes[k] = cb; lab.appendChild(cb);
    if (c) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = c; lab.appendChild(s); }
    lab.appendChild(document.createTextNode(t)); body.appendChild(lab);
    if (k === 'raster') { const r = document.createElement('input'); r.type = 'range'; r.id = 'rasterop'; r.min = 10; r.max = 100; r.value = 60;
      r.setAttribute('aria-label', 'Прозрачность исходного плана'); r.oninput = () => raster.setAttribute('opacity', r.value / 100); body.appendChild(r); }
  });
});
function applyLayers() {
  document.querySelectorAll('[data-layer]').forEach(g => { g.style.display = on.has(g.dataset.layer) ? '' : 'none'; });
  svg.classList.toggle('plain', !on.has('plain'));
  for (const k in boxes) boxes[k].checked = on.has(k);
}
$('layerbtn').onclick = () => { const b = $('layerbody'); b.hidden = !b.hidden; $('layerbtn').setAttribute('aria-expanded', String(!b.hidden)); $('layerarrow').textContent = b.hidden ? '▸' : '▾'; };
if (matchMedia('(max-width:860px)').matches) $('layerbtn').click();

/* ---------- зум, панорама, клики ---------- */
let vb = [...FULL];
const setVB = () => svg.setAttribute('viewBox', vb.join(' '));
function toSvg(cx, cy) { const r = svg.getBoundingClientRect(); const s = Math.max(vb[2] / r.width, vb[3] / r.height);
  const ox = (r.width * s - vb[2]) / 2, oy = (r.height * s - vb[3]) / 2; return [vb[0] - ox + (cx - r.left) * s, vb[1] - oy + (cy - r.top) * s]; }
function zoomAt(f, px, py) { const nw = Math.min(FULL[2] * 2, Math.max(160, vb[2] * f)), k = nw / vb[2]; vb = [px - (px - vb[0]) * k, py - (py - vb[1]) * k, nw, vb[3] * k]; setVB(); }
function fitTo(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]); const pad = 60;
  let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const r = svg.getBoundingClientRect(), ar = r.width / r.height;
  if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
  vb = [x0, y0, w, h]; setVB();
}
function stackAt(x, y) {
  for (let i = 0; i < STACKS.length; i++) {
    if (stackEls[i].style.display === 'none') continue;
    const [x0, y0, x1, y1] = STACKS[i].r;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      if (!stackEls[i].isPointInFill || stackEls[i].isPointInFill(pt)) return i;
    }
  }
  return -1;
}
svg.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, px, py); }, { passive: false });
const ptrs = new Map(); let drag = null, moved = 0, pinch = null;
svg.addEventListener('pointerdown', e => { svg.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
  if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vb: [...vb] };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; } });
svg.addEventListener('pointermove', e => {
  if (!ptrs.size && on.has('apts')) { const [x, y] = toSvg(e.clientX, e.clientY); const i = stackAt(x, y);
    if (i !== state.hover) { state.hover = i; stackEls.forEach((s, j) => s.classList.toggle('hov', j === i && !(state.apt && state.apt.si === j))); svg.style.cursor = i >= 0 && !state.picking ? 'pointer' : ''; }
    return; }
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const [px, py] = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomAt(pinch.d / d, px, py); pinch.d = d; moved = 99; return; }
  if (drag) { const r = svg.getBoundingClientRect(); const s = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height); const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); vb = [drag.vb[0] - dx * s, drag.vb[1] - dy * s, drag.vb[2], drag.vb[3]]; setVB(); }
});
const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) drag = null; };
svg.addEventListener('pointerup', e => { const wasClick = moved < 5 && ptrs.size === 1; up(e); if (!wasClick) return;
  const [x, y] = toSvg(e.clientX, e.clientY);
  if (state.picking) { state.customStart = [x, y]; state.from = '__custom'; fromSel.value = '__custom'; $('pick').click(); render(); return; }
  if (on.has('apts')) { const i = stackAt(x, y); if (i >= 0) openStack(i); } });
svg.addEventListener('pointercancel', up);
$('zin').onclick = () => zoomAt(1 / 1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zout').onclick = () => zoomAt(1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zfit').onclick = () => { vb = [...FULL]; setVB(); };

/* ---------- таблица ---------- */
const fb = $('fb');
['all', ...new Set(STACKS.map(s => s.b).sort())].forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v === 'all' ? 'Все корпуса' : 'Корпус ' + v; fb.appendChild(o); });
const ff = $('ff');
['all', 0, 1, 2, 3].forEach(v => { const b = document.createElement('button'); b.type = 'button'; b.textContent = v === 'all' ? 'Все этажи' : v === 0 ? '0 (PB)' : v + ' эт.'; b.dataset.v = v; ff.appendChild(b); });
ff.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.ff = b.dataset.v; renderTable(); });
fb.onchange = renderTable; $('ft').oninput = renderTable;
function filtered() { const b = fb.value, f = state.ff, t = $('ft').value.trim().toLowerCase();
  return APTS.filter(a => (b === 'all' || a.b === b) && (f === 'all' || a.floor === +f) && (!t || a.code.toLowerCase().includes(t) || String(a.num).includes(t)))
    .sort((x, y) => x.b.localeCompare(y.b) || y.floor - x.floor || x.num - y.num); }
function renderTable() {
  [...ff.children].forEach(b => b.classList.toggle('on', b.dataset.v === String(state.ff)));
  const rows = filtered(); $('fcount').textContent = `${rows.length} из ${APTS.length}`;
  $('tb').innerHTML = rows.map(a => `<tr data-code="${a.code}" class="${state.apt && state.apt.code === a.code ? 'sel' : ''}">
    <td class="num">${a.num}</td><td class="mono">${a.code}</td><td>${a.b}</td><td>${floorName(a.floor)}</td><td class="mono">${a.stack}</td>
    <td><span class="pill e${ESC[a.esc].n}">${escLabel(a.esc)}</span></td><td>${liftLabel(a)}</td><td>${howTo(a)}</td><td class="num">≈${a.fromGate} м</td></tr>`).join('');
}
$('tb').addEventListener('click', e => { const tr = e.target.closest('tr'); if (!tr) return; selectApt(byCode.get(tr.dataset.code.toLowerCase()));
  const box = document.querySelector('.mapbox'); if (box.scrollIntoView) box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); });
$('copycsv').onclick = () => {
  const head = ['№', 'Код', 'Корпус', 'Этаж', 'Стояк', 'Лестница', 'Лифт', 'Как пройти', 'От входа, м'];
  const lines = [head, ...filtered().map(a => [a.num, a.code, a.b, a.floor, a.stack, 'Escalera ' + ESC[a.esc].n + (ESC[a.esc].unlabeled ? ' (не подписана)' : ''), liftLabel(a), howTo(a), a.fromGate])]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const msg = t => { $('toast').textContent = t; setTimeout(() => $('toast').textContent = '', 2000); };
  try { navigator.clipboard.writeText(lines).then(() => msg('Скопировано'), () => msg('Буфер недоступен')); } catch (_) { msg('Буфер недоступен'); }
};

/* ---------- старт ---------- */
applyLayers(); renderTable();
const fromHash = byCode.get(decodeURIComponent(location.hash.slice(1)).toLowerCase());
selectApt(fromHash || byCode.get(CFG.defaultApartment.toLowerCase()), !!fromHash);
window.addEventListener('hashchange', () => { const a = byCode.get(decodeURIComponent(location.hash.slice(1)).toLowerCase()); if (a && a !== state.apt) selectApt(a); });
})();
