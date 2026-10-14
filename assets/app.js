/* FlamencaDemoPlan — навигатор ЖК.
 * Два интерфейса: Simple (по умолчанию, для смартфона) и Pro (слои, этажи, реестр).
 * Языки: es, en, fr, ru. Данные — window.ZHK из data/plan-data.js (tools/build.py). */
(() => {
'use strict';
const $ = id => document.getElementById(id);
if (!window.ZHK) { $('info').textContent = 'data/plan-data.js not found — run: python tools/build.py'; return; }
const { config: CFG, vector: VEC, stacks: STK } = window.ZHK;

/* ================= i18n ================= */
const I18N = {
  es: {
    m: 'm', aptNumber: 'Número de apartamento', to: 'Destino', from: 'Desde', onMap: 'En el plano', search: 'Buscar',
    floorOnPlan: 'Planta en el plano', showWhich: 'Apartamentos visibles', all: 'Todos', block: 'Bloque', apt: 'Apartamento',
    layers: 'Capas', pickHint: 'Toque el plano: la salida se coloca en el camino más cercano',
    zin: 'Acercar', zout: 'Alejar', zfit: 'Ver todo el plano',
    enterNum: 'Introduzca el número del apartamento', notFound: n => `No hay apartamento ${n}. Números disponibles: ${MIN}–${MAX}.`,
    simpleEmpty: 'Escriba el número del apartamento y pulse «Buscar». Verá la escalera, el ascensor y el camino en el plano.',
    proEmpty: 'Elija un apartamento en la búsqueda, en la tabla o tocando un bloque del plano.',
    staircase: 'Escalera', lift: 'Ascensor', liftN: n => `Nº ${n}`, liftNear: n => `junto a la escalera ${n}`, noLift: 'no hace falta',
    floor: 'Planta', groundFloor: 'planta baja', floorN: n => n === 0 ? 'Planta baja' : `Planta ${n}`,
    walk: 'a pie', minutes: m => `~${m} min`, onSite: 'por el recinto', bld: b => `Bloque ${b}`,
    liftNote: '* El ascensor no figura en el plano: se supone junto a cada escalera.',
    escUnlabeled: 'sin rótulo en el plano',
    start: s => `Salida: ${s}`, entrance: (b, n) => `Entrada: bloque ${b}, escalera ${n}`, levelEntry: 'Apartamento a nivel de la entrada (planta baja)',
    goUp: f => `Ascensor o escalera hasta la planta ${f}`, door: (c, s) => `Puerta ${c}, columna ${s}`, pointOnMap: 'punto en el plano',
    showRoute: 'Ver todo el recorrido', floorLevel: ' (nivel de entrada)', toFloor: f => ` → planta ${f}`,
    tableTitle: 'Apartamentos por planta y acceso', copyCsv: 'Copiar CSV', copied: 'Copiado', noClipboard: 'Portapapeles no disponible',
    allBlocks: 'Todos los bloques', allFloors: 'Todas', pb: '0 (PB)', flShort: f => `${f}ª`, filterCode: 'Filtrar por código', of: (a, b) => `${a} de ${b}`,
    th: ['Nº', 'Código', 'Bloque', 'Planta', 'Columna', 'Escalera más cercana', 'Ascensor*', 'Cómo llegar', 'Desde la entrada'],
    presets: ['Todo', 'Navegación', 'Solo apartamentos', 'Comparar con el original'],
    groups: ['Apartamentos', 'Edificios', 'Recinto', 'Servicio'],
    ly: { apts: 'Bloques de apartamentos', aptlabels: 'Números', plain: 'Colores por escalera', esc: 'Escaleras (E1/E2)', bld: 'Edificios y terrazas', gallery: 'Galerías y núcleos de escalera',
      walk: 'Caminos peatonales', road: 'Viales', parking: 'Aparcamiento', lawn: 'Zonas verdes', pool: 'Piscina', site: 'Fondo de la parcela', sitebound: 'Límite de la parcela',
      neighbour: 'Parcela vecina', labels: 'Rótulos', graph: 'Red de caminos', raster: 'Plano original (imagen)' },
    rasterOpacity: 'Opacidad del plano original',
    foot: 'Plano vectorizado a partir de una imagen; distancias aproximadas (~0,1 m por píxel). La planta se deduce del código: A3a-449 → planta 3.'
  },
  en: {
    m: 'm', aptNumber: 'Apartment number', to: 'Destination', from: 'From', onMap: 'On the map', search: 'Search',
    floorOnPlan: 'Floor on the plan', showWhich: 'Visible apartments', all: 'All', block: 'Block', apt: 'Apartment',
    layers: 'Layers', pickHint: 'Tap the plan: the start snaps to the nearest path',
    zin: 'Zoom in', zout: 'Zoom out', zfit: 'Show the whole plan',
    enterNum: 'Enter the apartment number', notFound: n => `There is no apartment ${n}. Available numbers: ${MIN}–${MAX}.`,
    simpleEmpty: 'Type the apartment number and tap “Search”. You will see the staircase, the lift and the route on the plan.',
    proEmpty: 'Pick an apartment in the search, in the table or by tapping a block on the plan.',
    staircase: 'Staircase', lift: 'Lift', liftN: n => `No. ${n}`, liftNear: n => `next to staircase ${n}`, noLift: 'not needed',
    floor: 'Floor', groundFloor: 'ground floor', floorN: n => n === 0 ? 'Ground floor' : `Floor ${n}`,
    walk: 'on foot', minutes: m => `~${m} min`, onSite: 'across the site', bld: b => `Block ${b}`,
    liftNote: '* Lifts are not marked on the plan; one is assumed next to each staircase.',
    escUnlabeled: 'not labelled on the plan',
    start: s => `Start: ${s}`, entrance: (b, n) => `Entrance: block ${b}, staircase ${n}`, levelEntry: 'Apartment at entrance level (ground floor)',
    goUp: f => `Lift or stairs to floor ${f}`, door: (c, s) => `Door ${c}, stack ${s}`, pointOnMap: 'point on the map',
    showRoute: 'Show the whole route', floorLevel: ' (entrance level)', toFloor: f => ` → floor ${f}`,
    tableTitle: 'Apartments by floor and access', copyCsv: 'Copy CSV', copied: 'Copied', noClipboard: 'Clipboard unavailable',
    allBlocks: 'All blocks', allFloors: 'All floors', pb: '0 (GF)', flShort: f => `fl. ${f}`, filterCode: 'Filter by code', of: (a, b) => `${a} of ${b}`,
    th: ['No.', 'Code', 'Block', 'Floor', 'Stack', 'Nearest staircase', 'Lift*', 'How to get there', 'From entrance'],
    presets: ['Everything', 'Navigation', 'Apartments only', 'Compare with original'],
    groups: ['Apartments', 'Buildings', 'Grounds', 'Service'],
    ly: { apts: 'Apartment blocks', aptlabels: 'Numbers', plain: 'Colour by staircase', esc: 'Staircases (E1/E2)', bld: 'Buildings and terraces', gallery: 'Galleries and stair cores',
      walk: 'Footpaths', road: 'Driveways', parking: 'Parking', lawn: 'Greenery', pool: 'Pool', site: 'Site background', sitebound: 'Site boundary',
      neighbour: 'Neighbouring plot', labels: 'Labels', graph: 'Path network', raster: 'Original plan (image)' },
    rasterOpacity: 'Original plan opacity',
    foot: 'Plan vectorised from an image; distances are approximate (~0.1 m per pixel). The floor is taken from the code: A3a-449 → floor 3.'
  },
  fr: {
    m: 'm', aptNumber: 'Numéro d’appartement', to: 'Destination', from: 'Départ', onMap: 'Sur le plan', search: 'Rechercher',
    floorOnPlan: 'Étage sur le plan', showWhich: 'Appartements affichés', all: 'Tous', block: 'Bâtiment', apt: 'Appartement',
    layers: 'Calques', pickHint: 'Touchez le plan : le départ se place sur l’allée la plus proche',
    zin: 'Zoom avant', zout: 'Zoom arrière', zfit: 'Voir tout le plan',
    enterNum: 'Saisissez le numéro de l’appartement', notFound: n => `Aucun appartement ${n}. Numéros disponibles : ${MIN}–${MAX}.`,
    simpleEmpty: 'Saisissez le numéro de l’appartement et touchez « Rechercher ». L’escalier, l’ascenseur et l’itinéraire s’afficheront sur le plan.',
    proEmpty: 'Choisissez un appartement dans la recherche, le tableau ou en touchant un bloc du plan.',
    staircase: 'Escalier', lift: 'Ascenseur', liftN: n => `N° ${n}`, liftNear: n => `à côté de l’escalier ${n}`, noLift: 'inutile',
    floor: 'Étage', groundFloor: 'rez-de-chaussée', floorN: n => n === 0 ? 'Rez-de-chaussée' : `${n}${n === 1 ? 'er' : 'e'} étage`,
    walk: 'à pied', minutes: m => `~${m} min`, onSite: 'dans la résidence', bld: b => `Bâtiment ${b}`,
    liftNote: '* Les ascenseurs ne figurent pas sur le plan ; on suppose un ascenseur à côté de chaque escalier.',
    escUnlabeled: 'non indiqué sur le plan',
    start: s => `Départ : ${s}`, entrance: (b, n) => `Entrée : bâtiment ${b}, escalier ${n}`, levelEntry: 'Appartement au niveau de l’entrée (rez-de-chaussée)',
    goUp: f => `Ascenseur ou escalier jusqu’au ${f}${f === 1 ? 'er' : 'e'} étage`, door: (c, s) => `Porte ${c}, colonne ${s}`, pointOnMap: 'point sur le plan',
    showRoute: 'Voir tout l’itinéraire', floorLevel: ' (niveau d’entrée)', toFloor: f => ` → ${f}${f === 1 ? 'er' : 'e'} étage`,
    tableTitle: 'Appartements par étage et accès', copyCsv: 'Copier en CSV', copied: 'Copié', noClipboard: 'Presse-papiers indisponible',
    allBlocks: 'Tous les bâtiments', allFloors: 'Tous', pb: '0 (RDC)', flShort: f => `${f}${f === 1 ? 'er' : 'e'}`, filterCode: 'Filtrer par code', of: (a, b) => `${a} sur ${b}`,
    th: ['N°', 'Code', 'Bâtiment', 'Étage', 'Colonne', 'Escalier le plus proche', 'Ascenseur*', 'Comment y aller', 'Depuis l’entrée'],
    presets: ['Tout', 'Navigation', 'Appartements seuls', 'Comparer à l’original'],
    groups: ['Appartements', 'Bâtiments', 'Résidence', 'Service'],
    ly: { apts: 'Blocs d’appartements', aptlabels: 'Numéros', plain: 'Couleur par escalier', esc: 'Escaliers (E1/E2)', bld: 'Bâtiments et terrasses', gallery: 'Coursives et cages d’escalier',
      walk: 'Allées piétonnes', road: 'Voies', parking: 'Parking', lawn: 'Espaces verts', pool: 'Piscine', site: 'Fond de parcelle', sitebound: 'Limite de parcelle',
      neighbour: 'Parcelle voisine', labels: 'Étiquettes', graph: 'Réseau d’allées', raster: 'Plan original (image)' },
    rasterOpacity: 'Opacité du plan original',
    foot: 'Plan vectorisé à partir d’une image ; distances approximatives (~0,1 m par pixel). L’étage est déduit du code : A3a-449 → 3e étage.'
  },
  ru: {
    m: 'м', aptNumber: 'Номер квартиры', to: 'Куда', from: 'Откуда', onMap: 'На плане', search: 'Искать',
    floorOnPlan: 'Этаж на плане', showWhich: 'Какие квартиры показывать', all: 'Все', block: 'Корпус', apt: 'Квартира',
    layers: 'Слои', pickHint: 'Нажмите на план — старт встанет на ближайшую дорожку',
    zin: 'Приблизить', zout: 'Отдалить', zfit: 'Показать весь план',
    enterNum: 'Введите номер квартиры', notFound: n => `Квартиры ${n} нет. Доступные номера: ${MIN}–${MAX}.`,
    simpleEmpty: 'Введите номер квартиры и нажмите «Искать» — покажем лестницу, лифт и маршрут на плане.',
    proEmpty: 'Выберите квартиру в поиске, в таблице ниже или кликом по блоку на плане.',
    staircase: 'Лестница', lift: 'Лифт', liftN: n => `№ ${n}`, liftNear: n => `у лестницы ${n}`, noLift: 'не нужен',
    floor: 'Этаж', groundFloor: 'planta baja', floorN: n => n === 0 ? 'Этаж 0 (planta baja)' : `Этаж ${n}`,
    walk: 'пешком', minutes: m => `~${m} мин`, onSite: 'по территории', bld: b => `Корпус ${b}`,
    liftNote: '* Лифты на плане не обозначены; принято, что лифт стоит у каждой лестницы.',
    escUnlabeled: 'на плане без подписи',
    start: s => `Старт: ${s}`, entrance: (b, n) => `Вход: корпус ${b}, лестница ${n}`, levelEntry: 'Квартира на уровне входа (planta baja)',
    goUp: f => `Лифт или лестница на ${f} этаж`, door: (c, s) => `Дверь ${c}, стояк ${s}`, pointOnMap: 'точка на плане',
    showRoute: 'Показать маршрут целиком', floorLevel: ' (уровень входа)', toFloor: f => ` → ${f} этаж`,
    tableTitle: 'Квартиры по этажам и доступ', copyCsv: 'Копировать CSV', copied: 'Скопировано', noClipboard: 'Буфер недоступен',
    allBlocks: 'Все корпуса', allFloors: 'Все этажи', pb: '0 (PB)', flShort: f => `${f} эт.`, filterCode: 'Фильтр по коду', of: (a, b) => `${a} из ${b}`,
    th: ['№', 'Код', 'Корпус', 'Этаж', 'Стояк', 'Ближайшая лестница', 'Лифт*', 'Как пройти', 'От входа'],
    presets: ['Всё', 'Навигация', 'Только квартиры', 'Сверка с исходником'],
    groups: ['Квартиры', 'Здания', 'Территория', 'Служебное'],
    ly: { apts: 'Блоки квартир', aptlabels: 'Номера квартир', plain: 'Окраска по лестницам', esc: 'Лестницы (E1/E2)', bld: 'Корпуса и террасы', gallery: 'Галереи и лестничные ядра',
      walk: 'Пешеходные дорожки', road: 'Проезды', parking: 'Парковка', lawn: 'Озеленение', pool: 'Бассейн', site: 'Фон участка', sitebound: 'Граница участка',
      neighbour: 'Соседний участок', labels: 'Подписи', graph: 'Сеть маршрутов', raster: 'Исходный план (картинка)' },
    rasterOpacity: 'Прозрачность исходного плана',
    foot: 'План векторизован из картинки; расстояния приблизительные (~0,1 м на пиксель). Этаж берётся из кода: A3a-449 → 3-й этаж.'
  }
};
const LANGS = Object.keys(I18N);
const store = {
  get(k) { try { return localStorage.getItem('fdp.' + k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem('fdp.' + k, v); } catch (_) { /* приватный режим */ } }
};
const params = new URLSearchParams(location.search);
function pickLang() {
  const cand = [params.get('lang'), store.get('lang'), ...(navigator.languages || [navigator.language || ''])];
  for (const c of cand) { const l = (c || '').slice(0, 2).toLowerCase(); if (LANGS.includes(l)) return l; }
  return (CFG.languages && CFG.languages[0]) || 'es';
}
let LANG = pickLang();
const T = k => I18N[LANG][k] ?? I18N.en[k];
const tr = v => (v && typeof v === 'object') ? (v[LANG] || v.en || Object.values(v)[0]) : v;

/* ================= данные ================= */
const M_PER_PX = CFG.image.metersPerPx, WALK = CFG.walkSpeed;
const ESC = CFG.escaleras;
const N = CFG.network.nodes, E = CFG.network.edges, STEPNAME = CFG.network.stepNames;
const ESCNODE = Object.fromEntries(Object.entries(ESC).map(([k, e]) => [k, e.node]));
const STACKS = CFG.stacks.map((s, i) => ({ b: s.building, codes: s.units, r: s.cut, ...STK[i] }));

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

const APTS = [];
STACKS.forEach((s, si) => {
  const base = s.b.split('.')[0]; let esc = null, bd = Infinity;
  for (const k in ESC) { const e = ESC[k]; if (e.building !== base) continue;
    const d = Math.hypot(e.x - s.c[0], e.y - s.c[1]); if (d < bd) { bd = d; esc = k; } }
  s.esc = esc; s.stack = s.codes[0].replace(/\d/, '').split('-')[0];
  s.codes.forEach(code => { const m = code.match(/^([A-Z])(\d)([a-z]?)-(\d+)$/);
    APTS.push({ code, num: +m[4], floor: +m[2], b: s.b, si, esc, stack: s.stack }); });
});
// квартира + 2 соседних стояка в том же корпусе (у торца — два с одной стороны)
STACKS.forEach((s, i) => {
  const idx = STACKS.map((t, j) => t.b === s.b ? j : -1).filter(j => j >= 0);
  const st = Math.max(0, Math.min(idx.indexOf(i) - 1, idx.length - 3));
  s.near = idx.slice(st, st + 3);
});
const gateRun = dijkstra(CFG.starts[0].node);
APTS.forEach(a => a.fromGate = Math.round(gateRun.dist[ESCNODE[a.esc]] * M_PER_PX));
APTS.sort((x, y) => x.num - y.num);
const MIN = APTS[0].num, MAX = APTS[APTS.length - 1].num;
const byCode = new Map(APTS.map(a => [a.code.toLowerCase(), a]));
const byNum = new Map(APTS.map(a => [String(a.num), a]));
const findApt = s => { s = String(s || '').trim().toLowerCase().replace(/^#/, ''); return byNum.get(s.replace(/^0+/, '')) || byCode.get(s); };

const escN = a => ESC[a.esc].n;
const escLabel = k => `Escalera ${ESC[k].n}` + (ESC[k].unlabeled ? ' ⚑' : '');
const liftLabel = a => a.floor === 0 ? T('noLift') : T('liftNear')(escN(a));
const howTo = a => tr(CFG.access[a.b]).replace('{n}', escN(a)) + (a.floor === 0 ? T('floorLevel') : T('toFloor')(a.floor));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ================= план (SVG) ================= */
const NS = 'http://www.w3.org/2000/svg';
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
const labelEls = CFG.labels.map(([t, x, y, s]) => { const e = el('text', { x, y, 'text-anchor': 'middle', 'font-size': s, 'font-weight': 600, class: 'lab', stroke: '#f7f6f1', 'stroke-width': 3, 'paint-order': 'stroke' }, $('g-lab')); return [e, t]; });
CFG.streetLabels.forEach(([t, x, y, rot]) => { const e = el('text', { x, y, 'font-size': 16, 'font-weight': 600, class: 'lab', transform: `rotate(${rot} ${x} ${y})`, 'letter-spacing': '2' }, $('g-lab')); e.textContent = t; });
const badgeTitles = CFG.badges.map(([t, x, y]) => { const g = el('g', {}, $('g-lab')); const w = t.length > 2 ? 44 : 34;
  el('rect', { x: x - w / 2, y: y - 14, width: w, height: 28, rx: 14, fill: '#2b2f2c', stroke: '#fff', 'stroke-width': 2.5 }, g);
  const e = el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 600, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g); e.textContent = t;
  return [el('title', {}, g), t]; });

for (const [a, b] of E) el('line', { x1: N[a][0], y1: N[a][1], x2: N[b][0], y2: N[b][1], stroke: '#1f4fd1', 'stroke-width': 3, 'stroke-opacity': .55, 'stroke-dasharray': '6 5' }, $('g-graph'));
for (const k in N) el('circle', { cx: N[k][0], cy: N[k][1], r: 3.5, fill: '#1f4fd1' }, $('g-graph'));

const stackEls = STACKS.map(s => el('path', { d: s.d, class: 'stk e' + ESC[s.esc].n, 'fill-rule': 'evenodd' }, $('g-stacks')));
const stackLbl = STACKS.map(() => el('g', {}, $('g-stl')));
const escEls = {};
for (const k in ESC) { const e = ESC[k]; const c = e.n === 1 ? '#2f7a4d' : '#b57d1a';
  const g = el('g', {}, $('g-esc')); el('circle', { cx: e.x, cy: e.y, r: 11, fill: c, stroke: '#fff', 'stroke-width': 2.5 }, g);
  const t = el('text', { x: e.x, y: e.y + 4, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g); t.textContent = 'E' + e.n;
  escEls[k] = g; }
const startEls = {};
for (const s of CFG.starts) { const [x, y] = N[s.node]; const g = el('g', {}, $('g-starts'));
  el('rect', { x: x - 8, y: y - 8, width: 16, height: 16, rx: 3, fill: '#fff', stroke: '#1d2420', 'stroke-width': 2.5 }, g); startEls[s.node] = el('title', {}, g); }

/* ================= состояние ================= */
const MODES = ['simple', 'pro'];
const state = {
  mode: MODES.includes(params.get('mode')) ? params.get('mode') : (MODES.includes(store.get('mode')) ? store.get('mode') : 'simple'),
  apt: null, from: CFG.starts[0].node, customStart: null, picking: false, floor: 'all', show: 'all', hover: -1, ff: 'all'
};
const simple = () => state.mode === 'simple';

function renderStacks() {
  const a = state.apt;
  const nearSet = a ? new Set(STACKS[a.si].near) : null;
  STACKS.forEach((s, i) => {
    const e = stackEls[i], sel = !!a && a.si === i;
    let vis = true;
    if (a && simple()) vis = nearSet.has(i);
    else if (a && state.show === 'bld') vis = s.b === a.b;
    else if (a && state.show === 'apt') vis = sel;
    e.style.display = vis ? '' : 'none'; stackLbl[i].style.display = vis ? '' : 'none';
    e.classList.toggle('sel', sel); e.classList.toggle('hov', state.hover === i && !sel);
    const g = stackLbl[i]; g.innerHTML = '';
    const [cx, cy] = s.c;
    if (simple()) {
      if (!a) return; // до поиска — только блоки, без подписей
      const code = s.codes.find(x => +x.match(/\d/)[0] === a.floor);
      const fs = Math.min(22, s.w / 3.6);
      const t = el('text', { x: cx, y: cy + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (sel ? ' sel' : '') }, g);
      t.textContent = code.split('-')[1];
    } else if (state.floor === 'all') {
      const fs = Math.min(11, Math.max(8, s.w / 8.5)), lh = fs * 1.18;
      s.codes.forEach((c, k) => { const t = el('text', { x: cx, y: cy - 1.5 * lh + k * lh + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (a && a.code === c ? ' sel' : '') }, g); t.textContent = c; });
    } else {
      const c = s.codes.find(x => +x.match(/\d/)[0] === +state.floor); const fs = Math.min(14, s.w / 6.2);
      const t = el('text', { x: cx, y: cy + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (a && a.code === c ? ' sel' : '') }, g); t.textContent = c;
    }
  });
  // в Simple после поиска показываем только нужную лестницу
  for (const k in escEls) escEls[k].style.display = (simple() && a && a.esc !== k) ? 'none' : '';
}

/* ================= маршрут и карточка ================= */
function startNode() {
  if (state.from !== '__custom') return { node: state.from, extra: null };
  const [x, y] = state.customStart; let best = null, bd = Infinity;
  const escNodes = new Set(Object.values(ESCNODE));
  for (const k in N) { if (escNodes.has(k)) continue; const d = Math.hypot(N[k][0] - x, N[k][1] - y); if (d < bd) { bd = d; best = k; } }
  return { node: best, extra: [x, y], extraLen: bd };
}
const startName = () => state.from === '__custom' ? T('pointOnMap') : tr(CFG.starts.find(s => s.node === state.from).name);
let lastPts = null;

function render() {
  renderStacks(); const gR = $('g-route'); gR.innerHTML = '';
  document.querySelectorAll('#tb tr').forEach(tr_ => tr_.classList.toggle('sel', !!state.apt && tr_.dataset.code === state.apt.code));
  const info = $('info');
  if (!state.apt) { info.innerHTML = `<div class="note">${esc(simple() ? T('simpleEmpty') : T('proEmpty'))}</div>`; lastPts = null; return; }
  const a = state.apt, s = STACKS[a.si];
  const st = startNode(); const run = dijkstra(st.node); const target = ESCNODE[a.esc]; const p = pathTo(run.prev, target);
  let pts = p.map(k => N[k]); let len = run.dist[target];
  if (st.extra) { pts = [st.extra, ...pts]; len += st.extraLen; }
  const ps = pts.map(q => q.join(',')).join(' ');
  el('polyline', { points: ps, fill: 'none', stroke: '#fff', 'stroke-width': 11, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gR);
  el('polyline', { points: ps, fill: 'none', stroke: '#1f4fd1', 'stroke-width': 6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gR);
  el('polyline', { points: ps, fill: 'none', stroke: '#9fb6ff', 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'routeline' }, gR);
  pts.forEach((q, i) => { if (i && i < pts.length - 1) el('circle', { cx: q[0], cy: q[1], r: 3.2, fill: '#fff', stroke: '#1f4fd1', 'stroke-width': 2 }, gR); });
  el('circle', { cx: pts[0][0], cy: pts[0][1], r: 9, fill: '#1d2420', stroke: '#fff', 'stroke-width': 3 }, gR);
  el('line', { x1: ESC[a.esc].x, y1: ESC[a.esc].y, x2: s.c[0], y2: s.c[1], stroke: '#d1491f', 'stroke-width': 3, 'stroke-dasharray': '4 4' }, gR);
  const shown = simple() ? s.near.map(j => STACKS[j].r) : [s.r];
  lastPts = pts.concat(...shown.map(r => [[r[0], r[1]], [r[2], r[3]]]));
  const meters = Math.round(len * M_PER_PX), mins = Math.max(1, Math.round(meters / WALK / 60));
  const n = escN(a), unl = ESC[a.esc].unlabeled;

  if (simple()) {
    info.innerHTML = `
      <div class="ans">
        <div class="ansnum mono">${a.num}</div>
        <div class="anssub">${esc(T('bld')(a.b))} · <span class="mono">${a.code}</span></div>
      </div>
      <div class="tiles">
        <div class="tile t-esc e${n}"><span>${esc(T('staircase'))}</span><b>${n}</b><small>Escalera ${n}${unl ? ' ⚑' : ''}</small></div>
        <div class="tile t-lift"><span>${esc(T('lift'))}*</span><b>${a.floor === 0 ? '—' : n}</b><small>${esc(a.floor === 0 ? T('noLift') : T('liftNear')(n))}</small></div>
        <div class="tile"><span>${esc(T('floor'))}</span><b>${a.floor}</b><small>${esc(a.floor === 0 ? T('groundFloor') : T('floorN')(a.floor))}</small></div>
        <div class="tile"><span>${esc(T('walk'))}</span><b>≈${meters}<i> ${T('m')}</i></b><small>${esc(T('minutes')(mins))}</small></div>
      </div>
      <p class="note">${esc(T('liftNote'))}${unl ? ' ⚑ ' + esc(T('escUnlabeled')) + '.' : ''}</p>`;
    return;
  }
  const steps = [T('start')(startName())];
  p.forEach(k => { if (STEPNAME[k]) { const x = tr(STEPNAME[k]); steps.push(x[0].toUpperCase() + x.slice(1)); } });
  steps.push(T('entrance')(a.b, n) + (unl ? ` (${T('escUnlabeled')})` : ''));
  steps.push(a.floor === 0 ? T('levelEntry') : T('goUp')(a.floor));
  steps.push(T('door')(a.code, a.stack));
  info.innerHTML = `<div class="dest">${esc(a.code)}</div>
    <div class="stat"><div><b>≈${meters} ${T('m')}</b><span>${esc(T('walk'))}</span></div><div><b>${esc(T('minutes')(mins))}</b><span>${esc(T('onSite'))}</span></div><div><b>${a.floor}</b><span>${esc(T('floor'))}</span></div></div>
    <dl class="kv"><dt>${esc(T('block'))}</dt><dd>${esc(a.b)}</dd><dt>${esc(T('staircase'))}</dt><dd>${escLabel(a.esc)}</dd><dt>${esc(T('lift'))}</dt><dd>${esc(liftLabel(a))}*</dd></dl>
    <ol class="steps">${steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <p class="note">${esc(T('liftNote'))}</p>
    <button class="btn" id="fitroute" type="button">${esc(T('showRoute'))}</button>`;
  $('fitroute').onclick = () => fitTo(lastPts);
}

function selectApt(a, fit = true) {
  state.apt = a; state.floor = String(a.floor); syncFloor && syncFloor();
  $('q').value = a.code; $('num').value = a.num; $('err').hidden = true;
  render(); if (fit && lastPts) fitTo(lastPts);
  try { history.replaceState(null, '', location.pathname + location.search + '#' + (simple() ? a.num : a.code)); } catch (_) { /* file:// */ }
}
function openStack(i) {
  const s = STACKS[i]; const f = state.apt ? state.apt.floor : (state.floor === 'all' ? 3 : +state.floor);
  selectApt(byCode.get(s.codes.find(x => +x.match(/\d/)[0] === f).toLowerCase()), false);
}

/* ================= Simple: форма ================= */
const isPhone = () => matchMedia('(max-width: 860px)').matches;
$('sform').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('num').value.trim(), err = $('err');
  if (!v) { err.textContent = T('enterNum'); err.hidden = false; $('num').focus(); return; }
  const a = findApt(v);
  if (!a) { err.textContent = T('notFound')(v); err.hidden = false; return; }
  $('num').blur(); selectApt(a);
  if (isPhone() && $('info').scrollIntoView) $('info').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
$('num').addEventListener('input', () => { $('err').hidden = true; });

/* ================= общее: откуда, режим, язык ================= */
const fromSel = $('from');
function fillFrom() {
  fromSel.innerHTML = '';
  CFG.starts.forEach(s => { const o = document.createElement('option'); o.value = s.node; o.textContent = tr(s.name); fromSel.appendChild(o); });
  const oc = document.createElement('option'); oc.value = '__custom'; oc.textContent = T('pointOnMap'); oc.hidden = state.from !== '__custom'; fromSel.appendChild(oc);
  fromSel.value = state.from;
}
fromSel.addEventListener('change', () => { state.from = fromSel.value; if (state.from !== '__custom') state.customStart = null; render(); if (state.apt && lastPts) fitTo(lastPts); });

function seg(id, items, key, cb) {
  const box = $(id); box.innerHTML = '';
  items.forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = v; box.appendChild(b); });
  const sync = () => [...box.children].forEach(b => { const on = b.dataset.v === String(state[key]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; state[key] = b.dataset.v; sync(); cb(); };
  sync(); return sync;
}
let syncFloor = null;
function buildSegs() {
  syncFloor = seg('floorseg', [['all', T('all')], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], 'floor', renderStacks);
  seg('showseg', [['all', T('all')], ['bld', T('block')], ['apt', T('apt')]], 'show', renderStacks);
}
const syncMode = seg('modeseg', [['simple', 'Simple'], ['pro', 'Pro']], 'mode', () => setMode(state.mode));
function setMode(m) {
  state.mode = m; store.set('mode', m); syncMode();
  document.body.classList.toggle('mode-simple', m === 'simple'); document.body.classList.toggle('mode-pro', m === 'pro');
  if (state.picking) $('pick').click();
  applyLayers(); render();
  requestAnimationFrame(() => { if (lastPts) fitTo(lastPts); else { vb = [...FULL]; setVB(); } });
}
$('lang').addEventListener('change', e => setLang(e.target.value));
function setLang(l) {
  LANG = l; store.set('lang', l); document.documentElement.lang = l; $('lang').value = l;
  document.title = 'FlamencaDemoPlan · ' + tr(CFG.title);
  $('apptitle').textContent = tr(CFG.title);
  document.querySelectorAll('[data-i]').forEach(n => { n.textContent = T(n.dataset.i); });
  $('q').placeholder = '449 · A3a-449'; $('ft').placeholder = T('filterCode');
  ['zin', 'zout', 'zfit'].forEach(k => $(k).setAttribute('aria-label', T(k)));
  $('footnote').textContent = T('foot');
  labelEls.forEach(([e, t]) => { e.textContent = tr(t); });
  badgeTitles.forEach(([e, t]) => { e.textContent = T('bld')(t); });
  CFG.starts.forEach(s => { startEls[s.node].textContent = tr(s.name); });
  stackEls.forEach((e, i) => { e.innerHTML = ''; el('title', {}, e).textContent = `${T('bld')(STACKS[i].b)}: ${STACKS[i].codes.join(', ')}`; });
  fillFrom(); buildSegs(); buildLayers(); buildTable(); render();
}

/* ================= Pro: поиск с подсказками ================= */
const q = $('q'), sugg = $('sugg'); let suggIdx = 0, suggList = [];
function showSugg(list) {
  suggList = list.slice(0, 12); suggIdx = 0; if (!suggList.length) { sugg.hidden = true; return; }
  sugg.innerHTML = suggList.map((a, i) => `<div class="${i ? '' : 'on'}" data-i2="${i}" role="option"><span class="mono">${a.code}</span><span class="note">${esc(T('bld')(a.b))} · ${esc(T('floorN')(a.floor))}</span></div>`).join('');
  sugg.hidden = false;
}
new MutationObserver(() => q.setAttribute('aria-expanded', String(!sugg.hidden))).observe(sugg, { attributes: true, attributeFilter: ['hidden'] });
q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); if (!v) { sugg.hidden = true; return; }
  showSugg(APTS.filter(a => a.code.toLowerCase().includes(v) || String(a.num).startsWith(v))); });
q.addEventListener('keydown', e => { if (sugg.hidden) return; const items = [...sugg.children];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); suggIdx = (suggIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((x, i) => x.classList.toggle('on', i === suggIdx)); }
  else if (e.key === 'Enter') { e.preventDefault(); selectApt(suggList[suggIdx]); sugg.hidden = true; }
  else if (e.key === 'Escape') sugg.hidden = true; });
sugg.addEventListener('mousedown', e => { const d = e.target.closest('[data-i2]'); if (!d) return; e.preventDefault(); selectApt(suggList[+d.dataset.i2]); sugg.hidden = true; });
q.addEventListener('blur', () => setTimeout(() => sugg.hidden = true, 150));
$('pick').onclick = () => { state.picking = !state.picking; $('pick').classList.toggle('on', state.picking); svg.classList.toggle('picking', state.picking); $('hint').hidden = !state.picking; };

/* ================= слои ================= */
const LAYER_DEF = [
  ['apts', 'aptlabels', 'plain', 'esc'], ['bld', 'gallery'],
  ['walk', 'road', 'parking', 'lawn', 'pool', 'site', 'sitebound', 'neighbour', 'labels'], ['graph', 'raster']];
const SW = { apts: '#eef6ef', plain: '#fbf2e2', esc: '#2f7a4d', bld: '#e7e1d3', gallery: '#efd57c', walk: '#e9dcbd', road: '#d3d6d3', parking: '#848985', lawn: '#bcd592', pool: '#57c1ea', site: '#f2efe6', neighbour: '#e9ece5', graph: '#1f4fd1' };
const PRESETS = [
  ['apts', 'aptlabels', 'plain', 'esc', 'bld', 'gallery', 'walk', 'road', 'parking', 'lawn', 'pool', 'site', 'sitebound', 'neighbour', 'labels'],
  ['apts', 'aptlabels', 'esc', 'bld', 'walk', 'site', 'labels'],
  ['apts', 'aptlabels', 'plain', 'esc', 'labels'],
  ['apts', 'esc', 'raster', 'graph']];
const SIMPLE_LAYERS = new Set(['apts', 'aptlabels', 'esc', 'bld', 'gallery', 'walk', 'road', 'parking', 'lawn', 'pool', 'site', 'sitebound', 'labels']);
const on = new Set(PRESETS[0]);
const boxes = {};
function buildLayers() {
  const body = $('layerbody'); body.innerHTML = '';
  const pr = document.createElement('div'); pr.className = 'presets';
  T('presets').forEach((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = n;
    b.onclick = () => { on.clear(); PRESETS[i].forEach(k => on.add(k)); applyLayers(); }; pr.appendChild(b); });
  body.appendChild(pr);
  LAYER_DEF.forEach((items, gi) => {
    const h = document.createElement('div'); h.className = 'grp'; h.textContent = T('groups')[gi]; body.appendChild(h);
    items.forEach(k => {
      const lab = document.createElement('label'); const cb = document.createElement('input'); cb.type = 'checkbox'; cb.id = 'ly-' + k;
      cb.onchange = () => { cb.checked ? on.add(k) : on.delete(k); applyLayers(); }; boxes[k] = cb; lab.appendChild(cb);
      if (SW[k]) { const s = document.createElement('span'); s.className = 'sw'; s.style.background = SW[k]; lab.appendChild(s); }
      lab.appendChild(document.createTextNode(T('ly')[k])); body.appendChild(lab);
      if (k === 'raster') { const r = document.createElement('input'); r.type = 'range'; r.id = 'rasterop'; r.min = 10; r.max = 100; r.value = Math.round(+raster.getAttribute('opacity') * 100);
        r.setAttribute('aria-label', T('rasterOpacity')); r.oninput = () => raster.setAttribute('opacity', r.value / 100); body.appendChild(r); }
    });
  });
  applyLayers();
}
function applyLayers() {
  const act = simple() ? SIMPLE_LAYERS : on;
  document.querySelectorAll('[data-layer]').forEach(g => { g.style.display = act.has(g.dataset.layer) ? '' : 'none'; });
  svg.classList.toggle('plain', !act.has('plain'));
  for (const k in boxes) boxes[k].checked = on.has(k);
}
$('layerbtn').onclick = () => { const b = $('layerbody'); b.hidden = !b.hidden; $('layerbtn').setAttribute('aria-expanded', String(!b.hidden)); $('layerarrow').textContent = b.hidden ? '▸' : '▾'; };
if (isPhone()) $('layerbtn').click();

/* ================= зум, панорама, клики ================= */
let vb = [...FULL];
const setVB = () => svg.setAttribute('viewBox', vb.join(' '));
function toSvg(cx, cy) { const r = svg.getBoundingClientRect(); const s = Math.max(vb[2] / r.width, vb[3] / r.height);
  const ox = (r.width * s - vb[2]) / 2, oy = (r.height * s - vb[3]) / 2; return [vb[0] - ox + (cx - r.left) * s, vb[1] - oy + (cy - r.top) * s]; }
function zoomAt(f, px, py) { const nw = Math.min(FULL[2] * 2, Math.max(140, vb[2] * f)), k = nw / vb[2]; vb = [px - (px - vb[0]) * k, py - (py - vb[1]) * k, nw, vb[3] * k]; setVB(); }
function fitTo(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]); const pad = 50;
  let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const r = svg.getBoundingClientRect(), ar = (r.width / r.height) || 1.5;
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
  if (!ptrs.size) { if (e.pointerType !== 'mouse') return;
    const [x, y] = toSvg(e.clientX, e.clientY); const i = stackAt(x, y);
    if (i !== state.hover) { state.hover = i; stackEls.forEach((s, j) => s.classList.toggle('hov', j === i && !(state.apt && state.apt.si === j))); svg.style.cursor = i >= 0 && !state.picking ? 'pointer' : ''; }
    return; }
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]); const [px, py] = toSvg((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); zoomAt(pinch.d / d, px, py); pinch.d = d; moved = 99; return; }
  if (drag) { const r = svg.getBoundingClientRect(); const s = Math.max(drag.vb[2] / r.width, drag.vb[3] / r.height); const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    moved = Math.max(moved, Math.abs(dx) + Math.abs(dy)); vb = [drag.vb[0] - dx * s, drag.vb[1] - dy * s, drag.vb[2], drag.vb[3]]; setVB(); }
});
const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (!ptrs.size) drag = null; };
svg.addEventListener('pointerup', e => { const wasClick = moved < 8 && ptrs.size === 1; up(e); if (!wasClick) return;
  const [x, y] = toSvg(e.clientX, e.clientY);
  if (state.picking) { state.customStart = [x, y]; state.from = '__custom'; fillFrom(); $('pick').click(); render(); return; }
  const i = stackAt(x, y); if (i >= 0) openStack(i); });
svg.addEventListener('pointercancel', up);
$('zin').onclick = () => zoomAt(1 / 1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zout').onclick = () => zoomAt(1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zfit').onclick = () => { vb = [...FULL]; setVB(); };

/* ================= Pro: реестр ================= */
const fb = $('fb'), ff = $('ff');
fb.onchange = renderTable; $('ft').oninput = renderTable;
ff.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; state.ff = b.dataset.v; renderTable(); });
function buildTable() {
  const cur = fb.value || 'all'; fb.innerHTML = '';
  ['all', ...new Set(STACKS.map(s => s.b).sort())].forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = v === 'all' ? T('allBlocks') : T('bld')(v); fb.appendChild(o); });
  fb.value = cur; fb.setAttribute('aria-label', T('block'));
  ff.innerHTML = '';
  ['all', 0, 1, 2, 3].forEach(v => { const b = document.createElement('button'); b.type = 'button'; b.textContent = v === 'all' ? T('allFloors') : v === 0 ? T('pb') : T('flShort')(v); b.dataset.v = v; ff.appendChild(b); });
  $('thead').innerHTML = T('th').map(h => `<th>${esc(h)}</th>`).join('');
  renderTable();
}
function filtered() { const b = fb.value, f = state.ff, t = $('ft').value.trim().toLowerCase();
  return APTS.filter(a => (b === 'all' || a.b === b) && (f === 'all' || a.floor === +f) && (!t || a.code.toLowerCase().includes(t) || String(a.num).includes(t)))
    .sort((x, y) => x.b.localeCompare(y.b) || y.floor - x.floor || x.num - y.num); }
function renderTable() {
  [...ff.children].forEach(b => b.classList.toggle('on', b.dataset.v === String(state.ff)));
  const rows = filtered(); $('fcount').textContent = T('of')(rows.length, APTS.length);
  $('tb').innerHTML = rows.map(a => `<tr data-code="${a.code}" class="${state.apt && state.apt.code === a.code ? 'sel' : ''}">
    <td class="num">${a.num}</td><td class="mono">${a.code}</td><td>${a.b}</td><td>${esc(T('floorN')(a.floor))}</td><td class="mono">${a.stack}</td>
    <td><span class="pill e${escN(a)}">${escLabel(a.esc)}</span></td><td>${esc(liftLabel(a))}</td><td>${esc(howTo(a))}</td><td class="num">≈${a.fromGate} ${T('m')}</td></tr>`).join('');
}
$('tb').addEventListener('click', e => { const r = e.target.closest('tr'); if (!r) return; selectApt(byCode.get(r.dataset.code.toLowerCase()));
  const box = $('mapbox'); if (box.scrollIntoView) box.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); });
$('copycsv').onclick = () => {
  const lines = [T('th'), ...filtered().map(a => [a.num, a.code, a.b, a.floor, a.stack, 'Escalera ' + escN(a), liftLabel(a), howTo(a), a.fromGate])]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  const msg = t => { $('toast').textContent = t; setTimeout(() => $('toast').textContent = '', 2000); };
  try { navigator.clipboard.writeText(lines).then(() => msg(T('copied')), () => msg(T('noClipboard'))); } catch (_) { msg(T('noClipboard')); }
};

/* ================= старт ================= */
setLang(LANG);
setMode(state.mode);
const fromHash = findApt(decodeURIComponent(location.hash.slice(1)));
if (fromHash) requestAnimationFrame(() => selectApt(fromHash));
window.addEventListener('hashchange', () => { const a = findApt(decodeURIComponent(location.hash.slice(1))); if (a && a !== state.apt) selectApt(a); });
})();
