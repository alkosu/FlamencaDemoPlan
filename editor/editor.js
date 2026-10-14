/* Редактор данных навигатора Flamenca.
 * Правит сеть дорожек, лестницы, точки старта, лифты и щиты воды и сохраняет всё в один файл edits.json.
 * Навигатор читает data/edits.json сам (или черновик из localStorage при ?preview=1). */
(async () => {
'use strict';
const $ = id => document.getElementById(id);
const Z = window.ZHK;
if (!Z) { document.body.innerHTML = '<p style="padding:20px">Не найден data/plan-data.js</p>'; return; }
const [W, H] = Z.size, MPP = Z.metersPerPx, NS = 'http://www.w3.org/2000/svg';
const LANGS = Z.config.languages || ['es', 'en', 'fr', 'ru'];
const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = { get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (_) { /* */ } } };
const DRAFT = 'fdp.editor.draft', PREVIEW = 'fdp.preview';
const toast = t => { const e = $('toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => e.hidden = true, 2200); };

/* ================= подложка ================= */
const svg = $('map'), world = $('world');
const G = {}; const layer = k => (G[k] = el('g', {}, world));
layer('raster'); const raster = el('image', { href: '../' + Z.config.image.file, width: W, height: H, opacity: .55 }, G.raster); G.raster.style.display = 'none';
layer('base');
const P = (d, fill, x = {}) => el('path', Object.assign({ d, fill, 'fill-rule': 'evenodd' }, x), G.base);
const V = Z.vector;
P(V.road, '#d8dad7'); P(V.walk, '#ece2c9'); P(V.lawn, '#cfe0b0'); P(V.trees, '#a8c78f'); P(V.deck, '#ddcdb8'); P(V.pool, '#8fd3ef'); P(V.parking, '#a3a7a4');
P(V.bldbody, '#ece7dc', { stroke: '#b9ae98', 'stroke-width': 1 }); P(V.gallery, '#f2df9c');
layer('stacks');
Z.stacks.forEach(s => el('path', { d: s.d, fill: '#f6f8fd', stroke: '#8b93a7', 'stroke-width': 1 }, G.stacks));
layer('nums');
Z.stacks.forEach((s, i) => { const u = Z.units.filter(x => x.stack === i).sort((a, b) => b.floor - a.floor)[0]; if (!u) return;
  el('text', { x: s.c[0], y: s.c[1] + 5, 'text-anchor': 'middle', 'font-size': 13, fill: '#6b7280', 'font-family': 'IBM Plex Mono,monospace' }, G.nums).textContent = u.kind === 'apt' ? u.num : u.code.split(':')[1]; });
Z.badges.forEach(([t, x, y]) => { const g = el('g', {}, G.nums); el('rect', { x: x - 20, y: y - 13, width: 40, height: 26, rx: 13, fill: '#2b2f2c', opacity: .8 }, g);
  el('text', { x, y: y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g).textContent = t; });
layer('edges'); layer('nodes'); layer('route'); layer('rubber'); layer('marks');

/* ================= модель ================= */
const clone = o => JSON.parse(JSON.stringify(o));
function fromPublished() {
  return {
    nodes: Z.graph.nodes.map(p => [p[0], p[1]]),
    edges: Z.graph.edges.map(([a, b]) => ({ a, b, closed: false })),
    stairs: Object.fromEntries(Z.stairs.map(s => [s.id, [s.x, s.y]])),
    starts: Z.starts.map(s => ({ id: s.id, x: s.x, y: s.y, name: { ...s.name } })),
    lifts: (Z.lifts || []).map(l => ({ ...l })),
    water: (Z.water || []).map(w => ({ ...w }))
  };
}
function fromFile(f) {
  if (!f || f.format !== 'flamenca-edits' || !f.graph) throw new Error('Это не файл правок навигатора (нет format: "flamenca-edits").');
  const d = fromPublished();
  d.nodes = f.graph.nodes.map(p => [+p[0], +p[1]]);
  d.edges = f.graph.edges.map(([a, b]) => ({ a, b, closed: false })).concat((f.graph.closed || []).map(([a, b]) => ({ a, b, closed: true })));
  if (f.stairs) for (const k in f.stairs) if (d.stairs[k]) d.stairs[k] = f.stairs[k];
  if (f.starts) d.starts = f.starts.map(s => ({ id: s.id, x: s.x, y: s.y, name: { ...s.name } }));
  d.lifts = (f.lifts || []).map(l => ({ ...l }));
  d.water = (f.water || []).map(w => ({ ...w }));
  return d;
}
function toFile() {
  const live = D.edges.filter(e => !e.dead && D.nodes[e.a] && D.nodes[e.b] && e.a !== e.b);
  const map = new Map(), nodes = [];
  const id = i => { if (!map.has(i)) { map.set(i, nodes.length); nodes.push(D.nodes[i].map(v => Math.round(v * 10) / 10)); } return map.get(i); };
  const seen = new Set(), edges = [], closed = [];
  for (const e of live) { const a = id(e.a), b = id(e.b), k = a < b ? a + '-' + b : b + '-' + a; if (seen.has(k)) continue; seen.add(k); (e.closed ? closed : edges).push([a, b]); }
  const r = v => Math.round(v * 10) / 10;
  return { format: 'flamenca-edits', version: 1, updated: new Date().toISOString(), units: 'px of source/master.jpg (0.1 m/px)',
    graph: { nodes, edges, closed },
    stairs: Object.fromEntries(Object.entries(D.stairs).map(([k, p]) => [k, [r(p[0]), r(p[1])]])),
    starts: D.starts.map(s => ({ ...s, x: r(s.x), y: r(s.y) })),
    lifts: D.lifts.map(l => ({ ...l, x: r(l.x), y: r(l.y) })),
    water: D.water.map(w => ({ ...w, x: r(w.x), y: r(w.y) })) };
}

let D, SRC = 'опубликованный план';
let published = null;
try { const r = await fetch('../data/edits.json', { cache: 'no-cache' }); if (r.ok) published = await r.json(); } catch (_) { /* file:// или нет файла */ }
function loadPublished() { D = published ? fromFile(published) : fromPublished(); SRC = published ? 'data/edits.json от ' + new Date(published.updated).toLocaleString('ru') : 'сеть из plan-data.js (edits.json ещё не опубликован)'; }
loadPublished();

/* undo / черновик */
const UNDO = []; let dirty = false;
const snap = () => { UNDO.push(JSON.stringify(D)); if (UNDO.length > 60) UNDO.shift(); $('undo').disabled = false; };
function undo() { if (!UNDO.length) return; D = JSON.parse(UNDO.pop()); $('undo').disabled = !UNDO.length; sel = null; route = null; changed(); toast('Отменено'); }
let saveT = null;
function changed() { dirty = true; renderAll(); clearTimeout(saveT); saveT = setTimeout(() => { if (store.set(DRAFT, JSON.stringify({ t: Date.now(), d: toFile() }))) setStats('черновик сохранён'); }, 500); }
const draft = (() => { try { return JSON.parse(store.get(DRAFT)); } catch (_) { return null; } })();
if (draft && draft.d) {
  $('draftTime').textContent = new Date(draft.t).toLocaleString('ru'); $('draftBanner').hidden = false;
  $('draftUse').onclick = () => { D = fromFile(draft.d); SRC = 'черновик'; $('draftBanner').hidden = true; renderAll(); fitAll(); };
  $('draftDrop').onclick = () => { store.del(DRAFT); $('draftBanner').hidden = true; };
}

/* ================= вид, зум ================= */
let vb = [0, 0, W, H];
const setVB = () => { svg.setAttribute('viewBox', vb.join(' ')); };
const scale = () => { const r = svg.getBoundingClientRect(); return Math.max(vb[2] / (r.width || 1), vb[3] / (r.height || 1)); };
function toSvg(cx, cy) { const r = svg.getBoundingClientRect(), s = scale(); return [vb[0] - (r.width * s - vb[2]) / 2 + (cx - r.left) * s, vb[1] - (r.height * s - vb[3]) / 2 + (cy - r.top) * s]; }
function zoomAt(f, px, py) { const nw = Math.min(W * 1.6, Math.max(60, vb[2] * f)), k = nw / vb[2]; vb = [px - (px - vb[0]) * k, py - (py - vb[1]) * k, nw, vb[3] * k]; setVB(); renderMarks(); }
function fitBox(x0, y0, x1, y1) { const r = svg.getBoundingClientRect(), ar = (r.width / r.height) || 1.3; let w = x1 - x0, h = y1 - y0; if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; } vb = [x0, y0, w, h]; setVB(); renderMarks(); }
const fitAll = () => fitBox(0, 0, W, H);
$('zi').onclick = () => zoomAt(1 / 1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zo').onclick = () => zoomAt(1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zf').onclick = fitAll;
setVB();

/* ================= геометрия ================= */
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function projSeg(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy; const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0; const q = [a[0] + t * dx, a[1] + t * dy]; return { t, q, d: dist(p, q) }; }
function nearNode(p, R) { let best = -1, bd = R; D.nodes.forEach((n, i) => { if (!n) return; const d = dist(p, n); if (d < bd) { bd = d; best = i; } }); return best; }
function nearEdge(p, R) { let best = -1, bd = R, bq = null; D.edges.forEach((e, i) => { if (e.dead) return; const r = projSeg(p, D.nodes[e.a], D.nodes[e.b]); if (r.d < bd) { bd = r.d; best = i; bq = r; } }); return best < 0 ? null : { i: best, ...bq }; }
const R = () => 14 * scale();      // радиус попадания: 14 экранных пикселей
function degree() { const g = new Array(D.nodes.length).fill(0); D.edges.forEach(e => { if (!e.dead) { g[e.a]++; g[e.b]++; } }); return g; }
function addNode(p) { D.nodes.push([Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); return D.nodes.length - 1; }
function hasEdge(a, b) { return D.edges.some(e => !e.dead && ((e.a === a && e.b === b) || (e.a === b && e.b === a))); }
function addEdge(a, b, closed = false) { if (a !== b && !hasEdge(a, b)) D.edges.push({ a, b, closed }); }
function splitEdge(i, q) { const e = D.edges[i]; const m = addNode(q); e.dead = true; D.edges.push({ a: e.a, b: m, closed: e.closed }, { a: m, b: e.b, closed: e.closed }); return m; }
/** точка клика → id узла: существующий узел, точка на отрезке (с разбиением) или новый узел */
function resolve(p) { const n = nearNode(p, R()); if (n >= 0) return n; const e = nearEdge(p, R() * 0.8); if (e) return splitEdge(e.i, e.q); return addNode(p); }
function deleteNode(i) { D.edges.forEach(e => { if (!e.dead && (e.a === i || e.b === i)) e.dead = true; }); D.nodes[i] = null; }
function gc() { const g = degree(); D.nodes.forEach((n, i) => { if (n && !g[i]) D.nodes[i] = null; }); }

/* ================= маршрут ================= */
function graphAdj() { const adj = D.nodes.map(() => []); D.edges.forEach(e => { if (e.dead || e.closed) return; const w = dist(D.nodes[e.a], D.nodes[e.b]); adj[e.a].push([e.b, w]); adj[e.b].push([e.a, w]); }); return adj; }
function dijkstra(adj, src) {
  const n = adj.length, d = new Float64Array(n).fill(Infinity), pv = new Int32Array(n).fill(-1), h = [[0, src]]; d[src] = 0;
  const push = x => { h.push(x); let i = h.length - 1; while (i) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const t = h[0], l = h.pop(); if (h.length) { h[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < h.length && h[a][0] < h[m][0]) m = a; if (b < h.length && h[b][0] < h[m][0]) m = b; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return t; };
  while (h.length) { const [du, u] = pop(); if (du > d[u]) continue; for (const [v, w] of adj[u]) if (du + w < d[v]) { d[v] = du + w; pv[v] = u; push([d[v], v]); } }
  return { d, pv };
}
const liveNear = p => nearNode(p, Infinity);
let route = null;   // {a:[x,y], b:[x,y] , path, len}

/* ================= отрисовка ================= */
let sel = null;      // {type:'lift'|'water'|'start'|'stair', key}
let tool = 'move', drawing = null, hover = null, cursorPt = null;
function renderGraph() {
  // одна <path> на класс объектов: тысячи отдельных <line> рисуются слишком медленно
  G.edges.textContent = ''; G.nodes.textContent = '';
  const r1 = v => Math.round(v * 10) / 10;
  let open = '', closed = '', hl = '';
  D.edges.forEach((e, i) => { if (e.dead) return; const a = D.nodes[e.a], b = D.nodes[e.b];
    const seg = `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`;
    if (hover && hover.edge === i) hl += seg; else if (e.closed) closed += seg; else open += seg; });
  if (open) el('path', { d: open, class: 'e', fill: 'none' }, G.edges);
  if (closed) el('path', { d: closed, class: 'e closed', fill: 'none' }, G.edges);
  if (hl) el('path', { d: hl, class: 'e hl', fill: 'none' }, G.edges);
  const showN = $('vNodes').checked, showD = $('vDangle').checked, g = degree();
  let dots = '', dang = '', hot = '';
  D.nodes.forEach((n, i) => { if (!n) return; const dot = `M${r1(n[0])} ${r1(n[1])}h0`;
    if ((hover && hover.node === i) || (drawing && drawing.last === i)) hot += dot;
    else if (showD && g[i] === 1) dang += dot;
    else if (showN) dots += dot; });
  if (dots) el('path', { d: dots, class: 'n', fill: 'none' }, G.nodes);
  if (dang) el('path', { d: dang, class: 'n dangle', fill: 'none' }, G.nodes);
  if (hot) el('path', { d: hot, class: 'n hl', fill: 'none' }, G.nodes);
}
function renderMarks() {
  G.marks.textContent = ''; const s = Math.max(.6, Math.min(2.2, scale() * 1.6));
  const box = (x, y, txt, fill, key, round) => { const g = el('g', { class: 'mk' + (sel && sel.key === key ? ' sel' : ''), transform: `translate(${x} ${y}) scale(${s})` }, G.marks);
    if (round) el('circle', { r: 10, fill, stroke: '#fff', 'stroke-width': 2.5 }, g); else el('rect', { x: -11, y: -11, width: 22, height: 22, rx: 5, fill, stroke: '#fff', 'stroke-width': 2.5 }, g);
    el('text', { y: 4.5, 'text-anchor': 'middle', 'font-size': txt.length > 2 ? 8 : 11, fill: '#fff' }, g).textContent = txt; };
  for (const [id, p] of Object.entries(D.stairs)) box(p[0], p[1], 'E' + id.split('-E')[1], '#2f7a4d', 'stair:' + id);
  D.starts.forEach((p, i) => box(p.x, p.y, '▶', '#1d2420', 'start:' + i));
  D.lifts.forEach((p, i) => box(p.x, p.y, 'L', '#1f4fd1', 'lift:' + i));
  D.water.forEach((p, i) => box(p.x, p.y, 'W', '#2e95c2', 'water:' + i, true));
}
function renderRoute() {
  G.route.textContent = '';
  if (!route) return;
  for (const p of [route.a, route.b]) if (p) el('circle', { cx: p[0], cy: p[1], r: 9 * scale(), fill: '#00a86b' }, G.route);
  if (route.path) el('polyline', { points: route.path.map(p => p.join(',')).join(' '), class: 'route' }, G.route);
}
function renderRubber() {
  G.rubber.textContent = '';
  if (tool === 'draw' && drawing && drawing.last !== null && cursorPt && D.nodes[drawing.last]) { const a = D.nodes[drawing.last]; el('line', { x1: a[0], y1: a[1], x2: cursorPt[0], y2: cursorPt[1], class: 'rb' }, G.rubber); }
}
function setStats(extra) {
  const live = D.edges.filter(e => !e.dead), cl = live.filter(e => e.closed).length, nn = D.nodes.filter(Boolean).length;
  $('stats').textContent = `Источник: ${SRC} · узлов ${nn} · отрезков ${live.length - cl}${cl ? ` + закрытых ${cl}` : ''} · лифтов ${D.lifts.length} · щитов воды ${D.water.length} · точек старта ${D.starts.length}${extra ? ' · ' + extra : ''}`;
  $('srcNote').textContent = 'Сейчас загружено: ' + SRC;
}
function renderAll() { renderGraph(); renderMarks(); renderRoute(); renderRubber(); setStats(); renderProps(); if (tab === 'objs') renderObjs(); }

/* ================= инструменты ================= */
const ICON = {
  move: '<path d="M5 3l14 7-6 2-2 6z"/>', draw: '<path d="M4 20l5-2 10-10-3-3L6 15z"/><path d="M14 6l3 3"/>',
  delete: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', close: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M8 9V6a4 4 0 018 0v3"/>',
  route: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5a3 3 0 000-6h-2a3 3 0 010-6h5"/>',
  lift: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 10l3-3 3 3M9 14l3 3 3-3"/>',
  water: '<path d="M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z"/>', start: '<path d="M6 21V4h10l-2 4 2 4H6"/>'
};
const TOOLS = [['move', 'Выбрать и двигать (V)', 'V'], ['draw', 'Рисовать дорожку (D)', 'D'], ['delete', 'Удалить (X)', 'X'], ['close', 'Закрыть / открыть проход (C)', 'C'], ['route', 'Проверить маршрут (R)', 'R'], null, ['lift', 'Поставить лифт (L)', 'L'], ['water', 'Поставить щит воды (W)', 'W'], ['start', 'Точка «Откуда» (S)', 'S']];
const HINT = {
  move: 'Перетаскивайте узлы, лестницы, лифты, щиты и точки старта. Клик по значку — свойства. Пустое место тянется — план двигается.',
  draw: 'Кликайте по точкам дорожки. Начало и конец прилипают к узлам и отрезкам. <b>Enter</b>, <b>Esc</b> или повторный клик по последней точке — закончить линию.',
  delete: 'Клик по узлу удаляет его со всеми отрезками, клик по отрезку — только отрезок.',
  close: 'Клик по отрезку закрывает его (калитка, нет прохода) — красный пунктир. Повторный клик открывает.',
  route: 'Кликните старт и финиш — маршрут построится так же, как в навигаторе.',
  lift: 'Клик — новый лифт. Его привязка к лестнице выбирается справа.', water: 'Клик — новый щит воды. Справа укажите квартиры, которые он обслуживает.',
  start: 'Клик — новая точка «Откуда». Названия на четырёх языках задаются справа.'
};
const tb = $('tools');
TOOLS.forEach(t => { if (!t) { tb.appendChild(document.createElement('hr')); return; }
  const b = document.createElement('button'); b.type = 'button'; b.dataset.t = t[0]; b.title = t[1]; b.setAttribute('aria-label', t[1]);
  b.innerHTML = `<svg viewBox="0 0 24 24">${ICON[t[0]]}</svg><kbd>${t[2]}</kbd>`; b.onclick = () => setTool(t[0]); tb.appendChild(b); });
function setTool(t) { finishDraw(); tool = t; [...tb.querySelectorAll('button')].forEach(b => b.classList.toggle('on', b.dataset.t === t)); svg.setAttribute('class', 't-' + t);
  $('hud').innerHTML = HINT[t]; if (t !== 'route') { route = null; renderRoute(); } }
function finishDraw() { if (drawing) { drawing = null; gc(); renderRubber(); renderGraph(); setStats(); } }

/* ================= мышь / касания ================= */
const ptrs = new Map(); let down = null, pinch = null, drag = null;
function hitMarker(p) { const r = R() * 1.3; let best = null, bd = r;
  const test = (x, y, key) => { const d = Math.hypot(p[0] - x, p[1] - y); if (d < bd) { bd = d; best = key; } };
  D.water.forEach((w, i) => test(w.x, w.y, 'water:' + i)); D.lifts.forEach((l, i) => test(l.x, l.y, 'lift:' + i));
  D.starts.forEach((s, i) => test(s.x, s.y, 'start:' + i)); for (const [id, q] of Object.entries(D.stairs)) test(q[0], q[1], 'stair:' + id);
  return best; }
function markerPos(key) { const [t, k] = key.split(/:(.*)/s); if (t === 'stair') return D.stairs[k]; const o = { water: D.water, lift: D.lifts, start: D.starts }[t][+k]; return o; }
function moveMarker(key, p) { const [t, k] = key.split(/:(.*)/s); if (t === 'stair') { D.stairs[k] = [p[0], p[1]]; return; } const o = { water: D.water, lift: D.lifts, start: D.starts }[t][+k]; o.x = p[0]; o.y = p[1]; }
svg.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, px, py); }, { passive: false });
svg.addEventListener('pointerdown', e => {
  try { svg.setPointerCapture(e.pointerId); } catch (_) { /* синтетические события */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); down = null; drag = null; return; }
  const p = toSvg(e.clientX, e.clientY); down = { x: e.clientX, y: e.clientY, vb: [...vb], moved: 0, p };
  if (tool === 'move') {
    const m = hitMarker(p); if (m) { drag = { kind: 'marker', key: m, snapped: false }; return; }
    const n = nearNode(p, R()); if (n >= 0) { drag = { kind: 'node', i: n, snapped: false }; return; }
  }
});
svg.addEventListener('pointermove', e => {
  const p = toSvg(e.clientX, e.clientY); cursorPt = p;
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const [px, py] = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomAt(pinch / d, px, py); pinch = d; return; }
  if (down) {
    down.moved = Math.max(down.moved, Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y));
    if (drag && down.moved > 3) {
      if (!drag.snapped) { snap(); drag.snapped = true; }
      if (drag.kind === 'node') { D.nodes[drag.i] = [p[0], p[1]]; renderGraph(); }
      else { moveMarker(drag.key, p); renderMarks(); }
      return;
    }
    if (!drag && down.moved > 6) { const s = Math.max(down.vb[2] / svg.getBoundingClientRect().width, down.vb[3] / svg.getBoundingClientRect().height);
      vb = [down.vb[0] - (e.clientX - down.x) * s, down.vb[1] - (e.clientY - down.y) * s, down.vb[2], down.vb[3]]; setVB(); return; }
    return;
  }
  if (e.pointerType !== 'mouse') return;
  // подсветка под курсором
  let h = null;
  if (['move', 'draw', 'delete'].includes(tool)) { const n = nearNode(p, R()); if (n >= 0) h = { node: n }; }
  if (!h && ['draw', 'delete', 'close'].includes(tool)) { const ed = nearEdge(p, R()); if (ed) h = { edge: ed.i }; }
  const key = h ? JSON.stringify(h) : '';
  if (key !== (hover ? JSON.stringify(hover) : '')) { hover = h; renderGraph(); }
  renderRubber();
});
function endPtr(e) {
  ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
  if (!down) return;
  const wasClick = down.moved < 6, p = toSvg(e.clientX, e.clientY);
  if (drag && drag.snapped) { if (drag.kind === 'node') { D.nodes[drag.i] = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; } changed(); }
  else if (drag && wasClick && drag.kind === 'marker') { select(drag.key); }
  else if (wasClick) click(p);
  down = null; drag = null;
}
svg.addEventListener('pointerup', endPtr);
svg.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); down = null; drag = null; pinch = null; });

function click(p) {
  switch (tool) {
    case 'move': { const m = hitMarker(p); if (m) select(m); else { sel = null; renderMarks(); renderProps(); } break; }
    case 'draw': {
      if (!drawing) { snap(); drawing = { last: null }; }
      const before = drawing.last;
      if (before !== null && D.nodes[before] && dist(p, D.nodes[before]) < R()) { finishDraw(); changed(); toast('Линия добавлена'); break; }
      const id = resolve(p);
      if (before !== null && before !== id) addEdge(before, id);
      drawing.last = id; renderGraph(); renderRubber(); setStats('рисование: Enter — закончить'); break;
    }
    case 'delete': {
      const n = nearNode(p, R()); if (n >= 0) { snap(); deleteNode(n); gc(); changed(); break; }
      const m = hitMarker(p); if (m && !m.startsWith('stair:')) { snap(); removeMarker(m); changed(); break; }
      const ed = nearEdge(p, R()); if (ed) { snap(); D.edges[ed.i].dead = true; gc(); changed(); }
      break;
    }
    case 'close': { const ed = nearEdge(p, R()); if (ed) { snap(); D.edges[ed.i].closed = !D.edges[ed.i].closed; changed(); toast(D.edges[ed.i].closed ? 'Проход закрыт' : 'Проход открыт'); } break; }
    case 'route': {
      if (!route || route.b) route = { a: p, b: null, path: null };
      else { route.b = p; const adj = graphAdj(), sa = liveNear(route.a), sb = liveNear(route.b); const r = dijkstra(adj, sa);
        if (r.d[sb] === Infinity) { route.path = null; toast('Маршрута нет: точки в разных кусках сети'); }
        else { const path = []; for (let u = sb; u !== -1; u = r.pv[u]) path.unshift(D.nodes[u]); route.path = [route.a, ...path, route.b];
          const L = (r.d[sb] + dist(route.a, D.nodes[sa]) + dist(route.b, D.nodes[sb])) * MPP; toast(`Маршрут ≈ ${Math.round(L)} м`); $('hud').innerHTML = `${HINT.route}<br>Последний: <b>≈ ${Math.round(L)} м</b>`; } }
      renderRoute(); break;
    }
    case 'lift': case 'water': case 'start': {
      const m = hitMarker(p); if (m && m.startsWith(tool + ':')) { select(m); break; }
      snap(); const key = create(tool, p); changed(); select(key); break;
    }
  }
}
function nearestStair(p) { let best = null, bd = Infinity; for (const [id, q] of Object.entries(D.stairs)) { const d = dist(p, q); if (d < bd) { bd = d; best = id; } } return best; }
function nearestStack(p) { let best = -1, bd = Infinity; Z.stacks.forEach((s, i) => { const d = dist(p, s.c); if (d < bd) { bd = d; best = i; } }); return best; }
function create(kind, p) {
  if (kind === 'lift') { const st = nearestStair(p); const n = D.lifts.filter(l => l.stair_id === st).length;
    D.lifts.push({ id: 'L-' + st + (n ? '-' + (n + 1) : ''), block: st.split('-E')[0], stair_id: st, floors: '0-3', serves: '', note: '', x: p[0], y: p[1] }); return 'lift:' + (D.lifts.length - 1); }
  if (kind === 'water') { const s = Z.stacks[nearestStack(p)]; const b = s ? s.block : ''; const n = D.water.filter(w => w.block === b).length + 1;
    D.water.push({ id: `W-${b}-0-${n}`, block: b, floor: 0, place: 'galería', kind: 'contadores', serves: '', note: '', photo: '', x: p[0], y: p[1] }); return 'water:' + (D.water.length - 1); }
  const n = D.starts.length + 1; D.starts.push({ id: 'start' + n, x: p[0], y: p[1], name: Object.fromEntries(LANGS.map(l => [l, 'Punto ' + n])) }); return 'start:' + (D.starts.length - 1);
}
function removeMarker(key) { const [t, k] = key.split(/:(.*)/s); ({ water: D.water, lift: D.lifts, start: D.starts })[t].splice(+k, 1); if (sel && sel.key === key) sel = null; }
function select(key) { sel = { key }; showTab('props'); renderMarks(); renderProps(); }

document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
  if (e.key === 'Enter' || e.key === 'Escape') { if (drawing) { finishDraw(); changed(); } else if (e.key === 'Escape') { sel = null; route = null; renderAll(); } return; }
  const t = TOOLS.find(t => t && t[2].toLowerCase() === e.key.toLowerCase()); if (t) setTool(t[0]);
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !sel.key.startsWith('stair:')) { snap(); removeMarker(sel.key); changed(); }
});
$('undo').onclick = undo; $('undo').disabled = true;
['vNodes', 'vDangle'].forEach(id => $(id).onchange = renderGraph);
$('vNums').onchange = e => { G.nums.style.display = e.target.checked ? '' : 'none'; };
$('vRaster').onchange = e => { G.raster.style.display = e.target.checked ? '' : 'none'; };

/* ================= боковая панель ================= */
let tab = 'props';
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
function showTab(t) { tab = t; document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t)); ['props', 'objs', 'check', 'pub'].forEach(k => $('p-' + k).hidden = k !== t); if (t === 'objs') renderObjs(); }
const aptsOfStair = st => Z.units.filter(u => u.kind === 'apt' && Z.stacks[u.stack].stair === st);
function field(label, html) { return `<div class="f"><label class="lbl">${label}</label>${html}</div>`; }
const inp = (k, v, ph = '') => `<input data-k="${k}" value="${esc(v)}" placeholder="${esc(ph)}">`;
const selc = (k, v, opts) => `<select data-k="${k}">${opts.map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
function renderProps() {
  const p = $('p-props');
  if (!sel || !markerPos(sel.key)) {
    const live = D.edges.filter(e => !e.dead).length;
    p.innerHTML = `<div class="lbl">Инструмент</div><div>${HINT[tool]}</div>
      <div class="note">Колесо мыши или два пальца — масштаб; перетаскивание пустого места — сдвиг плана. Ctrl+Z — отменить.</div>
      <div class="lbl">Подсказки</div>
      <div class="note">• Оранжевые точки — висячие концы: дорожка обрывается. Это нормально только у тупиков.<br>
      • Развилка — общий узел. Начинайте и заканчивайте линию на существующем узле или отрезке.<br>
      • Лишний проход лучше <b>закрыть</b>, а не удалять: так видно, что он проверен.<br>
      • Сейчас в сети ${live} отрезков.</div>`;
    return;
  }
  const [t, k] = sel.key.split(/:(.*)/s);
  if (t === 'stair') {
    const n = aptsOfStair(k).length;
    p.innerHTML = `<div class="lbl">Лестница</div><div class="mono" style="font-size:20px">${esc(k)}</div>
      <div class="note">Идентификатор не меняется — на него ссылаются квартиры (${n} шт.). Перетащите значок, если он стоит не на месте; маршрут ведёт к ближайшему узлу сети.</div>`;
    return;
  }
  const o = markerPos(sel.key);
  let html = '';
  if (t === 'lift') {
    const n = aptsOfStair(o.stair_id).length;
    html = `<div class="lbl">Лифт</div>
      ${field('Номер (id)', inp('id', o.id, 'L-15-E1'))}
      ${field('Лестница', selc('stair_id', o.stair_id, Object.keys(D.stairs)))}
      <div class="note">По умолчанию лифт обслуживает все квартиры этой лестницы (${n} шт.).</div>
      ${field('Этажи', inp('floors', o.floors, '0-3'))}
      ${field('Только эти квартиры (необязательно)', `<textarea data-k="serves" placeholder="449 443 437">${esc(o.serves)}</textarea>`)}
      ${field('Примечание (видно в карточке)', inp('note', o.note, 'llave en conserjería'))}`;
  } else if (t === 'water') {
    html = `<div class="lbl">Щит воды</div>
      ${field('Номер (id)', inp('id', o.id, 'W-15-3-1'))}
      <div class="row2">${field('Корпус', selc('block', o.block, [...new Set(Z.stacks.map(s => s.block))]))}${field('Этаж', selc('floor', o.floor, [0, 1, 2, 3]))}</div>
      <div class="row2">${field('Где', selc('place', o.place, ['galería', 'portal', 'escalera', 'sótano', 'exterior']))}${field('Что внутри', selc('kind', o.kind, ['contadores', 'llave de corte', 'ambos']))}</div>
      ${field('Квартиры', `<textarea data-k="serves" placeholder="449 443 437">${esc(o.serves)}</textarea>`)}
      <div style="display:flex;flex-wrap:wrap;gap:6px"><button class="btn" type="button" id="fillStair">+ квартиры ближайшей лестницы на этом этаже</button><button class="btn" type="button" id="fillStack">+ квартиры ближайшего стояка</button></div>
      ${field('Примечание', inp('note', o.note))}
      ${field('Фото (ссылка, необязательно)', inp('photo', o.photo, 'https://…'))}`;
  } else {
    html = `<div class="lbl">Точка «Откуда»</div>${field('Код (id)', inp('id', o.id))}` + LANGS.map(l => field('Название · ' + l.toUpperCase(), `<input data-name="${l}" value="${esc(o.name[l])}">`)).join('');
  }
  p.innerHTML = html + `<div style="display:flex;gap:8px;margin-top:6px"><button class="btn" id="zoomSel" type="button">Показать на плане</button><button class="btn danger" id="delSel" type="button">Удалить</button></div>`;
  let snapped = false; const once = () => { if (!snapped) { snap(); snapped = true; } };
  p.querySelectorAll('[data-k]').forEach(i => i.addEventListener('input', () => { once(); o[i.dataset.k] = i.dataset.k === 'floor' ? +i.value : i.value; dirty = true; setStats(); clearTimeout(saveT); saveT = setTimeout(() => store.set(DRAFT, JSON.stringify({ t: Date.now(), d: toFile() })), 500); if (i.tagName === 'SELECT') renderProps(); }));
  p.querySelectorAll('[data-name]').forEach(i => i.addEventListener('input', () => { once(); o.name[i.dataset.name] = i.value; dirty = true; }));
  const add = list => { once(); const cur = new Set(String(o.serves || '').split(/[\s,;]+/).filter(Boolean)); list.forEach(n => cur.add(String(n))); o.serves = [...cur].sort((a, b) => a - b).join(' '); changed(); };
  if ($('fillStair')) $('fillStair').onclick = () => { const st = nearestStair([o.x, o.y]); add(aptsOfStair(st).filter(u => u.floor === +o.floor).map(u => u.num)); };
  if ($('fillStack')) $('fillStack').onclick = () => { const si = nearestStack([o.x, o.y]); add(Z.units.filter(u => u.kind === 'apt' && u.stack === si).map(u => u.num)); };
  $('delSel').onclick = () => { snap(); removeMarker(sel.key); changed(); };
  $('zoomSel').onclick = () => fitBox(o.x - 150, o.y - 110, o.x + 150, o.y + 110);
}
function renderObjs() {
  const sec = (title, arr, type, sub) => `<div class="lbl">${title} · ${arr.length}</div>` + (arr.length ? `<div class="list">${arr.map((o, i) =>
    `<div data-key="${type}:${i}" class="${sel && sel.key === type + ':' + i ? 'on' : ''}"><b class="mono">${esc(o.id)}</b><span>${esc(sub(o))}</span></div>`).join('')}</div>` : '<div class="note">пока нет</div>');
  $('p-objs').innerHTML = sec('Лифты', D.lifts, 'lift', o => `${o.stair_id}${o.note ? ' · ' + o.note : ''}`) +
    sec('Щиты воды', D.water, 'water', o => `корп. ${o.block}, эт. ${o.floor}, ${String(o.serves || '').split(/[\s,;]+/).filter(Boolean).length} кв.`) +
    sec('Точки «Откуда»', D.starts, 'start', o => o.name.ru || o.name.es || '');
  $('p-objs').querySelectorAll('[data-key]').forEach(d => d.onclick = () => { const o = markerPos(d.dataset.key); select(d.dataset.key); fitBox(o.x - 150, o.y - 110, o.x + 150, o.y + 110); });
}

/* ================= проверка ================= */
$('runCheck').onclick = () => {
  const adj = graphAdj(), live = D.nodes.map((n, i) => n && adj[i].length ? i : -1).filter(i => i >= 0);
  const comp = new Map(); let nc = 0; const sizes = [];
  for (const s of live) { if (comp.has(s)) continue; let c = 0; const st = [s]; comp.set(s, nc); while (st.length) { const u = st.pop(); c++; for (const [v] of adj[u]) if (!comp.has(v)) { comp.set(v, nc); st.push(v); } } sizes.push(c); nc++; }
  const main = sizes.indexOf(Math.max(...sizes));
  const g = degree(), dang = D.nodes.filter((n, i) => n && g[i] === 1).length;
  const near = p => liveNear(p);
  const out = [];
  out.push(nc === 1 ? '<div class="ok">✓ Сеть связная — один кусок.</div>' : `<div class="bad">✗ Кусков сети: ${nc}. Мелкие оторванные: ${sizes.filter((s, i) => i !== main).map(s => s + ' узл.').join(', ')}</div>`);
  out.push(`<div>${dang ? `Висячих концов: <b>${dang}</b> (оранжевые). Проверьте, что это настоящие тупики.` : '<span class="ok">✓ Висячих концов нет.</span>'}</div>`);
  let bad = 0;
  for (const s of D.starts) {
    const r = dijkstra(adj, near([s.x, s.y])), miss = [];
    let far = null, fd = 0;
    for (const [id, q] of Object.entries(D.stairs)) { const d = r.d[near(q)]; if (d === Infinity) miss.push(id); else if (d > fd) { fd = d; far = id; } }
    bad += miss.length;
    out.push(`<div>${miss.length ? '<span class="bad">✗</span>' : '<span class="ok">✓</span>'} <b>${esc(s.name.ru || s.id)}</b>: ${miss.length ? 'недостижимы ' + miss.join(', ') : `все лестницы, самая дальняя ${far} ≈ ${Math.round(fd * MPP)} м`}</div>`);
  }
  for (const [id, q] of Object.entries(D.stairs)) { const n = near(q); const d = dist(q, D.nodes[n]) * MPP; if (d > 6) { bad++; } if (d > 6) out.push(`<div class="bad">Лестница ${id}: до ближайшей дорожки ${Math.round(d)} м — дорисуйте подход.</div>`); }
  const unknown = D.lifts.filter(l => !D.stairs[l.stair_id]); if (unknown.length) bad++; if (unknown.length) out.push(`<div class="bad">Лифты с неизвестной лестницей: ${unknown.map(l => l.id).join(', ')}</div>`);
  const ids = [...D.lifts, ...D.water].map(o => o.id), dup = ids.filter((v, i) => ids.indexOf(v) !== i); if (dup.length) bad++; if (dup.length) out.push(`<div class="bad">Повторяющиеся номера: ${[...new Set(dup)].join(', ')}</div>`);
  out.push(`<div class="note">${bad || nc > 1 ? 'Исправьте отмеченное и проверьте снова.' : 'Можно публиковать.'}</div>`);
  $('checkRes').innerHTML = out.join('');
};

/* ================= файл ================= */
$('save').onclick = () => {
  const f = toFile(), blob = new Blob([JSON.stringify(f)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'edits.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  dirty = false; toast('Файл edits.json скачан');
};
$('fileIn').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try { const f = JSON.parse(await file.text()); snap(); D = fromFile(f); SRC = `${file.name} от ${new Date(f.updated).toLocaleString('ru')}`; sel = null; route = null; changed(); fitAll(); toast('Файл загружен'); }
  catch (err) { toast('Не получилось открыть файл: ' + err.message); }
  e.target.value = '';
};
$('preview').onclick = () => {
  if (!store.set(PREVIEW, JSON.stringify(toFile()))) { toast('Браузер не дал сохранить предпросмотр'); return; }
  window.open('../?preview=1&mode=pro', '_blank', 'noopener');
};
$('reset').onclick = () => { if (!$('reset').dataset.armed) { $('reset').dataset.armed = 1; $('reset').textContent = 'Точно сбросить? Нажмите ещё раз'; setTimeout(() => { delete $('reset').dataset.armed; $('reset').textContent = 'Сбросить к опубликованным данным'; }, 4000); return; }
  snap(); loadPublished(); store.del(DRAFT); sel = null; route = null; renderAll(); fitAll(); toast('Загружены опубликованные данные'); delete $('reset').dataset.armed; $('reset').textContent = 'Сбросить к опубликованным данным'; };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

setTool('move'); renderAll(); requestAnimationFrame(fitAll);
})();
