/* FlamencaDemoPlan — навигатор по Flamenca Village.
 * Два интерфейса: Simple (по умолчанию, для смартфона) и Pro (слои, этажи, пошаговый маршрут).
 * Языки: es, en, fr, ru. Данные — window.ZHK из data/plan-data.js (python tools/build.py). */
(async () => {
'use strict';
const $ = id => document.getElementById(id);
if (!window.ZHK) { $('info').textContent = 'data/plan-data.js not found — run: python tools/build.py'; return; }
const Z = window.ZHK, CFG = Z.config, VEC = Z.vector;

/* ---------- правки из редактора: data/edits.json или черновик (?preview=1) ---------- */
const PREVIEW = new URLSearchParams(location.search).has('preview');
let EDITS = null;
if (PREVIEW) { try { EDITS = JSON.parse(localStorage.getItem('fdp.preview')); } catch (_) { /* нет доступа к хранилищу */ } }
if (!EDITS) { try { const r = await fetch('data/edits.json', { cache: 'no-cache' }); if (r.ok) EDITS = await r.json(); } catch (_) { /* file:// или файла нет */ } }
if (EDITS && EDITS.format === 'flamenca-edits' && EDITS.graph) {
  Z.graph = { nodes: EDITS.graph.nodes, edges: EDITS.graph.edges };          // закрытые отрезки (graph.closed) в маршрут не идут
  const near = (x, y) => { let b = 0, bd = Infinity; Z.graph.nodes.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };
  if (EDITS.stairs) Z.stairs.forEach(s => { const q = EDITS.stairs[s.id]; if (q) { s.x = q[0]; s.y = q[1]; } });
  Z.stairs.forEach(s => { s.node = near(s.x, s.y); });
  if (Array.isArray(EDITS.starts) && EDITS.starts.length) Z.starts = EDITS.starts.map(s => ({ ...s }));
  Z.starts.forEach(s => { s.node = near(s.x, s.y); });
  Z.lifts = EDITS.lifts || []; Z.water = EDITS.water || [];
  Z.points = EDITS.points || []; Z.info = EDITS.info || null; Z.georef = (EDITS.georef && EDITS.georef.points) || [];
}
if (PREVIEW) {
  const b = document.createElement('div'); b.className = 'previewbar';
  b.innerHTML = EDITS ? 'Предпросмотр данных из редактора — видно только на этом устройстве. <a href="./">Выйти</a>' : 'Предпросмотр: черновик не найден. <a href="./">Выйти</a>';
  document.body.prepend(b);
}

/* ================= i18n ================= */
const I18N = {
  es: {
    water: 'Cuadro de agua',
    m: 'm', aptNumber: 'Número de apartamento', to: 'Destino', from: 'Desde', onMap: 'En el plano', search: 'Buscar',
    floorOnPlan: 'Planta en el plano', showWhich: 'Apartamentos visibles', all: 'Todos', block: 'Bloque', apt: 'Apartamento',
    layers: 'Capas', pickHint: 'Toque el plano: la salida se coloca en el camino más cercano',
    zin: 'Acercar', zout: 'Alejar', zfit: 'Ver todo el plano',
    enterNum: 'Introduzca el número del apartamento', notFound: n => `No hay apartamento ${n}. Números disponibles: 1–${MAX}.`,
    simpleEmpty: 'Escriba el número del apartamento y pulse «Buscar». Verá la escalera, el ascensor y el camino en el plano.',
    proEmpty: 'Elija un apartamento en la búsqueda o tocando un bloque del plano.',
    staircase: 'Escalera', lift: 'Ascensor', liftNear: n => `junto a la escalera ${n}`, noLift: 'no hace falta',
    floor: 'Planta', groundFloor: 'planta baja', floorN: n => n === 0 ? 'Planta baja' : `Planta ${n}`,
    walk: 'a pie', minutes: m => `~${m} min`, onSite: 'por el recinto', bld: b => `Bloque ${b}`, local: 'Local comercial',
    liftNote: '* Los ascensores no figuran en el plano: se supone uno junto a cada escalera.',
    start: s => `Salida: ${s}`, alongPaths: m => `Siga los caminos ≈ ${m} m`, entrance: (b, n) => `Entrada: bloque ${b}, escalera ${n}`,
    levelEntry: 'Apartamento a nivel de la entrada (planta baja)', goUp: f => `Ascensor o escalera hasta la planta ${f}`,
    door: c => `Puerta ${c}`, pointOnMap: 'punto en el plano', showRoute: 'Ver todo el recorrido',
    allFloors: 'Todas', presets: ['Todo', 'Navegación', 'Solo apartamentos', 'Comparar con el original'],
    groups: ['Apartamentos', 'Edificios', 'Recinto', 'Servicio'],
    ly: { apts: 'Bloques de apartamentos', aptlabels: 'Números', plain: 'Colores por escalera', esc: 'Escaleras', lifts: 'Ascensores (supuestos)',
      bld: 'Edificios y terrazas', gallery: 'Galerías y núcleos', badges: 'Números de bloque', pois: 'Servicios (leyenda)',
      walk: 'Caminos peatonales', road: 'Viales', parking: 'Aparcamiento', lawn: 'Zonas verdes', pool: 'Piscinas', labels: 'Rótulos',
      graph: 'Red de caminos', water: 'Cuadros de agua', liftsdata: 'Ascensores (QGIS)', raster: 'Planos originales' },
    rasterOpacity: 'Opacidad de los planos originales',
    foot: 'Plano unificado a partir de los cuatro planos maestros; distancias aproximadas (~0,1 m por píxel). La planta se deduce del código: A3a-449 → planta 3.'
  },
  en: {
    water: 'Water panel',
    m: 'm', aptNumber: 'Apartment number', to: 'Destination', from: 'From', onMap: 'On the map', search: 'Search',
    floorOnPlan: 'Floor on the plan', showWhich: 'Visible apartments', all: 'All', block: 'Block', apt: 'Apartment',
    layers: 'Layers', pickHint: 'Tap the plan: the start snaps to the nearest path',
    zin: 'Zoom in', zout: 'Zoom out', zfit: 'Show the whole plan',
    enterNum: 'Enter the apartment number', notFound: n => `There is no apartment ${n}. Available numbers: 1–${MAX}.`,
    simpleEmpty: 'Type the apartment number and tap “Search”. You will see the staircase, the lift and the route on the plan.',
    proEmpty: 'Pick an apartment in the search or by tapping a block on the plan.',
    staircase: 'Staircase', lift: 'Lift', liftNear: n => `next to staircase ${n}`, noLift: 'not needed',
    floor: 'Floor', groundFloor: 'ground floor', floorN: n => n === 0 ? 'Ground floor' : `Floor ${n}`,
    walk: 'on foot', minutes: m => `~${m} min`, onSite: 'across the site', bld: b => `Block ${b}`, local: 'Commercial unit',
    liftNote: '* Lifts are not marked on the plans; one is assumed next to each staircase.',
    start: s => `Start: ${s}`, alongPaths: m => `Follow the paths ≈ ${m} m`, entrance: (b, n) => `Entrance: block ${b}, staircase ${n}`,
    levelEntry: 'Apartment at entrance level (ground floor)', goUp: f => `Lift or stairs to floor ${f}`,
    door: c => `Door ${c}`, pointOnMap: 'point on the map', showRoute: 'Show the whole route',
    allFloors: 'All', presets: ['Everything', 'Navigation', 'Apartments only', 'Compare with original'],
    groups: ['Apartments', 'Buildings', 'Grounds', 'Service'],
    ly: { apts: 'Apartment blocks', aptlabels: 'Numbers', plain: 'Colour by staircase', esc: 'Staircases', lifts: 'Lifts (assumed)',
      bld: 'Buildings and terraces', gallery: 'Galleries and cores', badges: 'Block numbers', pois: 'Facilities (legend)',
      walk: 'Footpaths', road: 'Driveways', parking: 'Parking', lawn: 'Greenery', pool: 'Pools', labels: 'Labels',
      graph: 'Path network', water: 'Water panels', liftsdata: 'Lifts (QGIS)', raster: 'Original plans' },
    rasterOpacity: 'Original plans opacity',
    foot: 'Unified plan built from the four master plans; distances are approximate (~0.1 m per pixel). The floor is taken from the code: A3a-449 → floor 3.'
  },
  fr: {
    water: 'Tableau d’eau',
    m: 'm', aptNumber: 'Numéro d’appartement', to: 'Destination', from: 'Départ', onMap: 'Sur le plan', search: 'Rechercher',
    floorOnPlan: 'Étage sur le plan', showWhich: 'Appartements affichés', all: 'Tous', block: 'Bâtiment', apt: 'Appartement',
    layers: 'Calques', pickHint: 'Touchez le plan : le départ se place sur l’allée la plus proche',
    zin: 'Zoom avant', zout: 'Zoom arrière', zfit: 'Voir tout le plan',
    enterNum: 'Saisissez le numéro de l’appartement', notFound: n => `Aucun appartement ${n}. Numéros disponibles : 1–${MAX}.`,
    simpleEmpty: 'Saisissez le numéro de l’appartement et touchez « Rechercher ». L’escalier, l’ascenseur et l’itinéraire s’afficheront sur le plan.',
    proEmpty: 'Choisissez un appartement dans la recherche ou en touchant un bloc du plan.',
    staircase: 'Escalier', lift: 'Ascenseur', liftNear: n => `à côté de l’escalier ${n}`, noLift: 'inutile',
    floor: 'Étage', groundFloor: 'rez-de-chaussée', floorN: n => n === 0 ? 'Rez-de-chaussée' : `${n}${n === 1 ? 'er' : 'e'} étage`,
    walk: 'à pied', minutes: m => `~${m} min`, onSite: 'dans la résidence', bld: b => `Bâtiment ${b}`, local: 'Local commercial',
    liftNote: '* Les ascenseurs ne figurent pas sur les plans ; on suppose un ascenseur à côté de chaque escalier.',
    start: s => `Départ : ${s}`, alongPaths: m => `Suivez les allées ≈ ${m} m`, entrance: (b, n) => `Entrée : bâtiment ${b}, escalier ${n}`,
    levelEntry: 'Appartement au niveau de l’entrée (rez-de-chaussée)', goUp: f => `Ascenseur ou escalier jusqu’au ${f}${f === 1 ? 'er' : 'e'} étage`,
    door: c => `Porte ${c}`, pointOnMap: 'point sur le plan', showRoute: 'Voir tout l’itinéraire',
    allFloors: 'Tous', presets: ['Tout', 'Navigation', 'Appartements seuls', 'Comparer à l’original'],
    groups: ['Appartements', 'Bâtiments', 'Résidence', 'Service'],
    ly: { apts: 'Blocs d’appartements', aptlabels: 'Numéros', plain: 'Couleur par escalier', esc: 'Escaliers', lifts: 'Ascenseurs (supposés)',
      bld: 'Bâtiments et terrasses', gallery: 'Coursives et cages', badges: 'Numéros de bâtiment', pois: 'Équipements (légende)',
      walk: 'Allées piétonnes', road: 'Voies', parking: 'Parking', lawn: 'Espaces verts', pool: 'Piscines', labels: 'Étiquettes',
      graph: 'Réseau d’allées', water: 'Tableaux d’eau', liftsdata: 'Ascenseurs (QGIS)', raster: 'Plans originaux' },
    rasterOpacity: 'Opacité des plans originaux',
    foot: 'Plan unifié à partir des quatre plans de masse ; distances approximatives (~0,1 m par pixel). L’étage est déduit du code : A3a-449 → 3e étage.'
  },
  ru: {
    water: 'Щит воды',
    m: 'м', aptNumber: 'Номер квартиры', to: 'Куда', from: 'Откуда', onMap: 'На плане', search: 'Искать',
    floorOnPlan: 'Этаж на плане', showWhich: 'Какие квартиры показывать', all: 'Все', block: 'Корпус', apt: 'Квартира',
    layers: 'Слои', pickHint: 'Нажмите на план — старт встанет на ближайшую дорожку',
    zin: 'Приблизить', zout: 'Отдалить', zfit: 'Показать весь план',
    enterNum: 'Введите номер квартиры', notFound: n => `Квартиры ${n} нет. Доступные номера: 1–${MAX}.`,
    simpleEmpty: 'Введите номер квартиры и нажмите «Искать» — покажем лестницу, лифт и маршрут на плане.',
    proEmpty: 'Выберите квартиру в поиске или нажмите на блок на плане.',
    staircase: 'Лестница', lift: 'Лифт', liftNear: n => `у лестницы ${n}`, noLift: 'не нужен',
    floor: 'Этаж', groundFloor: 'planta baja', floorN: n => n === 0 ? 'Этаж 0 (planta baja)' : `Этаж ${n}`,
    walk: 'пешком', minutes: m => `~${m} мин`, onSite: 'по территории', bld: b => `Корпус ${b}`, local: 'Коммерческое помещение',
    liftNote: '* Лифты на планах не обозначены; принято, что лифт стоит у каждой лестницы.',
    start: s => `Старт: ${s}`, alongPaths: m => `Идите по дорожкам ≈ ${m} м`, entrance: (b, n) => `Вход: корпус ${b}, лестница ${n}`,
    levelEntry: 'Квартира на уровне входа (planta baja)', goUp: f => `Лифт или лестница на ${f} этаж`,
    door: c => `Дверь ${c}`, pointOnMap: 'точка на плане', showRoute: 'Показать маршрут целиком',
    allFloors: 'Все', presets: ['Всё', 'Навигация', 'Только квартиры', 'Сверка с исходником'],
    groups: ['Квартиры', 'Здания', 'Территория', 'Служебное'],
    ly: { apts: 'Блоки квартир', aptlabels: 'Номера квартир', plain: 'Окраска по лестницам', esc: 'Лестницы', lifts: 'Лифты (условно)',
      bld: 'Корпуса и террасы', gallery: 'Галереи и ядра', badges: 'Номера корпусов', pois: 'Инфраструктура (легенда)',
      walk: 'Пешеходные дорожки', road: 'Проезды', parking: 'Парковка', lawn: 'Озеленение', pool: 'Бассейны', labels: 'Подписи',
      graph: 'Сеть маршрутов', water: 'Щиты воды', liftsdata: 'Лифты (QGIS)', raster: 'Исходные планы' },
    rasterOpacity: 'Прозрачность исходных планов',
    foot: 'Сводный план собран из четырёх листов мастер-плана; расстояния приблизительные (~0,1 м на пиксель). Этаж берётся из кода: A3a-449 → 3-й этаж.'
  }
};
const I18N_X = {
  es: { reset: 'Restablecer', pickApt: 'Pulse el número para trazar la ruta', tabRoute: 'Ruta', tabInfo: 'Información', infoEmpty: 'Aún no hay información.', openLink: 'Abrir enlace', close: 'Cerrar', apts: 'Apartamentos',
    locate: 'Dónde estoy', locating: 'Buscando su ubicación…', geoDenied: 'Sin acceso a la ubicación. Permítalo en los ajustes del navegador.', geoFar: 'Parece que está fuera del residencial.', geoNone: 'La ubicación no está disponible.', myLocation: 'Mi ubicación', accuracy: a => `precisión ±${a} m`,
    type: { entrance: 'Entrada', place: 'Punto de salida', info: 'Información', elec: 'Cuadro eléctrico', water: 'Cuadro de agua', garage: 'Entrada al garaje', facility: 'Servicio' },
    lyx: { places: 'Entradas, información, garajes', panels: 'Cuadros eléctricos y de agua' } },
  en: { reset: 'Reset', pickApt: 'Tap a number to build the route', tabRoute: 'Route', tabInfo: 'Information', infoEmpty: 'No information yet.', openLink: 'Open link', close: 'Close', apts: 'Apartments',
    locate: 'Where am I', locating: 'Finding your location…', geoDenied: 'No access to location. Allow it in the browser settings.', geoFar: 'You seem to be outside the residence.', geoNone: 'Location is not available.', myLocation: 'My location', accuracy: a => `accuracy ±${a} m`,
    type: { entrance: 'Entrance', place: 'Starting point', info: 'Information', elec: 'Electrical panel', water: 'Water panel', garage: 'Garage entrance', facility: 'Facility' },
    lyx: { places: 'Entrances, information, garages', panels: 'Electrical and water panels' } },
  fr: { reset: 'Réinitialiser', pickApt: 'Touchez un numéro pour tracer l’itinéraire', tabRoute: 'Itinéraire', tabInfo: 'Informations', infoEmpty: 'Pas encore d’informations.', openLink: 'Ouvrir le lien', close: 'Fermer', apts: 'Appartements',
    locate: 'Où suis-je', locating: 'Recherche de votre position…', geoDenied: 'Pas d’accès à la position. Autorisez-la dans les réglages du navigateur.', geoFar: 'Vous semblez être hors de la résidence.', geoNone: 'Position indisponible.', myLocation: 'Ma position', accuracy: a => `précision ±${a} m`,
    type: { entrance: 'Entrée', place: 'Point de départ', info: 'Informations', elec: 'Tableau électrique', water: 'Tableau d’eau', garage: 'Entrée du garage', facility: 'Équipement' },
    lyx: { places: 'Entrées, informations, garages', panels: 'Tableaux électriques et d’eau' } },
  ru: { reset: 'Сбросить', pickApt: 'Нажмите номер, чтобы построить маршрут', tabRoute: 'Маршрут', tabInfo: 'Информация', infoEmpty: 'Информации пока нет.', openLink: 'Открыть ссылку', close: 'Закрыть', apts: 'Квартиры',
    locate: 'Где я', locating: 'Определяем местоположение…', geoDenied: 'Нет доступа к местоположению. Разрешите его в настройках браузера.', geoFar: 'Похоже, вы не на территории комплекса.', geoNone: 'Местоположение недоступно.', myLocation: 'Моё местоположение', accuracy: a => `точность ±${a} м`,
    type: { entrance: 'Вход', place: 'Точка старта', info: 'Информация', elec: 'Электрический щит', water: 'Щит воды', garage: 'Въезд в гараж', facility: 'Объект' },
    lyx: { places: 'Входы, информация, гаражи', panels: 'Электрические и водяные щиты' } }
};
for (const l in I18N_X) { const x = I18N_X[l]; Object.assign(I18N[l].ly, x.lyx); delete x.lyx; Object.assign(I18N[l], x); }
const LANGS = Object.keys(I18N);
const store = {
  get(k) { try { return localStorage.getItem('fdp.' + k); } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem('fdp.' + k, v); } catch (_) { /* приватный режим */ } }
};
const params = new URLSearchParams(location.search);
function pickLang() {
  const cand = [params.get('lang'), store.get('lang'), ...(navigator.languages || [navigator.language || ''])];
  for (const c of cand) { const l = (c || '').slice(0, 2).toLowerCase(); if (LANGS.includes(l)) return l; }
  return CFG.languages[0];
}
let LANG = pickLang();
const T = k => I18N[LANG][k] ?? I18N.en[k];
const tr = v => (v && typeof v === 'object') ? (v[LANG] || v.en || Object.values(v)[0]) : v;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ================= данные ================= */
const [W, H] = Z.size, M_PER_PX = Z.metersPerPx, WALK = CFG.walkSpeed;
const STACKS = Z.stacks, STAIRS = Z.stairs, UNITS = Z.units, LIFTS = Z.lifts || [], WATER = Z.water || [], POINTS = Z.points || [];
const ELEC = POINTS.filter(p => p.type === 'elec');
const PLACES = new Set(['lagoon', 'pool51', 'pool10', 'pool14', 'office']);  // старые точки-места; всё остальное без типа — входы
Z.starts.forEach(s => { if (!s.kind) s.kind = PLACES.has(s.id) ? 'place' : 'entrance'; });
const GEO = window.FDPGeo ? FDPGeo.fit(Z.georef || [], Z.metersPerPx) : null;
const STAIR = Object.fromEntries(STAIRS.map(s => [s.id, s]));
const NODES = Z.graph.nodes;
const ADJ = NODES.map(() => []);
for (const [a, b] of Z.graph.edges) { const w = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]); ADJ[a].push([b, w]); ADJ[b].push([a, w]); }
function dijkstra(src, dst) { // бинарная куча
  const dist = new Float64Array(NODES.length).fill(Infinity), prev = new Int32Array(NODES.length).fill(-1), h = [[0, src]]; dist[src] = 0;
  const push = x => { h.push(x); let i = h.length - 1; while (i) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const t = h[0], l = h.pop(); if (h.length) { h[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i;
    if (a < h.length && h[a][0] < h[m][0]) m = a; if (b < h.length && h[b][0] < h[m][0]) m = b; if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } } return t; };
  while (h.length) { const [d, u] = pop(); if (u === dst) break; if (d > dist[u]) continue;
    for (const [v, w] of ADJ[u]) if (d + w < dist[v]) { dist[v] = d + w; prev[v] = u; push([dist[v], v]); } }
  let end = dst, gap = 0;
  if (dist[dst] === Infinity) { // финиш в другом куске сети: идём до ближайшей достижимой точки, остаток — по прямой
    let bd = Infinity; const [tx, ty] = NODES[dst];
    for (let i = 0; i < NODES.length; i++) if (dist[i] < Infinity) { const d = Math.hypot(NODES[i][0] - tx, NODES[i][1] - ty); if (d < bd) { bd = d; end = i; } }
    gap = bd;
  }
  const path = []; for (let u = end; u !== -1; u = prev[u]) path.unshift(u);
  if (end !== dst) path.push(dst);
  return { len: dist[end] + gap, path, gapFrom: end !== dst ? path.length - 2 : -1 };
}
const nearestNode = (x, y) => { let b = 0, bd = Infinity; NODES.forEach((p, i) => { const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < bd) { bd = d; b = i; } }); return b; };

const APTS = UNITS.filter(u => u.kind === 'apt');
const MAX = Math.max(...APTS.map(u => u.num));
const byNum = new Map(APTS.map(u => [String(u.num), u]));
const byCode = new Map(UNITS.map(u => [u.code.toLowerCase(), u]));
const byLoc = new Map(UNITS.filter(u => u.kind !== 'apt').map(u => [u.num.slice(1), u]));
const findApt = s => { s = String(s || '').trim().toLowerCase().replace(/^#/, '');
  const loc = s.match(/^(?:l|loc)\.?\s*(\d+)$/); if (loc) return byLoc.get(loc[1]);
  return byNum.get(s.replace(/^0+/, '')) || byCode.get(s); };
const unitAt = (si, f) => UNITS.find(u => u.stack === si && u.floor === f);
const label = u => u.kind === 'apt' ? String(u.num) : u.code.split(':')[1];
const stairOf = u => STAIR[STACKS[u.stack].stair];
const servesList = v => String(v || '').split(/[\s,;]+/).filter(Boolean);
const LIFT_NEAR_M = 40;   // лифт без точной привязки к лестнице считается «своим», если он ближе 40 м к квартире
const liftOf = u => { const sid = STACKS[u.stack].stair, c = STACKS[u.stack].c;
  const byServe = LIFTS.find(l => servesList(l.serves).includes(String(u.num))); if (byServe) return byServe;
  const byStair = LIFTS.find(l => l.stair_id === sid && !servesList(l.serves).length); if (byStair) return byStair;
  let best = null, bd = LIFT_NEAR_M / M_PER_PX;
  for (const l of LIFTS) { if (servesList(l.serves).length) continue; const d = Math.hypot(l.x - c[0], l.y - c[1]); if (d < bd) { bd = d; best = l; } }
  return best; };
const elecOf = u => ELEC.find(w => servesList(w.serves).includes(String(u.num))) || null;
const waterOf = u => WATER.find(w => servesList(w.serves).includes(String(u.num)) || servesList(w.serves).includes(u.code)) || null;

/* ================= план (SVG) ================= */
const NS = 'http://www.w3.org/2000/svg';
const el = (t, at, p) => { const e = document.createElementNS(NS, t); for (const k in at) e.setAttribute(k, at[k]); if (p) p.appendChild(e); return e; };
const L = k => document.querySelector(`[data-layer="${k}"]`);
const path = (g, d, fill, extra = {}) => el('path', Object.assign({ d, fill, 'fill-rule': 'evenodd' }, extra), g);
const svg = $('map'), FULL = [0, 0, W, H];
svg.setAttribute('viewBox', FULL.join(' '));
const raster = L('raster');
raster.setAttribute('href', CFG.image.file); raster.setAttribute('width', W); raster.setAttribute('height', H);

path(L('road'), VEC.road, '#d3d6d3');
path(L('walk'), VEC.walk, '#e9dcbd');
path(L('lawn'), VEC.lawn, '#bcd592'); path(L('lawn'), VEC.trees, '#79a858');
path(L('pool'), VEC.deck, '#cdb79b'); path(L('pool'), VEC.pool, '#57c1ea', { stroke: '#2e95c2', 'stroke-width': 1.5 });
path(L('parking'), VEC.parking, '#848985');
path(L('bld'), VEC.bldbody, '#e7e1d3', { stroke: '#a99d86', 'stroke-width': 1 }); path(L('bld'), VEC.terrace, '#d9cfbb');
path(L('gallery'), VEC.gallery, '#efd57c', { stroke: '#c9a93f', 'stroke-width': .8 });
const poiTitles = Z.pois.map(q => { const g = el('g', {}, L('pois'));
  el('circle', { cx: q.x, cy: q.y, r: 14, fill: '#fff', stroke: '#3a3f3b', 'stroke-width': 1.6 }, g);
  el('text', { x: q.x, y: q.y + 4.5, 'text-anchor': 'middle', 'font-size': q.code.length > 2 ? 10 : 12, 'font-weight': 600, fill: '#3a3f3b', 'font-family': 'IBM Plex Sans,sans-serif' }, g).textContent = q.code;
  return [el('title', {}, g), q.code]; });
const badgeTitles = Z.badges.map(([t, x, y]) => { const g = el('g', {}, L('badges')); const w = t.length > 2 ? 46 : 36;
  el('rect', { x: x - w / 2, y: y - 15, width: w, height: 30, rx: 15, fill: '#2b2f2c', stroke: '#fff', 'stroke-width': 2.5, opacity: .9 }, g);
  el('text', { x, y: y + 6, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 600, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g).textContent = t;
  return [el('title', {}, g), t]; });

for (const [a, b] of Z.graph.edges) el('line', { x1: NODES[a][0], y1: NODES[a][1], x2: NODES[b][0], y2: NODES[b][1], stroke: '#1f4fd1', 'stroke-width': 2, 'stroke-opacity': .5 }, L('graph'));

const stackEls = STACKS.map(s => el('path', { d: s.d, class: 'stk ' + (s.kind === 'local' ? 'loc' : 'e' + ((STAIR[s.stair] || { n: 1 }).n > 1 ? 2 : 1)), 'fill-rule': 'evenodd' }, $('g-stacks')));
const stackLbl = STACKS.map(() => el('g', {}, $('g-stl')));
const escEls = {}, liftEls = {};
for (const s of STAIRS) {
  const g = el('g', {}, L('esc')); el('rect', { x: s.x - 11, y: s.y - 11, width: 22, height: 22, rx: 5, fill: s.n === 1 ? '#2f7a4d' : '#b57d1a', stroke: '#fff', 'stroke-width': 2.5 }, g);
  el('text', { x: s.x, y: s.y + 4.5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g).textContent = 'E' + s.n;
  escEls[s.id] = [g, el('title', {}, g)];
  const l = el('g', {}, L('lifts')); el('rect', { x: s.x + 13, y: s.y - 10, width: 18, height: 20, rx: 3, fill: '#1f4fd1', stroke: '#fff', 'stroke-width': 2.5 }, l);
  el('text', { x: s.x + 22, y: s.y + 4.5, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, l).textContent = 'L';
  liftEls[s.id] = [l, el('title', {}, l)];
}
for (const l of LIFTS) { const g = el('g', {}, L('liftsdata'));
  el('rect', { x: l.x - 9, y: l.y - 10, width: 18, height: 20, rx: 3, fill: '#1f4fd1', stroke: '#fff', 'stroke-width': 2.5 }, g);
  el('text', { x: l.x, y: l.y + 4.5, 'text-anchor': 'middle', 'font-size': 11, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g).textContent = 'L';
  el('title', {}, g).textContent = `${l.id}${l.note ? ' · ' + l.note : ''}`; }
/* объекты с окном информации: входы, точки старта, «i», гаражи (все режимы) и щиты (только Pro) */
const OBJS = [
  ...Z.starts.map(s => ({ kind: s.kind, o: s })),
  ...POINTS.filter(p => p.type === 'info' || p.type === 'garage').map(p => ({ kind: p.type, o: p })),
  ...ELEC.map(p => ({ kind: 'elec', o: p, pro: true })),
  ...WATER.map(p => ({ kind: 'water', o: p, pro: true }))
];
const ICONS = {
  entrance: g => { el('rect', { x: -12, y: -12, width: 24, height: 24, rx: 6, fill: '#1d2420', stroke: '#fff', 'stroke-width': 2.5 }, g); el('path', { d: 'M-6 0h10M0-5l5 5-5 5', stroke: '#fff', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g); },
  place: g => { el('rect', { x: -9, y: -9, width: 18, height: 18, rx: 4, fill: '#fff', stroke: '#1d2420', 'stroke-width': 2.5 }, g); },
  info: g => { el('circle', { r: 12, fill: '#6d4bd1', stroke: '#fff', 'stroke-width': 2.5 }, g); el('path', { d: 'M0-1v7M0-6v.5', stroke: '#fff', 'stroke-width': 3, 'stroke-linecap': 'round' }, g); },
  garage: g => { el('rect', { x: -12, y: -12, width: 24, height: 24, rx: 6, fill: '#4a5560', stroke: '#fff', 'stroke-width': 2.5 }, g); el('text', { y: 5.5, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, g).textContent = 'P'; },
  elec: g => { el('rect', { x: -11, y: -11, width: 22, height: 22, rx: 5, fill: '#d99a00', stroke: '#fff', 'stroke-width': 2.5 }, g); el('path', { d: 'M1.5-7L-4.5 1.5h4.5l-1.5 6 6-8.5h-4.5z', fill: '#fff' }, g); },
  water: g => { el('circle', { r: 11, fill: '#2e95c2', stroke: '#fff', 'stroke-width': 2.5 }, g); el('path', { d: 'M0-6.5s4.5 5 4.5 7.8a4.5 4.5 0 01-9 0c0-2.8 4.5-7.8 4.5-7.8z', fill: '#fff' }, g); }
};
for (const it of OBJS) { const g = el('g', { transform: `translate(${it.o.x} ${it.o.y})` }, L(it.pro ? 'panels' : 'places')); const m = el('g', { class: 'mk' }, g); ICONS[it.kind](m); }

/* ================= состояние ================= */
const MODES = ['simple', 'pro'];
const state = {
  locked: MODES.includes(params.get('mode')) && params.has('lock'), geo: null,
  mode: MODES.includes(params.get('mode')) ? params.get('mode') : 'simple',
  apt: null, from: (Z.starts.find(st => st.default) || Z.starts.find(st => /main|principal/i.test(st.id + ' ' + Object.values(st.name || {}).join(' '))) || Z.starts[0]).id, customStart: null, picking: false, floor: 'all', show: 'all', hover: -1
};
const simple = () => state.mode === 'simple';

function renderStacks() {
  const a = state.apt, nearSet = a ? new Set(STACKS[a.stack].near) : null;
  STACKS.forEach((s, i) => {
    const e = stackEls[i], sel = !!a && a.stack === i;
    let vis = true;
    if (a && simple()) vis = nearSet.has(i);
    else if (a && state.show === 'bld') vis = s.block === a.blockOf;
    else if (a && state.show === 'apt') vis = sel;
    e.style.display = vis ? '' : 'none'; stackLbl[i].style.display = vis ? '' : 'none';
    e.classList.toggle('sel', sel); e.classList.toggle('hov', state.hover === i && !sel);
    const g = stackLbl[i]; g.innerHTML = '';
    const [cx, cy] = s.c;
    const f = simple() ? (a ? a.floor : null) : (state.floor === 'all' ? null : +state.floor);
    if (simple() && !a) return;
    if (f !== null) {
      const u = unitAt(i, f); if (!u) return;
      const fs = Math.min(simple() ? 22 : 16, s.w / (simple() ? 2.6 : 3.2));
      el('text', { x: cx, y: cy + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (a && a.code === u.code ? ' sel' : '') }, g).textContent = label(u);
    } else {
      const us = [3, 2, 1, 0].map(fl => unitAt(i, fl)).filter(Boolean);
      const fs = Math.min(10, Math.max(7, s.w / 6.5)), lh = fs * 1.15;
      us.forEach((u, k) => el('text', { x: cx, y: cy - (us.length - 1) / 2 * lh + k * lh + fs * .35, 'text-anchor': 'middle', 'font-size': fs, class: 'stl' + (a && a.code === u.code ? ' sel' : '') }, g).textContent = label(u));
    }
  });
  for (const id in escEls) { const hide = simple() && state.apt && STACKS[state.apt.stack].stair !== id; escEls[id][0].style.display = hide ? 'none' : ''; liftEls[id][0].style.display = (hide || LIFTS.length) ? 'none' : ''; }
}

/* ================= маршрут и карточка ================= */
const startPoint = () => (state.from === '__custom' || state.from === '__geo') ? { x: state.customStart[0], y: state.customStart[1], node: nearestNode(...state.customStart) } : Z.starts.find(s => s.id === state.from);
const startName = () => state.from === '__geo' ? T('myLocation') : state.from === '__custom' ? T('pointOnMap') : tr(Z.starts.find(s => s.id === state.from).name);
let lastPts = null;

const liftNodeCache = new Map();
function drawRoute(gR, sp, tx, ty, tnode, color) {
  const r = dijkstra(sp.node, tnode);
  let pts = [[sp.x, sp.y], ...r.path.map(i => NODES[i]), [tx, ty]];
  if (r.gapFrom >= 0) { const tail = pts.slice(r.gapFrom + 1); pts = pts.slice(0, r.gapFrom + 2);
    el('polyline', { points: tail.map(q => q.join(',')).join(' '), fill: 'none', stroke: color, 'stroke-width': 4, 'stroke-dasharray': '8 8', 'stroke-linecap': 'round' }, gR); }
  const len = r.len + Math.hypot(sp.x - NODES[sp.node][0], sp.y - NODES[sp.node][1]) + Math.hypot(tx - NODES[tnode][0], ty - NODES[tnode][1]);
  const ps = pts.map(q => q.join(',')).join(' ');
  el('polyline', { points: ps, fill: 'none', stroke: '#fff', 'stroke-width': 13, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gR);
  el('polyline', { points: ps, fill: 'none', stroke: color, 'stroke-width': 7, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gR);
  el('polyline', { points: ps, fill: 'none', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linecap': 'round', class: 'routeline' }, gR);
  return { pts, len };
}
/** крупная метка над лестницей или лифтом: иконка (лестница / стрелки вверх-вниз) и номер этажа */
function floorBadge(g, x, y, floor, kind, color, dx = 0) {
  const o = el('g', { transform: `translate(${x} ${y})` }, g), k = el('g', { class: 'mk' }, o);
  const t = el('g', { transform: `translate(${dx * .72} ${-34 * .72}) scale(.72)` }, k);
  el('path', { d: 'M-6 14L0 26 6 14Z', fill: color }, t);
  el('rect', { x: -27, y: -20, width: 54, height: 36, rx: 9, fill: color, stroke: '#fff', 'stroke-width': 3 }, t);
  const ic = el('g', { transform: 'translate(-12 -2)', fill: 'none', stroke: '#fff', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, t);
  if (kind === 'lift') el('path', { d: 'M-4-3L0-9 4-3M0-9V9M-4 3L0 9 4 3' }, ic);       // стрелки вверх-вниз
  else el('path', { d: 'M-9 9H-4V3H1V-3H6V-9H9' }, ic);                                   // ступени
  el('text', { x: 12, y: 9, 'text-anchor': 'middle', 'font-size': 24, 'font-weight': 700, fill: '#fff', 'font-family': 'IBM Plex Sans,sans-serif' }, t).textContent = String(floor);
}
const C_STAIR = '#2f7a4d', C_LIFT = '#1f4fd1';
function render() {
  renderStacks(); { const bg = document.querySelector('[data-layer="badges"]'); if (bg && !simple()) bg.style.display = state.apt ? 'none' : (on.has('badges') ? '' : 'none'); } const gR = $('g-route'); gR.innerHTML = '';
  const info = $('info');
  $('hit').innerHTML = state.apt ? `<b>${esc(T('bld')(STACKS[state.apt.stack].block))}</b><span>${esc(T('floorN')(state.apt.floor))}</span>` : '';
  if (!state.apt) { info.innerHTML = `<div class="note">${esc(simple() ? T('simpleEmpty') : T('proEmpty'))}</div>`; lastPts = null; return; }
  const a = state.apt, s = STACKS[a.stack], st = stairOf(a), sp = startPoint(), n = st.n;
  const lf = liftOf(a), up = a.floor > 0;
  // лифт: из данных редактора, иначе — условно у лестницы
  const lx = lf ? lf.x : st.x, ly = lf ? lf.y : st.y;
  const sameSpot = Math.hypot(lx - st.x, ly - st.y) * M_PER_PX < 3;
  let lnode = st.node; if (!sameSpot) { const key = lx + ',' + ly; if (!liftNodeCache.has(key)) liftNodeCache.set(key, nearestNode(lx, ly)); lnode = liftNodeCache.get(key); }
  const C_ROUTE = '#111';   // путь — чёрный с белой окантовкой и белым пунктиром, для лестницы и для лифта
  const rs = drawRoute(gR, sp, st.x, st.y, st.node, C_ROUTE);
  const rl = up && !sameSpot ? drawRoute(gR, sp, lx, ly, lnode, C_ROUTE) : rs;
  el('circle', { cx: sp.x, cy: sp.y, r: 11, fill: '#1d2420', stroke: '#fff', 'stroke-width': 3 }, gR);
  if (up && sameSpot) { floorBadge(gR, st.x, st.y, a.floor, 'stair', C_STAIR, -30); floorBadge(gR, st.x, st.y, a.floor, 'lift', C_LIFT, 30); }
  else { floorBadge(gR, st.x, st.y, a.floor, 'stair', C_STAIR); if (up) floorBadge(gR, lx, ly, a.floor, 'lift', C_LIFT); }
  const boxes = (simple() ? s.near : [a.stack]).map(i => STACKS[i].box);
  lastPts = rs.pts.concat(rl.pts, ...boxes.map(b => [[b[0], b[1]], [b[2], b[3]]]));
  const mS = Math.round(rs.len * M_PER_PX), mL = Math.round(rl.len * M_PER_PX), meters = Math.min(mS, mL);
  const mins = Math.max(1, Math.round(meters / WALK / 60));
  const wp = simple() ? null : waterOf(a), ep = simple() ? null : elecOf(a);
  const liftBig = !up ? '—' : (lf ? lf.id.replace(/^L-?/, '') : n);
  const liftStar = lf ? '' : '*';
  const liftSmall = !up ? T('noLift') : `≈${mL} ${T('m')}` + (lf && lf.note ? ' · ' + lf.note : (lf ? '' : ' · ' + T('liftNear')(n)));
  const head = a.kind === 'apt'
    ? `<div class="ansnum mono">${a.num}</div><div class="anssub">${esc(T('bld')(s.block))} · <span class="mono">${a.code}</span></div>`
    : `<div class="ansnum mono">${esc(label(a))}</div><div class="anssub">${esc(T('local'))} · ${esc(T('bld')(s.block))}</div>`;
  const tiles = `<div class="tiles">
      <div class="tile t-esc e${n > 1 ? 2 : 1}"><span>${esc(T('staircase'))}</span><b>${n}</b><small>Escalera ${n} · ≈${mS} ${T('m')}</small></div>
      <div class="tile t-lift"><span>${esc(T('lift'))}${liftStar}</span><b>${esc(liftBig)}</b><small>${esc(liftSmall)}</small></div>
      <div class="tile"><span>${esc(T('floor'))}</span><b>${a.floor}</b><small>${esc(a.floor === 0 ? T('groundFloor') : T('floorN')(a.floor))}</small></div>
      <div class="tile"><span>${esc(T('walk'))}</span><b>≈${meters}<i> ${T('m')}</i></b><small>${esc(T('minutes')(mins))} · ${esc(startName())}</small></div>
    </div>`;
  const panels = (wp || ep) ? `<dl class="kv">${wp ? `<dt>${esc(T('water'))}</dt><dd>${esc(wp.id)}${wp.place ? ' · ' + esc(wp.place) : ''}</dd>` : ''}${ep ? `<dt>${esc(T('type').elec)}</dt><dd>${esc(ep.id)}${ep.place ? ' · ' + esc(ep.place) : ''}</dd>` : ''}</dl>` : '';
  info.innerHTML = `<div class="ans">${head}</div>${tiles}${panels}
    <div class="legend2"><span><i style="background:${C_STAIR}"></i>${esc(T('staircase'))}</span>${up ? `<span><i style="background:${C_LIFT}"></i>${esc(T('lift'))}</span>` : ''}</div>
    ${lf || !up ? '' : `<p class="note">${esc(T('liftNote'))}</p>`}
    ${simple() ? '' : `<button class="btn" id="fitroute" type="button">${esc(T('showRoute'))}</button>`}`;
  if ($('fitroute')) $('fitroute').onclick = () => fitTo(lastPts);
}

function selectApt(a, fit = true) {
  state.apt = Object.assign(a, { blockOf: STACKS[a.stack].block });
  state.floor = String(a.floor); syncFloor && syncFloor();
  $('q').value = a.kind === 'apt' ? a.code : label(a); $('num').value = a.kind === 'apt' ? a.num : label(a); $('err').hidden = true;
  render(); if (fit && lastPts) fitTo(lastPts);
  try { history.replaceState(null, '', location.pathname + location.search + '#' + (a.kind === 'apt' ? a.num : label(a).replace(/[^\w.]/g, ''))); } catch (_) { /* file:// */ }
}
function openStack(i) {
  const s = STACKS[i], st = STAIR[s.stair], us = UNITS.filter(u => u.stack === i).sort((a, b) => b.floor - a.floor || String(a.num).localeCompare(String(b.num)));
  if (!us.length) return;
  const lf = liftOf(us[0]);
  const sub = [T('bld')(s.block), st ? `${T('staircase')} ${st.n}` : '', lf ? T('lift') : ''].filter(Boolean).join(' · ');
  const rows = [...new Set(us.map(u => u.floor))].map(f => `<div class="srow"><span>${esc(T('floorN')(f))}</span><div>${us.filter(u => u.floor === f).map(u => `<button class="btn anum" type="button" data-u="${UNITS.indexOf(u)}">${esc(label(u))}</button>`).join('')}</div></div>`).join('');
  $('popb').innerHTML = `<div class="pkind">${esc(T('apts'))}</div><h3 id="poptitle">${esc(sub)}</h3><div class="srows">${rows}</div><p class="pmeta">${esc(T('pickApt'))}</p>`;
  $('popb').querySelectorAll('[data-u]').forEach(b => b.onclick = () => { closePop(); selectApt(UNITS[+b.dataset.u]); });
  showPop();
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
  if (isPhone() && $('mapbox').scrollIntoView) $('mapbox').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
$('num').addEventListener('input', () => { $('err').hidden = true; });

/* ================= откуда, режим, язык ================= */
const fromSel = $('from');
function fillFrom() {
  fromSel.innerHTML = '';
  Z.starts.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.textContent = tr(s.name); fromSel.appendChild(o); });
  const oc = document.createElement('option'); oc.value = '__custom'; oc.textContent = T('pointOnMap'); oc.hidden = state.from !== '__custom'; fromSel.appendChild(oc);
  if (state.geo) { const og = document.createElement('option'); og.value = '__geo'; og.textContent = '◎ ' + T('myLocation'); fromSel.insertBefore(og, fromSel.firstChild); }
  fromSel.value = state.from;
}
fromSel.addEventListener('change', () => { state.from = fromSel.value; if (state.from === '__geo') state.customStart = state.geo.px; else if (state.from !== '__custom') state.customStart = null; render(); if (state.apt && lastPts) fitTo(lastPts); });

function seg(id, items, key, cb) {
  const box = $(id); box.innerHTML = '';
  items.forEach(([v, t]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.dataset.v = v; box.appendChild(b); });
  const sync = () => [...box.children].forEach(b => { const on = b.dataset.v === String(state[key]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; state[key] = b.dataset.v; sync(); cb(); };
  sync(); return sync;
}
let syncFloor = null;
function buildSegs() {
  syncFloor = seg('floorseg', [['all', T('allFloors')], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], 'floor', renderStacks);
  seg('showseg', [['all', T('all')], ['bld', T('block')], ['apt', T('apt')]], 'show', renderStacks);
}
const syncMode = () => {};
function setMode(m) {
  state.mode = m;
  document.body.classList.toggle('mode-simple', m === 'simple'); document.body.classList.toggle('mode-pro', m === 'pro');
  if (state.picking) $('pick').click();
  applyLayers(); render();
  requestAnimationFrame(() => { if (lastPts) fitTo(lastPts); else { vb = [...FULL]; setVB(); } });
}
$('lang').addEventListener('change', e => setLang(e.target.value));
function setLang(l) {
  LANG = l; store.set('lang', l); document.documentElement.lang = l; $('lang').value = l;
  document.title = tr(CFG.title);
  $('apptitle').textContent = tr(CFG.title);
  document.querySelectorAll('[data-i]').forEach(n => { n.textContent = T(n.dataset.i); });
  $('q').placeholder = '449 · A3a-449';
  ['zin', 'zout', 'zfit'].forEach(k => $(k).setAttribute('aria-label', T(k)));
  poiTitles.forEach(([e, c]) => { e.textContent = `${c} — ${tr(Z.legend[c] || '')}`; });
  badgeTitles.forEach(([e, t]) => { e.textContent = T('bld')(t); });
  renderInfoPage();
  $('locate').setAttribute('aria-label', T('locate')); $('locate').title = T('locate'); $('useloc').textContent = '◎ ' + T('locate');
  STAIRS.forEach(s => { escEls[s.id][1].textContent = `Escalera ${s.n} · ${T('bld')(s.group)}`; liftEls[s.id][1].textContent = `${T('lift')} ${s.n}* · ${T('bld')(s.group)}`; });
  stackEls.forEach((e, i) => { e.innerHTML = ''; el('title', {}, e).textContent = `${T('bld')(STACKS[i].block)}: ${UNITS.filter(u => u.stack === i).map(label).join(', ')}`; });
  fillFrom(); buildSegs(); buildLayers(); render();
}

/* ================= Pro: поиск с подсказками ================= */
const q = $('q'), sugg = $('sugg'); let suggIdx = 0, suggList = [];
function showSugg(list) {
  suggList = list.slice(0, 12); suggIdx = 0; if (!suggList.length) { sugg.hidden = true; return; }
  sugg.innerHTML = suggList.map((a, i) => `<div class="${i ? '' : 'on'}" data-i2="${i}" role="option"><span class="mono">${a.kind === 'apt' ? a.num + ' · ' + a.code : esc(a.code)}</span><span class="note">${esc(T('bld')(STACKS[a.stack].block))} · ${esc(T('floorN')(a.floor))}</span></div>`).join('');
  sugg.hidden = false;
}
new MutationObserver(() => q.setAttribute('aria-expanded', String(!sugg.hidden))).observe(sugg, { attributes: true, attributeFilter: ['hidden'] });
q.addEventListener('input', () => { const v = q.value.trim().toLowerCase(); if (!v) { sugg.hidden = true; return; }
  showSugg(UNITS.filter(a => a.code.toLowerCase().includes(v) || String(a.num).toLowerCase().startsWith(v))); });
q.addEventListener('keydown', e => { if (sugg.hidden) return; const items = [...sugg.children];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); suggIdx = (suggIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items.forEach((x, i) => x.classList.toggle('on', i === suggIdx)); }
  else if (e.key === 'Enter') { e.preventDefault(); selectApt(suggList[suggIdx]); sugg.hidden = true; }
  else if (e.key === 'Escape') sugg.hidden = true; });
sugg.addEventListener('mousedown', e => { const d = e.target.closest('[data-i2]'); if (!d) return; e.preventDefault(); selectApt(suggList[+d.dataset.i2]); sugg.hidden = true; });
q.addEventListener('blur', () => setTimeout(() => sugg.hidden = true, 150));
$('pick').onclick = () => { state.picking = !state.picking; $('pick').classList.toggle('on', state.picking); svg.classList.toggle('picking', state.picking); $('hint').hidden = !state.picking; };

/* ================= слои ================= */
const LAYER_DEF = [['apts', 'aptlabels', 'plain', 'esc', LIFTS.length ? 'liftsdata' : 'lifts'], ['bld', 'gallery', 'badges'], ['places', ...((WATER.length || ELEC.length) ? ['panels'] : []), 'pois', 'pool', 'lawn', 'walk', 'road', 'parking'], ['graph', 'raster']];
const SW = { places: '#6d4bd1', panels: '#d99a00', water: '#2e95c2', liftsdata: '#1f4fd1', apts: '#eef6ef', plain: '#fbf2e2', esc: '#2f7a4d', lifts: '#1f4fd1', bld: '#e7e1d3', gallery: '#efd57c', badges: '#2b2f2c', walk: '#e9dcbd', road: '#d3d6d3', parking: '#848985', lawn: '#bcd592', pool: '#57c1ea', graph: '#1f4fd1' };
const PRESETS = [
  ['apts', 'aptlabels', 'plain', 'esc', 'lifts', 'bld', 'gallery', 'badges', 'pois', 'pool', 'lawn', 'walk', 'road', 'parking'],
  ['apts', 'aptlabels', 'esc', 'lifts', 'bld', 'badges', 'walk', 'road'],
  ['apts', 'aptlabels', 'plain', 'esc', 'badges'],
  ['apts', 'esc', 'raster', 'graph']];
const SIMPLE_LAYERS = new Set(['places', 'liftsdata', 'apts', 'aptlabels', 'esc', 'lifts', 'bld', 'gallery', 'walk', 'road', 'parking', 'lawn', 'pool', 'pois']);
PRESETS[0].push('liftsdata', 'places', 'panels'); PRESETS[1].push('liftsdata', 'places'); PRESETS[2].push('places');
const on = new Set(PRESETS[0]); on.add('panels');
const boxes = {};
function buildLayers() {
  const body = $('layerbody'); if (!body) { applyLayers(); return; } body.innerHTML = '';
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
if ($('layerbtn')) $('layerbtn').onclick = () => { const b = $('layerbody'); b.hidden = !b.hidden; $('layerbtn').setAttribute('aria-expanded', String(!b.hidden)); $('layerarrow').textContent = b.hidden ? '▸' : '▾'; };
if (isPhone() && $('layerbtn')) $('layerbtn').click();

/* ================= зум, панорама, клики ================= */
let vb = [...FULL];
const setVB = () => { svg.setAttribute('viewBox', vb.join(' ')); const r = svg.getBoundingClientRect(); const s = Math.max(vb[2] / (r.width || 1), vb[3] / (r.height || 1)); svg.style.setProperty('--ms', Math.max(.6, Math.min(8, s * 1.05)).toFixed(3)); };
function toSvg(cx, cy) { const r = svg.getBoundingClientRect(); const s = Math.max(vb[2] / r.width, vb[3] / r.height);
  const ox = (r.width * s - vb[2]) / 2, oy = (r.height * s - vb[3]) / 2; return [vb[0] - ox + (cx - r.left) * s, vb[1] - oy + (cy - r.top) * s]; }
function zoomAt(f, px, py) { const nw = Math.min(W * 1.6, Math.max(200, vb[2] * f)), k = nw / vb[2]; vb = [px - (px - vb[0]) * k, py - (py - vb[1]) * k, nw, vb[3] * k]; setVB(); }
function fitTo(points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]); const pad = 70;
  let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad, w = Math.max(...xs) - x0 + pad, h = Math.max(...ys) - y0 + pad;
  const r = svg.getBoundingClientRect(), ar = (r.width / r.height) || 1.2;
  if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; } else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
  vb = [x0, y0, w, h]; setVB();
}
function stackAt(x, y) {
  for (let i = 0; i < STACKS.length; i++) {
    if (stackEls[i].style.display === 'none') continue;
    const [x0, y0, x1, y1] = STACKS[i].box;
    if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
      const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
      if (!stackEls[i].isPointInFill || stackEls[i].isPointInFill(pt)) return i;
    }
  }
  return -1;
}
svg.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = toSvg(e.clientX, e.clientY); zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, px, py); }, { passive: false });
const ptrs = new Map(); let drag = null, moved = 0, pinch = null;
svg.addEventListener('pointerdown', e => { try { svg.setPointerCapture(e.pointerId); } catch (_) { /* */ } ptrs.set(e.pointerId, [e.clientX, e.clientY]); moved = 0;
  if (ptrs.size === 1) drag = { x: e.clientX, y: e.clientY, vb: [...vb] };
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; } });
svg.addEventListener('pointermove', e => {
  if (!ptrs.size) { if (e.pointerType !== 'mouse') return;
    const [x, y] = toSvg(e.clientX, e.clientY); const i = stackAt(x, y);
    if (i !== state.hover) { state.hover = i; stackEls.forEach((s, j) => s.classList.toggle('hov', j === i && !(state.apt && state.apt.stack === j))); svg.style.cursor = i >= 0 && !state.picking ? 'pointer' : ''; }
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
  const hit = objAt(x, y); if (hit) { openPop(hit); return; }
  const i = stackAt(x, y); if (i >= 0) openStack(i); });
svg.addEventListener('pointercancel', up);
$('zin').onclick = () => zoomAt(1 / 1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zout').onclick = () => zoomAt(1.4, vb[0] + vb[2] / 2, vb[1] + vb[3] / 2);
$('zfit').onclick = () => { vb = [...FULL]; setVB(); };

/* ================= окно объекта ================= */
function objAt(x, y) {
  const r = svg.getBoundingClientRect(), k = Math.max(vb[2] / r.width, vb[3] / r.height), R = 18 * k;
  const act = simple() ? SIMPLE_LAYERS : on; let best = null, bd = R;
  for (const it of OBJS) { if (it.pro && (simple() || !act.has('panels'))) continue; if (!it.pro && !act.has('places')) continue;
    const d = Math.hypot(it.o.x - x, it.o.y - y); if (d < bd) { bd = d; best = it; } }
  if (!best && act.has('pois')) for (const q of Z.pois) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = { kind: 'facility', o: q }; } }
  return best;
}
const linkify = t => esc(t).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, a, u) => `<a href="${u}" target="_blank" rel="noopener">${a}</a>`)
  .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (m, p, u) => `${p}<a href="${u}" target="_blank" rel="noopener">${u}</a>`)
  .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const safeUrl = u => { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, ''); try { return new URL(u).href; } catch (_) { return ''; } };
function openPop(it) {
  const o = it.o, ty = T('type');
  let title, sub = ty[it.kind] || '', extra = '';
  if (it.kind === 'entrance' || it.kind === 'place') title = tr(o.name);
  else if (it.kind === 'facility') { title = tr(Z.legend[o.code] || '') || o.code; sub = `${ty.facility} · ${o.code}`; }
  else title = o.title || o.id || sub;
  if (it.kind === 'elec' || it.kind === 'water') {
    const bits = [o.id, o.block ? T('bld')(o.block) : '', o.floor !== undefined && o.floor !== '' ? T('floorN')(+o.floor) : '', o.place || '', it.kind === 'water' && o.kind ? o.kind : ''].filter(Boolean);
    if (title === o.id) title = ty[it.kind];
    sub = bits.join(' · ');
    const sv = servesList(o.serves); if (sv.length) extra += `<p class="pmeta"><b>${esc(T('apts'))}:</b> ${esc(sv.join(', '))}</p>`;
    if (o.note) extra += `<p class="pmeta">${esc(o.note)}</p>`;
    const ph = safeUrl(o.photo); if (ph) extra += `<p><a href="${esc(ph)}" target="_blank" rel="noopener">📷</a></p>`;
  }
  const text = o.info ? `<div class="ptext">${linkify(o.info).replace(/\n/g, '<br>')}</div>` : '';
  const link = safeUrl(o.link);
  $('popb').innerHTML = `<div class="pkind pk-${it.kind}">${esc(sub)}</div><h3 id="poptitle">${esc(title)}</h3>${text}${extra}${link ? `<a class="btn primary plink" href="${esc(link)}" target="_blank" rel="noopener">${esc(T('openLink'))} ↗</a>` : ''}`;
  showPop();
}
let popAt = 0;
function showPop() { popAt = Date.now(); $('pop').hidden = false; try { $('popx').focus({ preventScroll: true }); } catch (_) { /* */ } }
const closePop = () => { $('pop').hidden = true; $('pop').classList.remove('big'); };
$('popx').onclick = closePop;
$('pop').addEventListener('click', e => { if (e.target === $('pop') && Date.now() - popAt > 450) closePop(); }); // на телефоне «клик» от того же касания прилетает в подложку — не закрывать сразу
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('pop').hidden) closePop(); });

/* ================= страница общей информации ================= */
function md(src) {
  const out = []; let list = false, para = [];
  const flush = () => { if (para.length) { out.push(`<p>${para.map(linkify).join('<br>')}</p>`); para = []; } if (list) { out.push('</ul>'); list = false; } };
  for (const raw of String(src || '').replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    if (!line.trim()) { flush(); continue; }
    let m;
    if ((m = line.match(/^(#{1,3})\s+(.*)/))) { flush(); out.push(`<h${m[1].length + 1}>${linkify(m[2])}</h${m[1].length + 1}>`); continue; }
    if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (para.length) { out.push(`<p>${para.map(linkify).join('<br>')}</p>`); para = []; } if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${linkify(m[1])}</li>`); continue; }
    if (list) { out.push('</ul>'); list = false; }
    para.push(line);
  }
  flush(); return out.join('');
}
const INFO = Z.info || {};
function infoPage() { // новый формат {text, link}; старый — по языкам {es:{title,text},…}
  if (typeof INFO.text === 'string' && INFO.text.trim()) return { text: INFO.text, link: INFO.link, title: INFO.title };
  for (const l of [LANG, 'es', 'en', ...LANGS]) { const x = INFO[l]; if (x && (x.text || '').trim()) return x; }
  return null;
}
function renderInfoPage() { const x = infoPage(); $('infobtn').hidden = !x; $('infobtn').querySelector('span').textContent = T('tabInfo'); }
function openInfo() {
  const x = infoPage(); if (!x) return; const link = safeUrl(x.link);
  $('popb').innerHTML = `<div class="pkind">${esc(T('tabInfo'))}</div>${x.title ? `<h3 id="poptitle">${esc(x.title)}</h3>` : ''}<div class="infopage">${md(x.text)}</div>${link ? `<a class="btn primary plink" href="${esc(link)}" target="_blank" rel="noopener">${esc(T('openLink'))} ↗</a>` : ''}`;
  $('pop').classList.add('big'); showPop();
}
$('infobtn').onclick = openInfo;
$('reset').onclick = () => { state.apt = null; $('num').value = ''; $('q').value = ''; $('err').hidden = true; closePop(); render(); vb = [...FULL]; setVB();
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) { /* file:// */ } };

/* ================= «Где я» ================= */
let watchId = null, firstFix = true;
const toast = t => { const e = $('ntoast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { e.hidden = true; }, 3500); };
function drawMe() {
  const g = $('g-me'); g.innerHTML = ''; if (!state.geo) return;
  const [x, y] = state.geo.px;
  el('circle', { cx: x, cy: y, r: Math.max(20, state.geo.acc / M_PER_PX), fill: '#1f4fd1', 'fill-opacity': .12, stroke: '#1f4fd1', 'stroke-opacity': .4, 'stroke-width': 2 }, g);
  const m = el('g', { transform: `translate(${x} ${y})` }, g); const k = el('g', { class: 'mk' }, m);
  el('circle', { r: 9, fill: '#1f4fd1', stroke: '#fff', 'stroke-width': 3.5 }, k);
}
function locate() {
  if (!GEO) return;
  if (!navigator.geolocation) { toast(T('geoNone')); return; }
  if (watchId !== null) { if (state.geo) { useGeo(); fitTo([state.geo.px, ...(lastPts || [])]); } return; }
  toast(T('locating')); $('locate').classList.add('on');
  watchId = navigator.geolocation.watchPosition(pos => {
    const px = GEO.toPx(pos.coords.latitude, pos.coords.longitude), acc = Math.round(pos.coords.accuracy || 0);
    const inside = px[0] > -300 && px[1] > -300 && px[0] < W + 300 && px[1] < H + 300;
    if (!inside) { if (firstFix) toast(T('geoFar')); firstFix = false; state.geo = null; drawMe(); return; }
    const moved = !state.geo || Math.hypot(state.geo.px[0] - px[0], state.geo.px[1] - px[1]) * M_PER_PX > 3;
    state.geo = { px, acc }; drawMe();
    if (firstFix) { firstFix = false; toast(`${T('myLocation')} · ${T('accuracy')(acc)}`); useGeo(); if (!state.apt) fitTo([[px[0] - 300, px[1] - 300], [px[0] + 300, px[1] + 300]]); }
    else if (state.from === '__geo' && moved) { state.customStart = px; render(); }
  }, err => { $('locate').classList.remove('on'); watchId = null; toast(err.code === 1 ? T('geoDenied') : T('geoNone')); },
  { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
}
function useGeo() { state.from = '__geo'; state.customStart = state.geo.px; fillFrom(); render(); }
if (GEO) { $('locate').hidden = false; $('useloc').hidden = false; }
$('locate').onclick = locate; $('useloc').onclick = locate;
if (GEO && navigator.permissions && navigator.permissions.query) navigator.permissions.query({ name: 'geolocation' }).then(p => { if (p.state === 'granted') locate(); }).catch(() => {});


/* ================= старт ================= */
setLang(LANG);
setMode(state.mode);
const fromHash = findApt(decodeURIComponent(location.hash.slice(1)));
if (fromHash) requestAnimationFrame(() => selectApt(fromHash));
window.addEventListener('hashchange', () => { const a = findApt(decodeURIComponent(location.hash.slice(1))); if (a && a !== state.apt) selectApt(a); });
})();
